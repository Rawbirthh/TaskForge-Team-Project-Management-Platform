import type { NextFunction, Request, Response } from 'express';
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
  declineInvitation,
} from '../services/invitation.service.js';
import { validate, getValidated } from '../middleware/validate.js';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  declineInvitationSchema,
  invitationListQuerySchema,
  workspaceInvitationParamsSchema,
} from '../schemas/membership.schemas.js';
import { workspaceIdParamSchema } from '../schemas/workspace.schemas.js';
import { AppError } from '../errors/app-error.js';
import { prisma } from '../lib/prisma.js';

export const invitationsController = {
  create: [
    validate({ params: workspaceIdParamSchema, body: createInvitationSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string }>(req, 'params');
        const body = getValidated<ReturnType<typeof createInvitationSchema.parse>>(req, 'body');
        const result = await createInvitation(params.workspaceId, req.auth.userId, body);
        res.status(201).json({ data: { invitation: result } });
      } catch (error) {
        next(error);
      }
    },
  ],

  list: [
    validate({ params: workspaceIdParamSchema, query: invitationListQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string }>(req, 'params');
        const query = getValidated<ReturnType<typeof invitationListQuerySchema.parse>>(
          req,
          'query',
        );
        const result = await listInvitations(params.workspaceId, req.auth.userId, query);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  resend: [
    validate({ params: workspaceInvitationParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string; invitationId: string }>(req, 'params');
        const result = await resendInvitation(
          params.workspaceId,
          req.auth.userId,
          params.invitationId,
        );
        res.status(200).json({ data: { invitation: result } });
      } catch (error) {
        next(error);
      }
    },
  ],

  revoke: [
    validate({ params: workspaceInvitationParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string; invitationId: string }>(req, 'params');
        await revokeInvitation(params.workspaceId, req.auth.userId, params.invitationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  ],

  accept: [
    validate({ body: acceptInvitationSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const body = getValidated<ReturnType<typeof acceptInvitationSchema.parse>>(req, 'body');
        // Need user email for matching.
        const user = await prisma.user.findUnique({
          where: { id: req.auth.userId },
          select: { email: true },
        });
        if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const result = await acceptInvitation(req.auth.userId, user.email, body.token);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  decline: [
    validate({ body: declineInvitationSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const body = getValidated<ReturnType<typeof declineInvitationSchema.parse>>(req, 'body');
        const user = await prisma.user.findUnique({
          where: { id: req.auth.userId },
          select: { email: true },
        });
        if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        await declineInvitation(user.email, body.token);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  ],
};
