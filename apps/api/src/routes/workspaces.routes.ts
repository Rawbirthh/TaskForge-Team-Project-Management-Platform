import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller.js';
import { membersController } from '../controllers/members.controller.js';
import { invitationsController } from '../controllers/invitations.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const workspacesRouter = Router();

workspacesRouter.post('/', requireAuth, ...workspaceController.create);
workspacesRouter.get('/', requireAuth, ...workspaceController.list);
workspacesRouter.get('/slug-availability', requireAuth, ...workspaceController.slugAvailability);

// Members
workspacesRouter.get('/:workspaceId/members', requireAuth, ...membersController.list);
workspacesRouter.patch(
  '/:workspaceId/members/:membershipId',
  requireAuth,
  ...membersController.update,
);
workspacesRouter.delete(
  '/:workspaceId/members/:membershipId',
  requireAuth,
  ...membersController.remove,
);

// Invitations
workspacesRouter.post('/:workspaceId/invitations', requireAuth, ...invitationsController.create);
workspacesRouter.get('/:workspaceId/invitations', requireAuth, ...invitationsController.list);
workspacesRouter.post(
  '/:workspaceId/invitations/:invitationId/resend',
  requireAuth,
  ...invitationsController.resend,
);
workspacesRouter.delete(
  '/:workspaceId/invitations/:invitationId',
  requireAuth,
  ...invitationsController.revoke,
);

workspacesRouter.get('/:workspaceId', requireAuth, ...workspaceController.get);
