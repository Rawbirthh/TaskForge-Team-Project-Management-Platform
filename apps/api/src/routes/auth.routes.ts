import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireVerifiedOrigin } from '../middleware/auth.js';
import { getRequestId } from '../lib/request-id.js';

const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again later.',
        requestId: getRequestId(req),
      },
    });
  },
});

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, requireVerifiedOrigin, ...authController.register);
authRouter.post('/login', authRateLimiter, requireVerifiedOrigin, ...authController.login);
// Routine page reloads call /refresh. The rotating opaque cookie, reuse detection,
// and the global /api/v1 limiter already bound this endpoint; the stricter
// credential limiter is reserved for login/register.
authRouter.post('/refresh', requireVerifiedOrigin, ...authController.refresh);
authRouter.post('/logout', ...authController.logout);
authRouter.post('/forgot-password', authRateLimiter, ...authController.forgotPassword);
authRouter.post('/reset-password', authRateLimiter, ...authController.resetPassword);
authRouter.post('/verify-email', authRateLimiter, ...authController.verifyEmail);
authRouter.post(
  '/resend-verification',
  authRateLimiter,
  requireAuth,
  ...authController.resendVerification,
);
authRouter.get('/me', requireAuth, ...authController.me);
