import type { NextFunction, Request, Response } from 'express';
import {
  getPublicUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../services/auth.service.js';
import { parseCookies, REFRESH_COOKIE_NAME, refreshCookieOptions } from '../lib/cookies.js';
import { validate, getValidated } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../schemas/auth.schemas.js';
import { AppError } from '../errors/app-error.js';
import { corsOrigins, env } from '../config/env.js';

function clientMeta(req: Request): { userAgent?: string; ipAddress?: string } {
  const userAgent = req.headers['user-agent'];
  const ipAddress = req.ip;
  return {
    ...(typeof userAgent === 'string' ? { userAgent } : {}),
    ...(typeof ipAddress === 'string' ? { ipAddress } : {}),
  };
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
}

export const authController = {
  register: [
    validate({ body: registerSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof registerSchema.parse>>(req, 'body');
        const result = await registerUser({
          email: body.email,
          password: body.password,
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...clientMeta(req),
        });
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
        res.status(201).json({
          data: {
            accessToken: result.accessToken,
            user: result.user,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  login: [
    validate({ body: loginSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof loginSchema.parse>>(req, 'body');
        const result = await loginUser({ ...body, ...clientMeta(req) });
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
        res.status(200).json({
          data: {
            accessToken: result.accessToken,
            user: result.user,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  refresh: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cookies = parseCookies(req.headers.cookie);
        const refreshToken = cookies[REFRESH_COOKIE_NAME];
        if (!refreshToken) {
          throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
        }
        const result = await refreshSession({ refreshToken, ...clientMeta(req) });
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
        res.status(200).json({
          data: { accessToken: result.accessToken },
        });
      } catch (error) {
        clearRefreshCookie(res);
        next(error);
      }
    },
  ],

  logout: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cookies = parseCookies(req.headers.cookie);
        const refreshToken = cookies[REFRESH_COOKIE_NAME];
        if (refreshToken) {
          const origin = req.headers.origin;
          if (!origin || !corsOrigins.includes(origin)) {
            throw new AppError(403, 'CSRF_ORIGIN_REJECTED', 'Origin is not allowed');
          }
        }
        await logoutSession({
          ...(req.auth?.sessionId !== undefined ? { sessionId: req.auth.sessionId } : {}),
          ...(req.auth?.userId !== undefined ? { userId: req.auth.userId } : {}),
          ...(refreshToken !== undefined ? { refreshToken } : {}),
        });
        clearRefreshCookie(res);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  ],

  forgotPassword: [
    validate({ body: forgotPasswordSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof forgotPasswordSchema.parse>>(req, 'body');
        await requestPasswordReset({ email: body.email });
        res.status(200).json({
          data: { message: 'If an account exists for that email, a reset link has been sent.' },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  resetPassword: [
    validate({ body: resetPasswordSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof resetPasswordSchema.parse>>(req, 'body');
        await resetPassword({ token: body.token, password: body.password });
        res.status(200).json({
          data: { message: 'Password has been reset.' },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  verifyEmail: [
    validate({ body: verifyEmailSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof verifyEmailSchema.parse>>(req, 'body');
        await verifyEmail({ token: body.token });
        res.status(200).json({
          data: { message: 'Email verified.' },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  resendVerification: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        await resendVerification(req.auth.userId);
        res.status(200).json({
          data: { message: 'If the account is unverified, a verification link has been sent.' },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  me: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const user = await getPublicUser(req.auth.userId);
        res.status(200).json({ data: { user } });
      } catch (error) {
        next(error);
      }
    },
  ],
};
