import { Router } from 'express';
import { env } from '../config/env.js';
import { healthRouter } from './health.routes.js';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    data: {
      name: 'TaskForge API',
      version: env.APP_VERSION,
      health: '/api/v1/health',
      readiness: '/api/v1/health/ready',
    },
  });
});

apiRouter.use('/health', healthRouter);
