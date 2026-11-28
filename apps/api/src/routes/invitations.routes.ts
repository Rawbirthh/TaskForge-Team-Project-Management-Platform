import { Router } from 'express';
import { invitationsController } from '../controllers/invitations.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const invitationsRouter = Router();

invitationsRouter.post('/accept', requireAuth, ...invitationsController.accept);
invitationsRouter.post('/decline', requireAuth, ...invitationsController.decline);
