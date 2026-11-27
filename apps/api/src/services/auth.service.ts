import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  signAccessToken,
  verifyAccessToken,
} from '../lib/tokens.js';
import { mailer } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function resetExpiry(): Date {
  return new Date(Date.now() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

function verificationExpiry(): Date {
  return new Date(Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName?: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName ?? input.email.split('@')[0] ?? 'User';
  const refresh = generateOpaqueToken();
  const verification = generateOpaqueToken();

  let result: {
    user: {
      id: string;
      email: string;
      displayName: string;
      emailVerifiedAt: Date | null;
      createdAt: Date;
    };
    sessionId: string;
  };
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
      });

      const session = await tx.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: refresh.hash,
          expiresAt: refreshExpiry(),
          userAgent: input.userAgent ?? null,
          ipAddress: input.ipAddress ?? null,
        },
        select: { id: true },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verification.hash,
          expiresAt: verificationExpiry(),
        },
      });

      return { user, sessionId: session.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
    }
    throw error;
  }

  const accessToken = await signAccessToken({
    userId: result.user.id,
    sessionId: result.sessionId,
  });

  // Send verification email after commit.
  void mailer.sendVerificationEmail(result.user.email, verification.raw).catch((error) => {
    logger.error({ err: error }, 'Failed to send verification email');
  });

  return {
    accessToken,
    refreshToken: refresh.raw,
    user: toPublicUser(result.user),
  };
}

export async function loginUser(input: {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      displayName: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const refresh = generateOpaqueToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: refresh.hash,
      expiresAt: refreshExpiry(),
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
    },
  });

  const accessToken = await signAccessToken({ userId: user.id, sessionId: session.id });

  return {
    accessToken,
    refreshToken: refresh.raw,
    user: toPublicUser(user),
  };
}

export async function refreshSession(input: {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<RefreshResult> {
  const hash = hashOpaqueToken(input.refreshToken);

  const reusedSession = await prisma.session.findFirst({
    where: { previousRefreshTokenHash: hash },
    select: { id: true },
  });
  if (reusedSession) {
    await prisma.session.updateMany({
      where: { id: reusedSession.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
  }

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!session) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }
  if (session.revokedAt) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Session expired');
  }

  const refresh = generateOpaqueToken();
  const updated = await prisma.session.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: hash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      previousRefreshTokenHash: hash,
      refreshTokenHash: refresh.hash,
      rotatedAt: new Date(),
      expiresAt: refreshExpiry(),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
    },
  });

  if (updated.count !== 1) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Refresh token reuse detected');
  }

  const accessToken = await signAccessToken({ userId: session.userId, sessionId: session.id });
  return { accessToken, refreshToken: refresh.raw };
}

export async function logoutSession(input: {
  sessionId?: string;
  userId?: string;
  refreshToken?: string;
}): Promise<void> {
  if (input.sessionId && input.userId) {
    await prisma.session.updateMany({
      where: { id: input.sessionId, userId: input.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return;
  }

  if (input.refreshToken) {
    const hash = hashOpaqueToken(input.refreshToken);
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export async function authenticateAccessToken(
  token: string,
): Promise<{ userId: string; sessionId: string }> {
  let claims: { userId: string; sessionId: string };
  try {
    claims = await verifyAccessToken(token);
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid access token');
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }

  const session = await prisma.session.findUnique({
    where: { id: claims.sessionId },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true },
  });

  if (!session || session.userId !== claims.userId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  if (session.revokedAt) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Session revoked');
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Session expired');
  }

  return { userId: claims.userId, sessionId: claims.sessionId };
}

export async function requestPasswordReset(input: { email: string }): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true },
  });

  if (!user) return;

  const token = generateOpaqueToken();
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: resetExpiry(),
    },
  });

  void mailer.sendPasswordResetEmail(user.email, token.raw).catch((error) => {
    logger.error({ err: error }, 'Failed to send password reset email');
  });
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const hash = hashOpaqueToken(input.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Invalid or expired reset token');
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await tx.session.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function verifyEmail(input: { token: string }): Promise<void> {
  const hash = hashOpaqueToken(input.token);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError(400, 'INVALID_VERIFICATION_TOKEN', 'Invalid or expired verification token');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerifiedAt: new Date() },
    });

    await tx.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });
  });
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }
  if (user.emailVerifiedAt) {
    return;
  }

  const token = generateOpaqueToken();
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: verificationExpiry(),
    },
  });

  void mailer.sendVerificationEmail(user.email, token.raw).catch((error) => {
    logger.error({ err: error }, 'Failed to send verification email');
  });
}

export async function getPublicUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid session');
  }

  return toPublicUser(user);
}
