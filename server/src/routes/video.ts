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
import { parseItems, transcribeAudio, type TrackingRecognition } from '../services/llmService.js';

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

function pickTrackingNumber(text: string) {
  const normalized = text.toUpperCase().replace(/[O]/g, '0').replace(/[IL]/g, '1');
  const candidates = normalized.match(/[A-Z0-9]{8,32}/g) || [];
  const scored = candidates
    .map((value) => ({
      value,
      score: (/[0-9]/.test(value) ? 2 : 0) + Math.min(value.length, 20) + (/[A-Z]/.test(value) ? 1 : 0)
    }))
    .filter((item) => /\d{6,}/.test(item.value))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.value || '';
}

async function recognizeTrackingLocally(framePaths: string[]): Promise<TrackingRecognition> {
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

  const evidence = snippets.join('\n').slice(0, 300);
  const trackingNumber = pickTrackingNumber(evidence);
  return {
    tracking_number: trackingNumber,
    confidence: trackingNumber ? 0.72 : 0,
    evidence: evidence.replace(/\s+/g, ' ').slice(0, 160)
  };
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
      } catch {
        warnings.push('音频转文字失败：请配置支持 audio transcriptions 的 ASR_API_BASE/ASR_MODEL，或先手动补充口述内容');
      }
    } else {
      warnings.push('未检测到可用音轨');
    }

    const parsed = transcript.trim() ? await parseItems(transcript) : { items: [] };

    res.json({
      code: 0,
      data: {
        tracking_number: tracking.tracking_number,
        tracking_confidence: tracking.confidence,
        tracking_evidence: tracking.evidence,
        raw_text: transcript,
        items: parsed.items,
        source_type: 'video',
        warnings
      },
      message: 'success'
    });
  } finally {
    await cleanup([file.path, workDir]);
  }
}));
