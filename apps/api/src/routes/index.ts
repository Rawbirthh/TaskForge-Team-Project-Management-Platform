import { Router } from 'express';
import { env } from '../config/env.js';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { usersRouter } from './users.routes.js';
import { requireAuth } from '../middleware/auth.js';
import { authController } from '../controllers/auth.controller.js';

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
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.get('/me', requireAuth, ...authController.me);
