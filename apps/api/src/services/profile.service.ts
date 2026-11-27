import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { generateOpaqueToken, hashOpaqueToken } from '../lib/tokens.js';
import { mailer } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { Prisma } from '../generated/prisma/client.js';

const profileSelect = {
  id: true,
  email: true,
  displayName: true,
  timeZone: true,
  locale: true,
  avatarUrl: true,
  pendingEmail: true,
  emailVerifiedAt: true,
  deactivatedAt: true,
  deletionRequestedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ProfileUser {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
  locale: string | null;
  avatarUrl: string | null;
  pendingEmail: string | null;
  emailVerifiedAt: string | null;
  deactivatedAt: string | null;
  deletionRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}

export interface SessionPage {
  sessions: SessionSummary[];
  nextCursor: string | null;
}

function toProfileUser(user: {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
  locale: string | null;
  avatarUrl: string | null;
  pendingEmail: string | null;
  emailVerifiedAt: Date | null;
  deactivatedAt: Date | null;
  deletionRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProfileUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    timeZone: user.timeZone,
    locale: user.locale,
    avatarUrl: user.avatarUrl,
    pendingEmail: user.pendingEmail,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    deactivatedAt: user.deactivatedAt ? user.deactivatedAt.toISOString() : null,
    deletionRequestedAt: user.deletionRequestedAt ? user.deletionRequestedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function ensureActive(user: {
  deactivatedAt: Date | null;
  deletionRequestedAt: Date | null;
}): void {
  if (user.deactivatedAt || user.deletionRequestedAt) {
    throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Account is deactivated');
  }
}

function emailChangeExpiry(): Date {
  return new Date(Date.now() + env.EMAIL_CHANGE_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export async function getProfile(userId: string): Promise<ProfileUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: profileSelect,
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }

  ensureActive(user);
  return toProfileUser(user);
}

export async function updateProfile(
  userId: string,
  input: {
    displayName?: string;
    timeZone?: string;
    locale?: string | null;
    avatarUrl?: string | null;
  },
): Promise<ProfileUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deactivatedAt: true, deletionRequestedAt: true },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  ensureActive(user);

  const data: {
    displayName?: string;
    timeZone?: string;
    locale?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.timeZone !== undefined) data.timeZone = input.timeZone;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: profileSelect,
  });

  return toProfileUser(updated);
}

export async function requestEmailChange(userId: string, newEmail: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      deactivatedAt: true,
      deletionRequestedAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  ensureActive(user);

  if (newEmail === user.email) {
    // Generic success to avoid enumeration; do nothing.
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const pendingOwner = await prisma.user.findFirst({
    where: { pendingEmail: newEmail },
    select: { id: true },
  });
  if (pendingOwner && pendingOwner.id !== userId) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const token = generateOpaqueToken();

  await prisma.$transaction(async (tx) => {
    await tx.emailChangeToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.user.update({
      where: { id: userId },
      data: { pendingEmail: newEmail },
    });

    await tx.emailChangeToken.create({
      data: {
        userId,
        newEmail,
        tokenHash: token.hash,
        expiresAt: emailChangeExpiry(),
      },
    });
  });

  void mailer.sendEmailChangeEmail(newEmail, token.raw).catch((error) => {
    logger.error({ err: error }, 'Failed to send email change verification email');
  });
}

export async function verifyEmailChange(tokenRaw: string): Promise<void> {
  const hash = hashOpaqueToken(tokenRaw);
  const record = await prisma.emailChangeToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, newEmail: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, 'INVALID_EMAIL_CHANGE_TOKEN', 'Invalid or expired email change token');
  }

  await prisma.$transaction(async (tx) => {
    const current = await tx.emailChangeToken.findUnique({
      where: { tokenHash: hash },
      select: { id: true, userId: true, newEmail: true, expiresAt: true, usedAt: true },
    });

    if (!current || current.usedAt || current.expiresAt.getTime() <= Date.now()) {
      throw new AppError(
        400,
        'INVALID_EMAIL_CHANGE_TOKEN',
        'Invalid or expired email change token',
      );
    }

    const user = await tx.user.findUnique({
      where: { id: current.userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new AppError(
        400,
        'INVALID_EMAIL_CHANGE_TOKEN',
        'Invalid or expired email change token',
      );
    }

    // Ensure the target email is still available.
    const conflict = await tx.user.findFirst({
      where: { email: current.newEmail, id: { not: current.userId } },
      select: { id: true },
    });
    if (conflict) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }

    await tx.user.update({
      where: { id: current.userId },
      data: {
        email: current.newEmail,
        pendingEmail: null,
        emailVerifiedAt: new Date(),
      },
    });

    await tx.emailChangeToken.update({
      where: { id: current.id },
      data: { usedAt: new Date() },
    });

    await tx.session.updateMany({
      where: { userId: current.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      deactivatedAt: true,
      deletionRequestedAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  ensureActive(user);

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new AppError(400, 'VALIDATION_ERROR', 'New password must differ from current password');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function listSessions(
  userId: string,
  currentSessionId: string,
  options: { cursor?: string | undefined; limit: number },
): Promise<SessionPage> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentSessions: Prisma.SessionWhereInput = {
    OR: [{ revokedAt: null }, { revokedAt: { gte: thirtyDaysAgo } }],
  };

  let cursorSession: { id: string; createdAt: Date } | null = null;
  if (options.cursor) {
    cursorSession = await prisma.session.findFirst({
      where: { id: options.cursor, userId },
      select: { id: true, createdAt: true },
    });
    if (!cursorSession) {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
    }
  }

  const where: Prisma.SessionWhereInput = cursorSession
    ? {
        userId,
        AND: [
          recentSessions,
          {
            OR: [
              { createdAt: { lt: cursorSession.createdAt } },
              { createdAt: cursorSession.createdAt, id: { lt: cursorSession.id } },
            ],
          },
        ],
      }
    : { userId, ...recentSessions };

  const sessions = await prisma.session.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      userAgent: true,
      ipAddress: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit + 1,
  });

  const hasMore = sessions.length > options.limit;
  const page = hasMore ? sessions.slice(0, options.limit) : sessions;

  return {
    sessions: page.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      current: session.id === currentSessionId,
    })),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!session || session.userId !== userId) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');
  }

  if (session.revokedAt) {
    return;
  }

  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function deactivateAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deactivatedAt: true, deletionRequestedAt: true },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }

  if (user.deactivatedAt) {
    throw new AppError(409, 'ACCOUNT_ALREADY_DEACTIVATED', 'Account is already deactivated');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deactivatedAt: new Date() },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function requestDeletion(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, deletionRequestedAt: true },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }

  if (user.deletionRequestedAt) {
    throw new AppError(409, 'DELETION_ALREADY_REQUESTED', 'Deletion already requested');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date() },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
