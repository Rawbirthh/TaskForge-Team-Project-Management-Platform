import { z } from 'zod';

export const membershipIdParamSchema = z.object({
  membershipId: z.string().min(1).max(64),
});

export const workspaceMemberParamsSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  membershipId: z.string().min(1).max(64),
});

export const invitationIdParamSchema = z.object({
  invitationId: z.string().min(1).max(64),
});

export const workspaceInvitationParamsSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  invitationId: z.string().min(1).max(64),
});

export const updateMemberSchema = z
  .object({
    role: z.enum(['ADMIN', 'MEMBER', 'GUEST']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: 'At least one of role or status is required',
  });

export const memberListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'REMOVED']).optional(),
  q: z.string().trim().max(100).optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']),
});

export const invitationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']).optional(),
  q: z.string().trim().max(254).optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1).max(256),
});

export const declineInvitationSchema = z.object({
  token: z.string().min(1).max(256),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type MemberListQueryInput = z.infer<typeof memberListQuerySchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type InvitationListQueryInput = z.infer<typeof invitationListQuerySchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type DeclineInvitationInput = z.infer<typeof declineInvitationSchema>;
