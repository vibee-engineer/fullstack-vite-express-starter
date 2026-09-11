/**
 * email.test.ts — message validation, all three drivers (with injected fetch /
 * SES client so nothing touches the network), templates, and the factory.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { JobLogger } from '../../jobs/scheduler';
import { assertValidMessage, recipients } from '../message';
import { LogEmailDriver } from '../logDriver';
import { ResendEmailDriver } from '../resend';
import { SesEmailDriver, type SesClientLike } from '../ses';
import { esc, layout, welcomeEmail } from '../templates';
import { getEmailSender, setEmailSender, sendEmail } from '../index';

function spyLogger(): JobLogger & { infos: unknown[] } {
  const infos: unknown[] = [];
  return { infos, info: (o) => infos.push(o), error: () => {} };
}

afterEach(() => setEmailSender(null));

describe('message validation', () => {
  it('normalizes recipients to a trimmed, non-empty array', () => {
    expect(recipients('a@x.com')).toEqual(['a@x.com']);
    expect(recipients([' a@x.com ', '', 'b@x.com'])).toEqual(['a@x.com', 'b@x.com']);
  });

  it('rejects a message with no recipients / subject / body', () => {
    expect(() => assertValidMessage({ to: [], subject: 's', text: 't' })).toThrow(/recipient/i);
    expect(() => assertValidMessage({ to: 'a@x.com', subject: '  ', text: 't' })).toThrow(
      /subject/i,
    );
    expect(() => assertValidMessage({ to: 'a@x.com', subject: 's' })).toThrow(/body/i);
  });

  it('accepts a valid message', () => {
    expect(() =>
      assertValidMessage({ to: 'a@x.com', subject: 's', html: '<p>h</p>' }),
    ).not.toThrow();
  });
});

describe('LogEmailDriver', () => {
  it('validates, logs, and returns an empty result (no id)', async () => {
    const logger = spyLogger();
    const driver = new LogEmailDriver(logger);
    const res = await driver.send({ to: 'a@x.com', subject: 'Hi', text: 'body' });
    expect(res).toEqual({});
    expect(logger.infos).toHaveLength(1);
  });

  it('throws on an invalid message instead of silently logging nothing', async () => {
    const driver = new LogEmailDriver(spyLogger());
    await expect(driver.send({ to: '', subject: 'x', text: 'y' })).rejects.toThrow();
  });
});

describe('ResendEmailDriver', () => {
  it('POSTs the right endpoint/headers/body and returns the id', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 're_123' }),
      text: async () => '',
    })) as unknown as typeof fetch;

    const driver = new ResendEmailDriver({
      apiKey: 'key_abc',
      defaultFrom: 'App <hi@app.com>',
      fetchFn,
    });
    const res = await driver.send({
      to: 'a@x.com',
      subject: 'Hi',
      html: '<p>h</p>',
      text: 't',
      replyTo: 'reply@app.com',
    });

    expect(res).toEqual({ id: 're_123' });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const [url, init] = call as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer key_abc');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: 'App <hi@app.com>',
      to: ['a@x.com'],
      subject: 'Hi',
      html: '<p>h</p>',
      text: 't',
      reply_to: 'reply@app.com',
    });
  });

  it('lets an explicit from override the default', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'x' }),
      text: async () => '',
    })) as unknown as typeof fetch;
    const driver = new ResendEmailDriver({ apiKey: 'k', defaultFrom: 'default@app.com', fetchFn });
    await driver.send({ to: 'a@x.com', subject: 's', text: 't', from: 'custom@app.com' });
    const call = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.from).toBe('custom@app.com');
  });

  it('throws with the provider status + detail on a non-2xx response', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({}),
      text: async () => 'domain not verified',
    })) as unknown as typeof fetch;
    const driver = new ResendEmailDriver({ apiKey: 'k', defaultFrom: 'd@app.com', fetchFn });
    await expect(driver.send({ to: 'a@x.com', subject: 's', text: 't' })).rejects.toThrow(
      /422.*domain not verified/,
    );
  });

  it('validates before hitting the network', async () => {
    const fetchFn = vi.fn();
    const driver = new ResendEmailDriver({
      apiKey: 'k',
      defaultFrom: 'd@app.com',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(driver.send({ to: 'a@x.com', subject: 's' })).rejects.toThrow(/body/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('SesEmailDriver', () => {
  it('maps the message onto a SendEmailCommand and returns the MessageId', async () => {
    const sent: unknown[] = [];
    const client: SesClientLike = {
      async send(command) {
        sent.push(command);
        return { MessageId: 'ses-999' };
      },
    };
    // Fake command just captures its input.
    class FakeSendEmailCommand {
      constructor(public input: unknown) {}
    }
    const driver = new SesEmailDriver({
      region: 'us-east-1',
      defaultFrom: 'from@app.com',
      loadClient: async () => ({ client, SendEmailCommand: FakeSendEmailCommand }),
    });

    const res = await driver.send({
      to: ['a@x.com', 'b@x.com'],
      subject: 'Hi',
      html: '<p>h</p>',
      text: 't',
      replyTo: 'r@app.com',
    });

    expect(res).toEqual({ id: 'ses-999' });
    const input = (sent[0] as FakeSendEmailCommand).input as Record<string, any>;
    expect(input.FromEmailAddress).toBe('from@app.com');
    expect(input.Destination.ToAddresses).toEqual(['a@x.com', 'b@x.com']);
    expect(input.ReplyToAddresses).toEqual(['r@app.com']);
    expect(input.Content.Simple.Subject.Data).toBe('Hi');
    expect(input.Content.Simple.Body.Html.Data).toBe('<p>h</p>');
    expect(input.Content.Simple.Body.Text.Data).toBe('t');
  });

  it('gives a helpful error when the SDK is not installed (default loader)', async () => {
    const driver = new SesEmailDriver({ region: 'us-east-1', defaultFrom: 'f@app.com' });
    await expect(driver.send({ to: 'a@x.com', subject: 's', text: 't' })).rejects.toThrow(
      /@aws-sdk\/client-sesv2 is not installed/,
    );
  });
});

describe('templates', () => {
  it('esc escapes html metacharacters', () => {
    expect(esc(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('layout wraps body html in a full document', () => {
    const out = layout('<p>hi</p>');
    expect(out).toContain('<!doctype html>');
    expect(out).toContain('<p>hi</p>');
  });

  it('welcomeEmail renders subject + html + text, with and without a name', () => {
    const named = welcomeEmail({ name: 'Ann', appName: 'Acme' });
    expect(named.subject).toBe('Welcome to Acme');
    expect(named.html).toContain('Hi Ann,');
    expect(named.text).toContain('Hi Ann,');
    expect(named.html).toContain('Acme');

    const anon = welcomeEmail({ name: null, appName: 'Acme' });
    expect(anon.html).toContain('Hi there,');
    expect(anon.text).toContain('Hi there,');
  });

  it('escapes a name with html metacharacters', () => {
    const out = welcomeEmail({ name: '<script>', appName: 'Acme' });
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.html).not.toContain('<script>');
  });
});

describe('factory', () => {
  it('defaults to the log driver and is memoized', () => {
    const a = getEmailSender();
    const b = getEmailSender();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(LogEmailDriver);
  });

  it('sendEmail routes through the swapped-in sender', async () => {
    const calls: unknown[] = [];
    setEmailSender({
      send: async (m) => {
        calls.push(m);
        return { id: 'stub' };
      },
    });
    const res = await sendEmail({ to: 'a@x.com', subject: 's', text: 't' });
    expect(res).toEqual({ id: 'stub' });
    expect(calls).toHaveLength(1);
  });
});
