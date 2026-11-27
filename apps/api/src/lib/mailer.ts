import { env } from '../config/env.js';

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

function verificationLink(token: string): string {
  return `${env.APP_PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetLink(token: string): string {
  return `${env.APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

const consoleMailer: Mailer = {
  sendVerificationEmail: (to, token) => {
    console.info(`[mail:console] verification link for ${to}: ${verificationLink(token)}`);
    return Promise.resolve();
  },
  sendPasswordResetEmail: (to, token) => {
    console.info(`[mail:console] password reset link for ${to}: ${resetLink(token)}`);
    return Promise.resolve();
  },
};

const disabledMailer: Mailer = {
  sendVerificationEmail: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
};

async function sendSmtpMail(to: string, subject: string, text: string): Promise<void> {
  const imported = (await import('nodemailer')) as unknown;
  const nodemailer = imported as {
    createTransport: (config: unknown) => { sendMail: (mail: unknown) => Promise<unknown> };
  };

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: (env.SMTP_PORT ?? 0) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
  });
}

const smtpMailer: Mailer = {
  sendVerificationEmail: (to, token) =>
    sendSmtpMail(
      to,
      'Verify your TaskForge email',
      `Open this link to verify your email: ${verificationLink(token)}`,
    ),
  sendPasswordResetEmail: (to, token) =>
    sendSmtpMail(
      to,
      'Reset your TaskForge password',
      `Open this link to reset your password: ${resetLink(token)}`,
    ),
};

export function createMailer(): Mailer {
  if (env.MAIL_PROVIDER === 'console') return consoleMailer;
  if (env.MAIL_PROVIDER === 'disabled') return disabledMailer;
  return smtpMailer;
}

export const mailer = createMailer();
