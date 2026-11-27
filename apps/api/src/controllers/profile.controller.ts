import type { NextFunction, Request, Response } from 'express';
import {
  changePassword,
  deactivateAccount,
  getProfile,
  listSessions,
  requestDeletion,
  requestEmailChange,
  revokeSession,
  updateProfile,
  verifyEmailChange,
} from '../services/profile.service.js';
import { validate, getValidated } from '../middleware/validate.js';
import {
  changePasswordSchema,
  deleteRequestSchema,
  emailChangeRequestSchema,
  emailChangeVerifySchema,
  profileUpdateSchema,
  sessionIdParamSchema,
  sessionListQuerySchema,
} from '../schemas/profile.schemas.js';
import { AppError } from '../errors/app-error.js';

export const profileController = {
  getProfile: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const profile = await getProfile(req.auth.userId);
        res.status(200).json({ data: { profile } });
      } catch (error) {
        next(error);
      }
    },
  ],

  updateProfile: [
    validate({ body: profileUpdateSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const body = getValidated<ReturnType<typeof profileUpdateSchema.parse>>(req, 'body');
        const profile = await updateProfile(req.auth.userId, {
          ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
          ...(body.timeZone !== undefined ? { timeZone: body.timeZone } : {}),
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
        });
        res.status(200).json({ data: { profile } });
      } catch (error) {
        next(error);
      }
    },
  ],

  requestEmailChange: [
    validate({ body: emailChangeRequestSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const body = getValidated<ReturnType<typeof emailChangeRequestSchema.parse>>(req, 'body');
        await requestEmailChange(req.auth.userId, body.email);
        res.status(200).json({
          data: { message: 'If the address is available, a verification link has been sent.' },
        });
      } catch (error) {
        next(error);
      }
    },
  ],

  verifyEmailChange: [
    validate({ body: emailChangeVerifySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = getValidated<ReturnType<typeof emailChangeVerifySchema.parse>>(req, 'body');
        await verifyEmailChange(body.token);
        res.status(200).json({ data: { message: 'Email address updated.' } });
      } catch (error) {
        next(error);
      }
    },
  ],

  changePassword: [
    validate({ body: changePasswordSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const body = getValidated<ReturnType<typeof changePasswordSchema.parse>>(req, 'body');
        await changePassword(req.auth.userId, body.currentPassword, body.newPassword);
        res.status(200).json({ data: { message: 'Password changed. Please sign in again.' } });
      } catch (error) {
        next(error);
      }
    },
  ],

  listSessions: [
    validate({ query: sessionListQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const query = getValidated<ReturnType<typeof sessionListQuerySchema.parse>>(req, 'query');
        const page = await listSessions(req.auth.userId, req.auth.sessionId, {
          ...(query.cursor ? { cursor: query.cursor } : {}),
          limit: query.limit,
        });
        res.status(200).json({ data: page });
      } catch (error) {
        next(error);
      }
    },
  ],

  revokeSession: [
    validate({ params: sessionIdParamSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        const params = getValidated<ReturnType<typeof sessionIdParamSchema.parse>>(req, 'params');
        await revokeSession(req.auth.userId, params.sessionId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  ],

  deactivate: [
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        await deactivateAccount(req.auth.userId);
        res.status(200).json({ data: { message: 'Account deactivated.' } });
      } catch (error) {
        next(error);
      }
    },
  ],

  deleteRequest: [
    validate({ body: deleteRequestSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        }
        await requestDeletion(req.auth.userId);
        res.status(200).json({
          data: {
            message: 'Deletion request recorded. Contact support to complete account closure.',
          },
        });
      } catch (error) {
        next(error);
      }
    },
  ],
};
