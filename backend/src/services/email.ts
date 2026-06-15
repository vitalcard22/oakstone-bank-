// Email service — sends via SendGrid's REST API using global fetch (no extra dependency).
// Requires env vars: SENDGRID_API_KEY, EMAIL_FROM, and optional EMAIL_FROM_NAME, FRONTEND_URL.
// If SENDGRID_API_KEY is not set, emails are logged to console instead (safe fallback).

const API_URL = 'https://api.sendgrid.com/v3/mail/send';

function brandShell(title: string, bodyHtml: string): string {
  const logo = (process.env.FRONTEND_URL ?? '') + '/logo.png';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style="margin:0;background:#f4f7f5;font-family:Georgia,'Times New Roman',serif;color:#33322C;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">
          <tr><td style="background:linear-gradient(135deg,#1F6B4A,#16513A);padding:28px 32px;text-align:center;">
            <img src="${logo}" alt="Oakstone 1 Bank" width="48" height="48" style="display:inline-block;vertical-align:middle;"/>
            <div style="color:#ffffff;font-size:22px;font-weight:600;margin-top:8px;letter-spacing:.02em;">Oakstone 1 Bank</div>
            <div style="color:#F5D08A;font-size:11px;letter-spacing:.28em;text-transform:uppercase;margin-top:4px;">Established MCMXIV</div>
          </td></tr>
          <tr><td style="padding:34px 36px;">
            <h1 style="color:#1F6B4A;font-size:24px;margin:0 0 16px;">${title}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="background:#16513A;padding:20px 36px;text-align:center;">
            <div style="color:rgba(255,255,255,.75);font-size:12px;">© 2000–2026 Oakstone 1 Bank · Member FDIC</div>
          </td></tr>
        </table>
        <div style="color:#9a988c;font-size:11px;margin-top:16px;">This message was sent by Oakstone 1 Bank. Please do not reply to this email.</div>
      </td></tr>
    </table>
  </body></html>`;
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Oakstone 1 Bank';

  // Safe fallback: if not configured, log instead of failing the request.
  if (!apiKey || !from) {
    console.log(`[Email:fallback] To:${to} | ${subject}\n${text}`);
    return;
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[Email] SendGrid error ${res.status}: ${detail}`);
    }
  } catch (e: any) {
    console.error('[Email] Send failed:', e.message);
  }
}

export async function sendApplicationConfirmation(to: string, firstName: string): Promise<void> {
  const html = brandShell(
    'Application received',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for applying to open an account with Oakstone 1 Bank. We have received your application and our team has begun reviewing your details.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Most applications are reviewed within one business day. We will notify you as soon as a decision has been made. No further action is required from you at this time.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">With appreciation,</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstone 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nThank you for applying to open an account with Oakstone 1 Bank. We have received your application and our team has begun reviewing your details. Most applications are reviewed within one business day.\n\nThe Oakstone 1 Bank Team`;
  await send(to, 'Your Oakstone 1 Bank application has been received', html, text);
}

export async function sendPasswordReset(to: string, resetUrl: string): Promise<void> {
  const html = brandShell(
    'Reset your password',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We received a request to reset the password for your Oakstone 1 Bank account.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Click the button below to choose a new password. This link will expire in one hour.</p>
     <p style="text-align:center;margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#2E8B5E,#1F6B4A);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;letter-spacing:.05em;">Reset Password</a></p>
     <p style="font-size:14px;line-height:1.6;margin:0;color:#6b6a60;">If you didn't request this, you can safely ignore this email — your password will remain unchanged.</p>`
  );
  const text = `Reset your Oakstone 1 Bank password using this link (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
  await send(to, 'Reset your Oakstone 1 Bank password', html, text);
}
