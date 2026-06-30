import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const fromName = process.env.EMAIL_FROM_NAME ?? 'Oakstones 1 Bank';
const replyTo = process.env.EMAIL_REPLY_TO || 'support@oakstones1.com';

async function send(to: string, subject: string, html: string, text: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email:fallback] To:${to} | ${subject}\n${text}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: `${fromName} <${from}>`,
      replyTo,
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
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Oakstones 1 Bank</h1>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1F6B4A;margin:0 0 16px;">${title}</h2>
        ${body}
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;font-size:12px;color:#888;">
        &copy; ${new Date().getFullYear()} Oakstones 1 Bank. This is a prototype system.
      </div>
    </div>`;
}

export async function sendLoginCode(to: string, code: string): Promise<void> {
  const html = brandShell('Your sign-in code',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Use the code below to complete your sign-in to Oakstones 1 Bank.</p>
     <div style="text-align:center;margin:24px 0;">
       <div style="display:inline-block;background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:18px 32px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;color:#1F6B4A;font-weight:700;">${code}</div>
     </div>
     <p style="font-size:14px;line-height:1.6;margin:0;color:#6b6a60;">This code expires in 10 minutes. If you did not try to sign in, please change your password immediately.</p>`
  );
  const text = `Your Oakstones 1 Bank sign-in code is: ${code}\n\nThis code expires in 10 minutes. If you did not try to sign in, change your password.`;
  await send(to, `${code} is your Oakstones 1 Bank sign-in code`, html, text);
}

export async function sendTransactionCode(to: string, code: string, summary: string): Promise<void> {
  const html = brandShell('Confirm your transfer',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Use the code below to authorize this transfer from your Oakstones 1 Bank account.</p>
     <div style="text-align:center;margin:24px 0;">
       <div style="display:inline-block;background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:18px 32px;font-family:'Courier New',monospace;font-size:34px;letter-spacing:10px;color:#1F6B4A;font-weight:700;">${code}</div>
     </div>
     <p style="font-size:14px;line-height:1.6;margin:0 0 8px;color:#1F2937;font-weight:600;">${summary}</p>
     <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#6b6a60;">This code expires in 10 minutes.</p>
     <div style="background:#FEF6F6;border:1px solid #F3D6D6;border-radius:10px;padding:14px 18px;margin:0;">
       <p style="font-size:13px;line-height:1.6;margin:0 0 6px;color:#9B2C2C;font-weight:700;">Protect yourself from scams</p>
       <p style="font-size:13px;line-height:1.6;margin:0;color:#7A4A4A;">Oakstones 1 Bank will <strong>never</strong> call, text, or email you to ask for this code. Do not share it with anyone. If someone is requesting this code or asking you to move money to "protect" your account, it is a scam — end the conversation and contact us using the number on the back of your card.</p>
     </div>`
  );
  const text = `Your Oakstones 1 Bank transfer confirmation code is: ${code}\n\n${summary}\n\nThis code expires in 10 minutes.\n\nPROTECT YOURSELF FROM SCAMS: Oakstones 1 Bank will never call, text, or email you to ask for this code. Do not share it with anyone. If someone is requesting this code or asking you to move money to "protect" your account, it is a scam — end the conversation and contact us.`;
  await send(to, `${code} is your Oakstones 1 Bank transfer code`, html, text);
}

export async function sendTransactionAlert(to: string, title: string, body: string, balanceLine?: string): Promise<void> {
  const stamp = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const html = brandShell('Account activity alert',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 6px;color:#1F2937;">${body}</p>
     <p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:#6b6a60;">${stamp}</p>
     ${balanceLine ? `<div style="background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:14px 18px;margin:0 0 16px;font-size:15px;color:#1F2937;font-weight:600;">${balanceLine}</div>` : ''}
     <p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:#6b6a60;">This is an automated alert for activity on your Oakstones 1 Bank account. If you don't recognize this activity, please contact us right away.</p>
     <div style="background:#FEF6F6;border:1px solid #F3D6D6;border-radius:10px;padding:14px 18px;margin:0;">
       <p style="font-size:13px;line-height:1.6;margin:0;color:#7A4A4A;">Oakstones 1 Bank will <strong>never</strong> ask you to share a code or move money to "protect" or "verify" your account. If someone asks you to do this, it is a scam.</p>
     </div>`
  );
  const text = `Account activity alert\n\n${body}\n${stamp}${balanceLine ? `\n${balanceLine}` : ''}\n\nThis is an automated alert for activity on your Oakstones 1 Bank account. If you don't recognize this activity, please contact us right away.\n\nOakstones 1 Bank will never ask you to share a code or move money to "protect" or "verify" your account. If someone asks you to do this, it is a scam.`;
  await send(to, title, html, text);
}

export async function sendVerificationEmail(to: string, firstName: string, verifyUrl: string): Promise<void> {
  const html = brandShell('Verify your email',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">Please verify your email address to activate your Oakstones 1 Bank account.</p>
     <div style="text-align:center;margin:24px 0;">
       <a href="${verifyUrl}" style="background:#1F6B4A;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-weight:600;font-size:16px;">Verify Email</a>
     </div>
     <p style="font-size:14px;color:#6b6a60;">This link expires in 24 hours.</p>`
  );
  const text = `Hi ${firstName},\n\nVerify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`;
  await send(to, 'Verify your Oakstones 1 Bank email', html, text);
}

export async function sendEmailVerification(to: string, firstName: string, verifyUrl: string): Promise<void> {
  await sendVerificationEmail(to, firstName, verifyUrl);
}

export async function sendKycApprovedEmail(to: string, firstName: string, accountNumber?: string): Promise<void> {
  const acctBlock = accountNumber ? `
     <div style="background:#F7FBF8;border:1px solid #E9E3D4;border-radius:10px;padding:16px 20px;margin:0 0 16px;">
       <p style="font-size:13px;line-height:1.6;margin:0 0 4px;color:#6b6a60;">Your checking account number</p>
       <p style="font-size:20px;line-height:1.4;margin:0;color:#1F2937;font-weight:700;font-family:'Courier New',monospace;letter-spacing:1px;">${accountNumber}</p>
     </div>` : '';
  const html = brandShell('Your account is now open',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Good news — your identity has been verified and your Oakstones 1 Bank account is now open.</p>
     ${acctBlock}
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">You can now sign in to deposit funds, send transfers, and apply for a card. For your security, we never include your password in any email — only you know it.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">Welcome aboard,</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstones 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nYour Oakstones 1 Bank account is now open.${accountNumber ? `\n\nYour checking account number: ${accountNumber}` : ''}\n\nYou can now sign in to deposit, transfer, and apply for a card. For your security, we never include your password in any email.\n\nThe Oakstones 1 Bank Team`;
  await send(to, 'Your Oakstones 1 Bank account is now open', html, text);
}

export async function sendApplicationApproved(to: string, firstName: string, accountNumber?: string): Promise<void> {
  await sendKycApprovedEmail(to, firstName, accountNumber);
}

export async function sendKycRejectedEmail(to: string, firstName: string, reason?: string): Promise<void> {
  const reasonBlock = reason ? `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>Reason:</strong> ${reason}</p>` : '';
  const html = brandShell('An update on your application',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">After review, we are unable to approve your Oakstones 1 Bank application at this time.</p>
     ${reasonBlock}
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">If you believe this decision was made in error or you would like to provide additional information, please contact our support team.</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">Respectfully,</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstones 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nAfter review, we are unable to approve your Oakstones 1 Bank application at this time.${reason ? '\n\nReason: ' + reason : ''}\n\nThe Oakstones 1 Bank Team`;
  await send(to, 'An update on your Oakstones 1 Bank application', html, text);
}

export async function sendApplicationRejected(to: string, firstName: string, reason?: string): Promise<void> {
  await sendKycRejectedEmail(to, firstName, reason);
}

export async function sendApplicationConfirmation(to: string, firstName: string): Promise<void> {
  const html = brandShell('Application received',
    `<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${firstName},</p>
     <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for applying to Oakstones 1 Bank. We have received your application and will review it shortly.</p>
     <p style="font-size:16px;line-height:1.6;margin:0;color:#1F6B4A;font-weight:600;">The Oakstones 1 Bank Team</p>`
  );
  const text = `Dear ${firstName},\n\nThank you for applying to Oakstones 1 Bank. We have received your application.\n\nThe Oakstones 1 Bank Team`;
  await send(to, 'Your Oakstones 1 Bank application has been received', html, text);
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
  await send(to, 'Reset your Oakstones 1 Bank password', html, text);
}