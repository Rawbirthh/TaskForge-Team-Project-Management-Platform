import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { getRequestId } from '../lib/request-id.js';
import { workspaceController } from '../controllers/workspace.controller.js';
import { membersController } from '../controllers/members.controller.js';
import { invitationsController } from '../controllers/invitations.controller.js';
import { requireAuth } from '../middleware/auth.js';

const ownershipTransferRateLimiter = rateLimit({
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

export const workspacesRouter = Router();

workspacesRouter.post('/', requireAuth, ...workspaceController.create);
workspacesRouter.get('/', requireAuth, ...workspaceController.list);
workspacesRouter.get('/slug-availability', requireAuth, ...workspaceController.slugAvailability);

// Settings
workspacesRouter.patch('/:workspaceId', requireAuth, ...workspaceController.update);
workspacesRouter.post(
  '/:workspaceId/ownership/transfer',
  ownershipTransferRateLimiter,
  requireAuth,
  ...workspaceController.transferOwnership,
);

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
