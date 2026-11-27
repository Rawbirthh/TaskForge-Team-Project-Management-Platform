import type { NextFunction, Request, Response } from 'express';
import { authenticateAccessToken } from '../services/auth.service.js';
import { AppError } from '../errors/app-error.js';
import { corsOrigins } from '../config/env.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    return;
  }

  try {
    const { userId, sessionId } = await authenticateAccessToken(token);
    req.auth = { userId, sessionId };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireVerifiedOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin || !corsOrigins.includes(origin)) {
    next(new AppError(403, 'CSRF_ORIGIN_REJECTED', 'Origin is not allowed'));
    return;
  }
  next();
}
