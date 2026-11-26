import { Router } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      service: 'taskforge-api',
      version: env.APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

healthRouter.get('/ready', async (_req, res) => {
  try {
    // Verifies both connectivity and that the initial migration is applied.
    await prisma.systemSetting.findFirst({ select: { key: true } });
  } catch {
    throw new AppError(503, 'NOT_READY', 'A required dependency is not ready');
  }

  res.json({
    data: {
      status: 'ready',
      checks: {
        database: 'ok',
      },
    },
  });
});
