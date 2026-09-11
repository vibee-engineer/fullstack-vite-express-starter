/**
 * logDriver.ts — the default email driver: logs, never sends.
 *
 * This is what a fresh app runs on. It means email code paths (signup →
 * welcome email, etc.) work end-to-end in dev with zero configuration — you see
 * the message in the server log — and NOTHING is accidentally sent to a real
 * inbox before a provider + verified sender are configured. Flip EMAIL_DRIVER
 * to `resend` or `ses` to actually deliver.
 */

import type { JobLogger } from '../jobs/scheduler';
import { assertValidMessage, recipients, type EmailMessage, type EmailSender, type SentEmail } from './message';

export class LogEmailDriver implements EmailSender {
  constructor(private readonly logger: JobLogger) {}

  async send(message: EmailMessage): Promise<SentEmail> {
    assertValidMessage(message);
    this.logger.info(
      {
        to: recipients(message.to),
        from: message.from,
        subject: message.subject,
        hasHtml: Boolean(message.html),
        hasText: Boolean(message.text),
      },
      'email (log driver — not sent). Set EMAIL_DRIVER=resend|ses to deliver.',
    );
    return {};
  }
}
