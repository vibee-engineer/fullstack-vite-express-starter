/**
 * templates.ts — THE REFERENCE EMAIL TEMPLATE. Copy `welcomeEmail` per email.
 *
 * A template is a pure function: data in, `{ subject, html, text }` out. Always
 * return BOTH html and text — text is what keeps you out of spam folders and is
 * what plain-text clients show. `layout()` wraps body html in a minimal,
 * inline-styled shell (email clients ignore <style> tags and external CSS, so
 * every style must be inline).
 *
 * Keep interpolated user data escaped: `esc()` guards against a stray `<` in a
 * name breaking the markup. Never drop unescaped user input into html.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Minimal HTML escape for interpolated values. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap body html in a plain, inline-styled shell that renders everywhere. */
export function layout(bodyHtml: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>',
    '<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">',
    '<tr><td align="center">',
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;max-width:480px;">',
    `<tr><td style="color:#18181b;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');
}

/**
 * Welcome email — the reference template. Sent after signup (typically via
 * `runner.enqueue(...)` so the response doesn't wait on the provider).
 */
export function welcomeEmail(params: { name?: string | null; appName: string }): RenderedEmail {
  const greeting = params.name ? `Hi ${esc(params.name)},` : 'Hi there,';
  const app = esc(params.appName);
  return {
    subject: `Welcome to ${params.appName}`,
    html: layout(
      `<p style="margin:0 0 16px;">${greeting}</p>` +
        `<p style="margin:0 0 16px;">Thanks for signing up for <strong>${app}</strong>. ` +
        `Your account is ready — you can log in any time.</p>` +
        `<p style="margin:0;color:#71717a;font-size:13px;">If you didn't create this account, you can ignore this email.</p>`,
    ),
    text:
      `${params.name ? `Hi ${params.name},` : 'Hi there,'}\n\n` +
      `Thanks for signing up for ${params.appName}. Your account is ready — ` +
      `you can log in any time.\n\n` +
      `If you didn't create this account, you can ignore this email.`,
  };
}
