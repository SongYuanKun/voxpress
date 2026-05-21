import './db/index.js';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/index.js';
import { db } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { expressRouter } from './routes/express.js';
import { logger } from './utils/logger.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false
}));

app.get('/api/health', (_req, res) => {
  const dbOk = db.prepare('SELECT 1 as ok').get() as { ok: number };
  res.json({
    code: 0,
    data: {
      status: 'ok',
      db: dbOk.ok === 1 ? 'ok' : 'error',
      time: new Date().toISOString()
    },
    message: 'success'
  });
});

app.use('/api/express', authMiddleware, expressRouter);
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});
app.use(errorHandler);

app.listen(config.port, '0.0.0.0', () => {
  logger.info({ port: config.port }, 'VoxPress server started');
});
