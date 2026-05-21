import OpenAI from 'openai';
import fs from 'node:fs';
import { z } from 'zod';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { parsedItemsSchema, type ParsedItems } from '../schemas/express.js';

const systemPrompt = `你是一个快递入库物品信息结构化解析助手。
用户会提供一段中文口述或文本描述，你只需要提取物品名称、数量和单位。

规则：
1. 只输出合法 JSON，不要输出解释文本。
2. 输出格式必须是 {"items":[{"name":"物品名","quantity":数量,"unit":"单位"}]}。
3. name 去掉数量和量词，保留能区分物品的核心名称。
4. quantity 必须是正整数；未明确数量时默认为 1。
5. unit 保留用户表达中的单位，如 张、个、盒、包、件；无法判断时用空字符串。
6. 不要编造用户没有提到的物品。
7. 无法识别任何物品时输出 {"items":[]}。`;

function buildClient() {
  if (!config.llm.apiKey) {
    throw new AppError(1003, 422, 'LLM_API_KEY 未配置');
  }

  return new OpenAI({
    apiKey: config.llm.apiKey,
    baseURL: config.llm.apiBase,
    timeout: config.llm.timeoutMs,
    maxRetries: config.llm.maxRetries
  });
}

function buildAsrClient() {
  if (!config.asr.apiKey) {
    throw new AppError(1003, 422, 'ASR_API_KEY 未配置');
  }

  return new OpenAI({
    apiKey: config.asr.apiKey,
    baseURL: config.asr.apiBase,
    timeout: config.asr.timeoutMs,
    maxRetries: config.asr.maxRetries
  });
}

function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || trimmed;
}

export async function parseItems(rawText: string): Promise<ParsedItems> {
  const input = rawText.slice(0, config.llm.maxInputChars);
  const client = buildClient();

  let responseText = '';

  try {
    const response = await client.chat.completions.create({
      model: config.llm.model,
      temperature: config.llm.temperature,
      max_tokens: config.llm.maxOutputTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ]
    });

    responseText = response.choices[0]?.message?.content || '';
  } catch (error) {
    throw new AppError(1004, 504, 'LLM 调用超时或失败', { provider: config.llm.provider });
  }

  try {
    const parsed = JSON.parse(extractJson(responseText));
    return parsedItemsSchema.parse(parsed);
  } catch {
    throw new AppError(1003, 422, 'LLM 输出非法或无法解析');
  }
}

export const llmPrompt = systemPrompt;

const videoRecordsPrompt = `你是快递视频口述内容拆分助手。
用户会提供一段从视频音频转写来的中文口述，以及画面 OCR 识别出的候选快递单号。
你的任务是把口述内容拆成多条快递入库记录。

规则：
1. 只输出合法 JSON，不要输出解释文本。
2. 输出格式必须是 {"records":[{"tracking_number":"单号或空字符串","raw_text":"该单的原始口述片段","items":[{"name":"物品名","quantity":数量,"unit":"单位"}]}]}。
3. 如果口述里出现“第一个、第二个、下一个、这个单号、尾号、单号”等线索，尽量按顺序或线索匹配候选单号。
4. 如果无法判断归属，就按口述顺序拆分；单号可留空，前端会人工确认。
5. 每条记录的 items 按 name + quantity + unit 输出；未明确数量时默认为 1。
6. 不要编造候选单号之外的新单号；除非口述中明确说出了完整单号。
7. 无法识别任何物品时输出 {"records":[]}。`;

const videoParsedRecordSchema = z.object({
  tracking_number: z.string().trim().max(80).default(''),
  raw_text: z.string().trim().max(1000).default(''),
  items: parsedItemsSchema.shape.items
});

const videoParsedRecordsSchema = z.object({
  records: z.array(videoParsedRecordSchema).max(50).default([])
});

export type VideoParsedRecord = z.infer<typeof videoParsedRecordSchema>;

export async function parseVideoRecords(rawText: string, trackingCandidates: string[]): Promise<VideoParsedRecord[]> {
  const input = rawText.slice(0, config.llm.maxInputChars * 3);
  const client = buildClient();
  let responseText = '';

  try {
    const response = await client.chat.completions.create({
      model: config.llm.model,
      temperature: config.llm.temperature,
      max_tokens: Math.max(config.llm.maxOutputTokens, 1200),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: videoRecordsPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            tracking_candidates: trackingCandidates.slice(0, 50),
            transcript: input
          })
        }
      ]
    });

    responseText = response.choices[0]?.message?.content || '';
  } catch {
    throw new AppError(1004, 504, 'LLM 批量拆分调用超时或失败', { provider: config.llm.provider });
  }

  try {
    const parsed = JSON.parse(extractJson(responseText));
    return videoParsedRecordsSchema.parse(parsed).records;
  } catch {
    throw new AppError(1003, 422, 'LLM 批量拆分输出非法或无法解析');
  }
}

const trackingPrompt = `你是快递面单识别助手。
任务：从视频抽帧图片中识别快递单号/运单号。

规则：
1. 只输出合法 JSON，不要解释。
2. 输出格式：{"tracking_number":"识别到的单号或空字符串","confidence":0到1之间的小数,"evidence":"简短说明看到的位置或依据"}。
3. 优先识别面单上的“运单号、快递单号、单号、物流单号”。
4. 如果图片里有多个疑似号码，选择最像快递单号的一个。
5. 不确定时 tracking_number 输出空字符串，confidence 输出 0。`;

function imageToDataUrl(path: string) {
  const data = fs.readFileSync(path).toString('base64');
  return `data:image/jpeg;base64,${data}`;
}

export type TrackingRecognition = {
  tracking_number: string;
  confidence: number;
  evidence: string;
};

export async function recognizeTrackingFromFrames(framePaths: string[]): Promise<TrackingRecognition> {
  if (!framePaths.length) {
    throw new AppError(1011, 422, '未能从视频中抽取画面');
  }

  const client = buildClient();
  let responseText = '';

  try {
    const response = await client.chat.completions.create({
      model: config.llm.model,
      temperature: 0,
      max_tokens: 400,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: trackingPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请识别这些视频抽帧里的快递单号。' },
            ...framePaths.map((path) => ({
              type: 'image_url' as const,
              image_url: { url: imageToDataUrl(path) }
            }))
          ]
        }
      ]
    });
    responseText = response.choices[0]?.message?.content || '';
  } catch {
    throw new AppError(1012, 504, '视频画面识别失败，请确认 LLM 模型支持图片输入');
  }

  try {
    const parsed = JSON.parse(extractJson(responseText)) as Partial<TrackingRecognition>;
    return {
      tracking_number: String(parsed.tracking_number || '').trim(),
      confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0,
      evidence: String(parsed.evidence || '').slice(0, 200)
    };
  } catch {
    throw new AppError(1013, 422, '视频画面识别结果无法解析');
  }
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const client = buildAsrClient();

  try {
    const result = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: config.asr.model,
      language: 'zh'
    });
    return (result.text || '').trim();
  } catch {
    throw new AppError(1014, 504, '音频转文字失败，请确认 ASR_API_BASE/ASR_MODEL 支持 audio transcriptions');
  }
}
