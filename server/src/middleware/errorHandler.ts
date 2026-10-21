import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  constructor(
    public code: number,
    public status: number,
    message: string,
    public data: unknown = null
  ) {
    super(message);
  }
}

export function asyncHandler<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof multer.MulterError) {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      code: 1001,
      data: { multer: err.code },
      message: isTooLarge ? '上传文件超过大小限制' : '上传文件不符合要求'
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ code: 1001, data: err.flatten(), message: '参数校验失败' });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, data: err.data, message: err.message });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled request error');
  res.status(500).json({ code: 1005, data: null, message: '服务器内部错误' });
}

