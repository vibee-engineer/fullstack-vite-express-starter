/**
 * ses.ts — the AWS SES (v2) email driver.
 *
 * Like the S3 driver, the AWS SDK is NOT a base dependency: it's loaded lazily
 * by a non-literal specifier so `@aws-sdk/client-sesv2` never bloats an app that
 * uses the log or resend driver. To use SES: `npm i @aws-sdk/client-sesv2 -w
 * server`, verify a sender identity, then EMAIL_DRIVER=ses + SES_REGION +
 * EMAIL_FROM. Credentials come from the standard AWS provider chain.
 *
 * `loadClient` is injectable so tests exercise the message-mapping without the
 * SDK installed or the network.
 */

import { assertValidMessage, recipients, type EmailMessage, type EmailSender, type SentEmail } from './message';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SesClientLike {
  send(command: unknown): Promise<{ MessageId?: string }>;
}

export interface SesConfig {
  region: string;
  defaultFrom: string;
  /** Test seam: returns a { client, SendEmailCommand } pair. Defaults to the SDK. */
  loadClient?: () => Promise<{ client: SesClientLike; SendEmailCommand: any }>;
}

async function defaultLoadClient(region: string): Promise<{ client: SesClientLike; SendEmailCommand: any }> {
  const moduleName = '@aws-sdk/client-sesv2';
  let mod: any;
  try {
    mod = await import(moduleName);
  } catch {
    throw new Error(
      'EMAIL_DRIVER=ses but @aws-sdk/client-sesv2 is not installed. ' +
        'Run `npm i @aws-sdk/client-sesv2 -w server`.',
    );
  }
  return { client: new mod.SESv2Client({ region }), SendEmailCommand: mod.SendEmailCommand };
}

export class SesEmailDriver implements EmailSender {
  private readonly region: string;
  private readonly defaultFrom: string;
  private readonly loadClient: () => Promise<{ client: SesClientLike; SendEmailCommand: any }>;
  private loaded: Promise<{ client: SesClientLike; SendEmailCommand: any }> | null = null;

  constructor(config: SesConfig) {
    this.region = config.region;
    this.defaultFrom = config.defaultFrom;
    this.loadClient = config.loadClient ?? (() => defaultLoadClient(this.region));
  }

  private sdk() {
    if (!this.loaded) this.loaded = this.loadClient();
    return this.loaded;
  }

  async send(message: EmailMessage): Promise<SentEmail> {
    assertValidMessage(message);
    const { client, SendEmailCommand } = await this.sdk();

    const body: Record<string, unknown> = {};
    if (message.html) body.Html = { Data: message.html };
    if (message.text) body.Text = { Data: message.text };

    const command = new SendEmailCommand({
      FromEmailAddress: message.from ?? this.defaultFrom,
      Destination: { ToAddresses: recipients(message.to) },
      ...(message.replyTo ? { ReplyToAddresses: [message.replyTo] } : {}),
      Content: { Simple: { Subject: { Data: message.subject }, Body: body } },
    });

    const res = await client.send(command);
    return { id: res.MessageId };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
