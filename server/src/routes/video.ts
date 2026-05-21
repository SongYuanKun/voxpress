import { Router } from 'express';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

export const videoRouter = Router();

videoRouter.post('/parse', asyncHandler(async (_req, _res) => {
  throw new AppError(
    1010,
    501,
    '视频解析仍在 P1 Spike：后续将实现抽帧识别单号、抽音频 ASR、LLM 结构化和导出'
  );
}));

