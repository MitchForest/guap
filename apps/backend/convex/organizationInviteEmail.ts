const resendApiKey =
  process.env.ORGANIZATION_INVITE_RESEND_API_KEY ??
  process.env.RESEND_API_KEY ??
  process.env.RESEND_KEY;

const defaultFromAddress = 'Guap <no-reply@guap.app>';

const getFromAddress = () =>
  process.env.ORGANIZATION_INVITE_FROM_EMAIL ??
  process.env.MAGIC_LINK_FROM_EMAIL ??
  defaultFromAddress;

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderTextBody = (payload: InvitationEmailPayload) => {
  return [
    `You're invited to join ${payload.organizationName}`,
    '',
    payload.inviterName
      ? `${payload.inviterName} sent you an invitation to collaborate in Guap.`
      : `You've been invited to collaborate in Guap.`,
    '',
    `Use this link to accept the invitation:`,
    payload.acceptUrl,
    '',
    `Invitation code: ${payload.invitationCode}`,
    '',
    `If you weren't expecting this invite, you can ignore it.`,
  ].join('\n');
};

const renderHtmlBody = (payload: InvitationEmailPayload) => {
  const escapedUrl = escapeHtml(payload.acceptUrl);
  const escapedCode = escapeHtml(payload.invitationCode);
  const inviteeLine = payload.inviterName
    ? `${escapeHtml(payload.inviterName)} sent you an invitation to collaborate in Guap.`
    : `You've been invited to collaborate in Guap.`;

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Join ${escapeHtml(payload.organizationName)}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        background-color: #f8fafc;
        color: #0f172a;
        padding: 24px;
      }
      .container {
        max-width: 480px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
      }
      .cta {
        display: inline-block;
        margin-top: 24px;
        padding: 16px 24px;
        border-radius: 999px;
        background: #2563eb;
        color: #ffffff !important;
        font-weight: 600;
        text-decoration: none;
      }
      .link {
        margin-top: 24px;
        word-break: break-all;
        color: #2563eb;
      }
      .code {
        display: inline-block;
        margin-top: 16px;
        padding: 12px 18px;
        border-radius: 10px;
        background: #e2e8f0;
        font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        font-size: 14px;
        letter-spacing: 0.08em;
      }
      p {
        margin: 0 0 16px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 style="margin-top: 0;">Join ${escapeHtml(payload.organizationName)}</h1>
      <p>${inviteeLine}</p>
      <p style="text-align: center;">
        <a class="cta" href="${escapedUrl}">Accept invitation</a>
      </p>
      <p>If the button doesn’t work, copy and paste this link into your browser:</p>
      <p class="link">${escapedUrl}</p>
      <p>Invitation code:</p>
      <div class="code">${escapedCode}</div>
      <p style="font-size: 12px; color: #64748b;">
        If you didn’t expect this email, you can safely ignore it.
      </p>
    </div>
  </body>
</html>
`.trim();
};

type InvitationEmailPayload = {
  email: string;
  organizationName: string;
  invitationCode: string;
  acceptUrl: string;
  inviterName?: string | null;
};

const sendViaResend = async (payload: InvitationEmailPayload) => {
  if (!resendApiKey) {
    return false;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getFromAddress(),
      to: payload.email,
      subject: `Invitation to join ${payload.organizationName} on Guap`,
      html: renderHtmlBody(payload),
      text: renderTextBody(payload),
    }),
  });

  if (response.ok) {
    return true;
  }

  const detail = await response.text().catch(() => 'Unknown error');
  throw new Error(`Resend organization invite email failed: ${response.status} ${detail}`);
};

export type OrganizationInvitationEmail = InvitationEmailPayload;

export const sendOrganizationInvitationEmail = async (payload: InvitationEmailPayload) => {
  try {
    const delivered = await sendViaResend(payload);
    if (delivered) {
      console.info('[organization-invite] Email sent via Resend', {
        email: payload.email,
        organization: payload.organizationName,
      });
      return;
    }
  } catch (error) {
    console.error('[organization-invite] Resend delivery failed', error);
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }

  if (!resendApiKey) {
    console.info('[organization-invite] RESEND_API_KEY missing – falling back to console logging');
  }

  console.info('[organization-invite] Invitation ready', {
    email: payload.email,
    organization: payload.organizationName,
    acceptUrl: payload.acceptUrl,
    invitationCode: payload.invitationCode,
  });
};

