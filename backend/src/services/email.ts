import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const fromName = process.env.EMAIL_FROM_NAME ?? 'Oakstone 1 Bank';

async function send(to: string, subject: string, html: string, text: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email:fallback] To:${to} | ${subject}\n${text}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${from}>`,
      to,
      subject,
      html,
      text,
    });
    if (error) console.error('[Email] Resend error:', error);
  } catch (e: any) {
    console.error('[Email] Exception:', e.message);
  }
}

function brandShell(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#1F6B4A;padding:24px 32px;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Oakstone 1 Bank</h1>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1F6B4A;margin:0 0 16px;">${title}</h2>
        ${body}
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;font-size:12px;color:#888;">
        &copy; ${new Date().getFullYear()} Oakstone 1 Bank. This is a prototype system.
      </div>
    </div>`;
}

export async function sendLoginCode(to: string, code: string): Promise<void> {
  const html = brandShell('Your sign-in code',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Use the code below to complete your sign-in to Oakstone 1 Bank.</p>
     <div style="text-align:center;margin:24px 0;">
       <div style="display:inline-block;background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:18px 32px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;color:#1F6B4A;font-weight:700;">${code}</div>
     </div>
     <p style="font-size:14px;line-height:1.6;margin:0;color:#6b6a60;">This code expires in 10 minutes. If you did not try to sign in, please change your password immediately.</p>`
  );
  const text = `Your Oakstone 1 Bank sign-in code is: ${code}\n\nThis code expires in 10 minutes. If you did not try to sign in, change your password.`;
  await send(to, `${code} is your Oakstone 1 Bank sign-in code`, html, text);
}

export async function sendVerificationEmail(to: string, firstName: string, verifyUrl: string): Promise<void> {
  const html = brandShell('Verify your email',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Please verify your email address to activate your Oakstone 1 Bank account.</p>
     <div style="text-align:center;margin:24px 0;">
       <a href="${verifyUrl}" style="background:#1F6B4A;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Verify Email</a>
     </div>
     <p style="font-size:14px;color:#6b6a60;">This link expires in 24 hours.</p>`
  );
  const text = `Hi ${firstName},\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`;
  await send(to, 'Verify your Oakstone 1 Bank email', html, text);
}

export async function sendEmailVerification(to: string, firstName: string, verifyUrl: string): Promise<void> {
  await sendVerificationEmail(to, firstName, verifyUrl);
}

export async function sendKycApprovedEmail(to: string, firstName: string): Promise<void> {
  const html = brandShell('Your application has been approved',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We are pleased to inform you that your Oakstone 1 Bank application has been approved.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Most applications are reviewed within one business day. We will notify you as soon as a decision has been made. No further action is required from you at this time.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">With appreciation,</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstone 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nYour Oakstone 1 Bank application has been approved.\n\nThe Oakstone 1 Bank Team`;
  await send(to, 'Your Oakstone 1 Bank application has been approved', html, text);
}

export async function sendApplicationApproved(to: string, firstName: string): Promise<void> {
  await sendKycApprovedEmail(to, firstName);
}

export async function sendKycRejectedEmail(to: string, firstName: string, reason?: string): Promise<void> {
  const reasonBlock = reason ? `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>Reason:</strong> ${reason}</p>` : '';
  const html = brandShell('An update on your application',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">After review, we are unable to approve your Oakstone 1 Bank application at this time.</p>
     ${reasonBlock}
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">If you believe this decision was made in error or you would like to provide additional information, please contact our support team.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">Respectfully,</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstone 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nAfter review, we are unable to approve your Oakstone 1 Bank application at this time.${reason ? '\n\nReason: ' + reason : ''}\n\nThe Oakstone 1 Bank Team`;
  await send(to, 'An update on your Oakstone 1 Bank application', html, text);
}

export async function sendApplicationRejected(to: string, firstName: string, reason?: string): Promise<void> {
  await sendKycRejectedEmail(to, firstName, reason);
}

export async function sendApplicationConfirmation(to: string, firstName: string): Promise<void> {
  const html = brandShell('Application received',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for applying to Oakstone 1 Bank. We have received your application and will review it shortly.</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstone 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nThank you for applying to Oakstone 1 Bank. We have received your application.\n\nThe Oakstone 1 Bank Team`;
  await send(to, 'Your Oakstone 1 Bank application has been received', html, text);
}

export async function sendPasswordReset(to: string, firstNameOrUrl: string, resetUrl?: string): Promise<void> {
  const actualUrl = resetUrl ?? firstNameOrUrl;
  const firstName = resetUrl ? firstNameOrUrl : 'there';
  const html = brandShell('Reset your password',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Click the button below to reset your password. This link expires in 1 hour.</p>
     <div style="text-align:center;margin:24px 0;">
       <a href="${actualUrl}" style="background:#1F6B4A;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Reset Password</a>
     </div>
     <p style="font-size:14px;color:#6b6a60;">If you did not request a password reset, ignore this email.</p>`
  );
  const text = `Hi ${firstName},\n\nReset your password: ${actualUrl}\n\nThis link expires in 1 hour.`;
  await send(to, 'Reset your Oakstone 1 Bank password', html, text);
}