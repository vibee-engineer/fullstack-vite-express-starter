/**
 * resend.ts — the Resend email driver over its HTTP API.
 *
 * Zero dependency on purpose: Resend's send endpoint is one JSON POST, so a
 * `fetch` beats pulling in their SDK. `fetch` is injectable for tests. Get a key
 * at resend.com, verify a sender domain, then EMAIL_DRIVER=resend +
 * RESEND_API_KEY + EMAIL_FROM.
 */

import {
  assertValidMessage,
  recipients,
  type EmailMessage,
  type EmailSender,
  type SentEmail,
} from './message';

type FetchFn = typeof fetch;

const ENDPOINT = 'https://api.resend.com/emails';

export interface ResendConfig {
  apiKey: string;
  defaultFrom: string;
  fetchFn?: FetchFn;
}

export class ResendEmailDriver implements EmailSender {
  private readonly apiKey: string;
  private readonly defaultFrom: string;
  private readonly fetchFn: FetchFn;

  constructor(config: ResendConfig) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.defaultFrom;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async send(message: EmailMessage): Promise<SentEmail> {
    assertValidMessage(message);
    const body: Record<string, unknown> = {
      from: message.from ?? this.defaultFrom,
      to: recipients(message.to),
      subject: message.subject,
    };
    if (message.html) body.html = message.html;
    if (message.text) body.text = message.text;
    if (message.replyTo) body.reply_to = message.replyTo;

    const res = await this.fetchFn(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend send failed (${res.status}): ${detail.slice(0, 500)}`);
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: json.id };
  }
}
