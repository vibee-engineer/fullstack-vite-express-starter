/**
 * message.ts — the email seam's shared types + validation.
 *
 * Every driver (log / resend / ses) takes the same `EmailMessage` and returns
 * the same `SentEmail`, so switching providers is a one-line env change.
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  /** HTML body. At least one of html/text must be present. */
  html?: string;
  /** Plain-text body (recommended alongside html for deliverability). */
  text?: string;
  /** Overrides the default From (env EMAIL_FROM). */
  from?: string;
  replyTo?: string;
}

export interface SentEmail {
  /** Provider message id when available (resend/ses); undefined for the log driver. */
  id?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<SentEmail>;
}

/** Normalize recipients to a non-empty array. */
export function recipients(to: string | string[]): string[] {
  return (Array.isArray(to) ? to : [to]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Validate a message before a driver touches the network. Throws on a bad
 * message so a provider never rejects a half-formed request (and a log-driver
 * dev never ships an email with no body).
 */
export function assertValidMessage(message: EmailMessage): void {
  if (recipients(message.to).length === 0) {
    throw new Error('Email has no recipients.');
  }
  if (!message.subject || !message.subject.trim()) {
    throw new Error('Email has no subject.');
  }
  if (!message.html && !message.text) {
    throw new Error('Email has no body (set html and/or text).');
  }
}
