import { randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { parseVideoRecords, transcribeAudio, type VideoParsedRecord } from '../services/llmService.js';
import { extractTrackingCandidates, recordsFromCandidates, type TrackingCandidate } from './videoHelpers.js';

const execFileAsync = promisify(execFile);

export const videoRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fsSync.mkdirSync(config.uploadDir, { recursive: true });
      cb(null, config.uploadDir);
    }
  }),
  limits: {
    fileSize: config.video.maxUploadMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('video/')) {
      cb(new AppError(1001, 400, '请上传视频文件'));
      return;
    }
    cb(null, true);
  }
});

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function extractFrames(videoPath: string, workDir: string) {
  const framePattern = path.join(workDir, 'frame-%03d.jpg');
  const width = config.video.frameWidth;
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vf',
      `fps=1/2,scale='min(${width},iw)':-2`,
      '-frames:v',
      String(config.video.frameCount),
      '-q:v',
      '3',
      framePattern
    ]);
  } catch {
    throw new AppError(1016, 422, '视频文件无法解析，请确认上传的是有效视频');
  }

  const files = await fs.readdir(workDir);
  return files
    .filter((name) => /^frame-\d+\.jpg$/.test(name))
    .sort()
    .map((name) => path.join(workDir, name));
}

async function extractAudio(videoPath: string, workDir: string) {
  const audioPath = path.join(workDir, 'audio.mp3');
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '64k',
      audioPath
    ]);
  } catch {
    return null;
  }

  return (await pathExists(audioPath)) ? audioPath : null;
}

async function recognizeTrackingLocally(framePaths: string[]): Promise<{ candidates: TrackingCandidate[]; evidence: string }> {
  const snippets: string[] = [];

  for (const frame of framePaths) {
    try {
      const { stdout } = await execFileAsync('zbarimg', ['--raw', frame], { timeout: 10_000 });
      if (stdout.trim()) snippets.push(stdout.trim());
    } catch {
      // zbarimg exits non-zero when no barcode is found.
    }

    try {
      const { stdout } = await execFileAsync('tesseract', [frame, 'stdout', '-l', 'eng', '--psm', '6'], { timeout: 20_000 });
      if (stdout.trim()) snippets.push(stdout.trim());
    } catch {
      // OCR is best effort; continue with other frames.
    }
  }

  return extractTrackingCandidates(snippets);
}

function mergeRecordsWithCandidates(records: VideoParsedRecord[], candidates: TrackingCandidate[]) {
  const used = new Set<string>();
  const candidateValues = candidates.map((candidate) => candidate.tracking_number);

  const merged = records.map((record, index) => {
    let trackingNumber = record.tracking_number;
    if (!trackingNumber && candidateValues[index]) {
      trackingNumber = candidateValues[index];
    }
    if (trackingNumber) used.add(trackingNumber);
    const candidate = candidates.find((item) => item.tracking_number === trackingNumber) || candidates[index];
    return {
      tracking_number: trackingNumber,
      tracking_confidence: candidate?.confidence || 0,
      tracking_evidence: candidate?.evidence || '',
      raw_text: record.raw_text,
      items: record.items
    };
  });

  for (const candidate of candidates) {
    if (!used.has(candidate.tracking_number)) {
      merged.push({
        tracking_number: candidate.tracking_number,
        tracking_confidence: candidate.confidence,
        tracking_evidence: candidate.evidence,
        raw_text: '',
        items: []
      });
    }
  }

  return merged;
}

async function cleanup(paths: string[]) {
  await Promise.all(paths.map((target) => fs.rm(target, { recursive: true, force: true }).catch(() => undefined)));
}

videoRouter.post('/parse', upload.single('video'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError(1001, 400, '请上传视频文件');
  }

  const workDir = path.join(config.uploadDir, `video-${randomUUID()}`);
  await ensureDir(workDir);

  try {
    const frames = await extractFrames(file.path, workDir);
    const audioPath = await extractAudio(file.path, workDir);

    const tracking = await recognizeTrackingLocally(frames);
    const warnings: string[] = [];
    let transcript = '';

    if (audioPath) {
      try {
        transcript = await transcribeAudio(audioPath);
      } catch (error) {
        warnings.push(error instanceof AppError && error.code === 1017
          ? '今日 LLM/ASR 调用额度已用尽；已保留画面候选，请手动补充口述内容'
          : '音频转文字失败：请配置支持 audio transcriptions 的 ASR_API_BASE/ASR_MODEL，或先手动补充口述内容');
      }
    } else {
      warnings.push('未检测到可用音轨');
    }

    const trackingNumbers = tracking.candidates.map((candidate) => candidate.tracking_number);
    let parsedRecords: VideoParsedRecord[];
    if (transcript.trim()) {
      try {
        parsedRecords = await parseVideoRecords(transcript, trackingNumbers);
      } catch (error) {
        // The transcript and local OCR result remain useful for manual
        // confirmation even when the optional LLM grouping call times out.
        warnings.push(error instanceof AppError && error.code === 1017
          ? '今日 LLM 调用额度已用尽；已保留原文和候选单号，请手动确认'
          : '口述内容未能自动拆分；已保留原文和候选单号，请手动确认');
        parsedRecords = recordsFromCandidates(tracking.candidates, transcript);
      }
    } else {
      parsedRecords = recordsFromCandidates(tracking.candidates);
    }
    const records = mergeRecordsWithCandidates(parsedRecords, tracking.candidates);

    res.json({
      code: 0,
      data: {
        tracking_numbers: trackingNumbers,
        tracking_evidence: tracking.evidence,
        raw_text: transcript,
        records,
        source_type: 'video',
        warnings
      },
      message: 'success'
    });
  } finally {
    await cleanup([file.path, workDir]);
  }
}));
