import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!config.authToken) {
    res.status(500).json({ code: 1006, data: null, message: 'APP_AUTH_TOKEN 未配置' });
    return;
  }

  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token !== config.authToken) {
    res.status(401).json({ code: 1006, data: null, message: '鉴权失败' });
    return;
  }

  next();
}
