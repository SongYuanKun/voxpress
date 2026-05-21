import OpenAI from 'openai';
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

