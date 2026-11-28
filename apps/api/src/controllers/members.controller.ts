import type { NextFunction, Request, Response } from 'express';
import { listMembers, updateMember, removeMember } from '../services/membership.service.js';
import { validate, getValidated } from '../middleware/validate.js';
import {
  memberListQuerySchema,
  updateMemberSchema,
  workspaceMemberParamsSchema,
} from '../schemas/membership.schemas.js';
import { workspaceIdParamSchema } from '../schemas/workspace.schemas.js';
import { AppError } from '../errors/app-error.js';

export const membersController = {
  list: [
    validate({ params: workspaceIdParamSchema, query: memberListQuerySchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string }>(req, 'params');
        const query = getValidated<ReturnType<typeof memberListQuerySchema.parse>>(req, 'query');
        const result = await listMembers(params.workspaceId, req.auth.userId, query);
        res.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  ],

  update: [
    validate({ params: workspaceMemberParamsSchema, body: updateMemberSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string; membershipId: string }>(req, 'params');
        const body = getValidated<ReturnType<typeof updateMemberSchema.parse>>(req, 'body');
        const result = await updateMember(
          params.workspaceId,
          req.auth.userId,
          params.membershipId,
          body,
        );
        res.status(200).json({ data: { membership: result } });
      } catch (error) {
        next(error);
      }
    },
  ],

  remove: [
    validate({ params: workspaceMemberParamsSchema }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
        const params = getValidated<{ workspaceId: string; membershipId: string }>(req, 'params');
        await removeMember(params.workspaceId, req.auth.userId, params.membershipId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  ],
};
