/**
 * email — pick a driver from env and hand callers one `sendEmail`.
 *
 *   EMAIL_DRIVER=log     → logs, never sends (default; safe in dev)
 *   EMAIL_DRIVER=resend  → Resend HTTP API (RESEND_API_KEY + EMAIL_FROM)
 *   EMAIL_DRIVER=ses     → AWS SES v2 (SES_REGION + EMAIL_FROM; SDK lazy-loaded)
 *
 * ── How the agent should use this ──────────────────────────────────────────
 * Email is almost always fire-and-forget — don't make a user wait on an SMTP
 * round-trip. Send from a background job:
 *
 *   import { runner } from '../services/jobs';
 *   import { sendEmail } from '../services/email';
 *   import { welcomeEmail } from '../services/email/templates';
 *
 *   const mail = welcomeEmail({ name: user.name, appName: 'Acme' });
 *   runner.enqueue('welcome-email', () => sendEmail({ to: user.email, ...mail }));
 *
 * Templates live in ./templates.ts — copy `welcomeEmail` for each new email.
 */

import { env } from '../../env';
import { logger } from '../../logger';
import { LogEmailDriver } from './logDriver';
import type { EmailMessage, EmailSender, SentEmail } from './message';
import { ResendEmailDriver } from './resend';
import { SesEmailDriver } from './ses';

export * from './message';
export * from './templates';
export { LogEmailDriver } from './logDriver';
export { ResendEmailDriver } from './resend';
export { SesEmailDriver } from './ses';

let cached: EmailSender | null = null;

function build(): EmailSender {
  const defaultFrom = env.EMAIL_FROM ?? 'onboarding@example.com';
  switch (env.EMAIL_DRIVER) {
    case 'resend':
      // Presence guaranteed by the env refine when EMAIL_DRIVER=resend.
      return new ResendEmailDriver({ apiKey: env.RESEND_API_KEY as string, defaultFrom });
    case 'ses':
      return new SesEmailDriver({ region: env.SES_REGION as string, defaultFrom });
    default:
      return new LogEmailDriver(logger);
  }
}

/** Memoized sender selected by env. */
export function getEmailSender(): EmailSender {
  if (!cached) cached = build();
  return cached;
}

/** Test/dev hook — swap the active sender. Pass `null` to reset. */
export function setEmailSender(sender: EmailSender | null): void {
  cached = sender;
}

/** Send an email through the configured driver. */
export function sendEmail(message: EmailMessage): Promise<SentEmail> {
  return getEmailSender().send(message);
}
