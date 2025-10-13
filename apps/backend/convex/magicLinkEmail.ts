const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Guap <no-reply@guap.app>';

const pickEnv = (...keys: Array<string | undefined>) =>
  keys
    .map((key) => (key ?? '').trim())
    .filter((value) => value.length > 0)[0] ?? null;

const pickApiKey = (...keys: Array<string | undefined>) => pickEnv(...keys);

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendWithResend = async ({
  apiKey,
  from,
  to,
  subject,
  html,
  text,
  logTag,
}: {
  apiKey: string | null;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  logTag: string;
}) => {
  if (!apiKey) {
    console.info(`[${logTag}] RESEND_API_KEY missing – logging email`, { to, subject });
    console.info(`[${logTag}] email payload`, { html, text });
    return;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'Unknown error');
    throw new Error(`[${logTag}] Resend request failed: ${response.status} ${detail}`);
  }
};

type MagicLinkPayload = {
  email: string;
  url: string;
  token: string;
};

type InvitationEmailPayload = {
  email: string;
  invitationUrl: string;
  organizationName: string;
  role?: string | null;
  inviterName?: string | null;
};

type InvitationTemplatePayload = Omit<InvitationEmailPayload, 'email'>;

const renderMagicLinkHtml = (url: string) => {
  const escapedUrl = escapeHtml(url);
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sign in to Guap</title>
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
      p {
        margin: 0 0 16px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 style="margin-top: 0;">Sign in to Guap</h1>
      <p>Click the button below to finish signing in.</p>
      <p style="text-align: center;">
        <a class="cta" href="${escapedUrl}">Open your secure link</a>
      </p>
      <p>If the button doesn’t work, copy and paste this link into your browser:</p>
      <p class="link">${escapedUrl}</p>
      <p style="font-size: 12px; color: #64748b;">
        If you didn’t request this email, you can safely ignore it.
      </p>
    </div>
  </body>
</html>
`.trim();
};

const renderMagicLinkText = (url: string) =>
  [
    'Sign in to Guap',
    '',
    'Click the secure link below to continue:',
    url,
    '',
    'If you did not request this email, you can safely ignore it.',
  ].join('\n');

const renderInvitationHtml = ({
  invitationUrl,
  organizationName,
  role,
  inviterName,
}: InvitationTemplatePayload) => {
  const escapedUrl = escapeHtml(invitationUrl);
  const escapedOrg = escapeHtml(organizationName);
  const roleLabel = role ? role.toUpperCase() : 'member';
  const inviterLabel = inviterName ? escapeHtml(inviterName) : 'A teammate';

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>You're invited to ${escapedOrg}</title>
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
      p {
        margin: 0 0 16px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 style="margin-top: 0;">You're invited to ${escapedOrg}</h1>
      <p>${inviterLabel} invited you to join as a ${escapeHtml(roleLabel.toLowerCase())}.</p>
      <p style="text-align: center;">
        <a class="cta" href="${escapedUrl}">Accept your invite</a>
      </p>
      <p>If the button doesn’t work, copy and paste this link into your browser:</p>
      <p class="link">${escapedUrl}</p>
      <p style="font-size: 12px; color: #64748b;">
        This invitation was sent via Guap. If you weren’t expecting it, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>
`.trim();
};

const renderInvitationText = ({
  invitationUrl,
  organizationName,
  role,
  inviterName,
}: InvitationTemplatePayload) => {
  const inviterLabel = inviterName ?? 'A teammate';
  const roleLabel = role ?? 'member';
  return [
    `You're invited to ${organizationName}`,
    '',
    `${inviterLabel} invited you to join as a ${roleLabel}.`,
    '',
    `Open this link to accept: ${invitationUrl}`,
    '',
    'If you were not expecting this invitation, you can ignore this message.',
  ].join('\n');
};

export const sendMagicLinkEmail = async ({ email, url }: MagicLinkPayload) => {
  await sendWithResend({
    apiKey: pickApiKey(process.env.MAGIC_LINK_RESEND_API_KEY, process.env.RESEND_API_KEY),
    from: pickEnv(process.env.MAGIC_LINK_FROM_EMAIL, DEFAULT_FROM) ?? DEFAULT_FROM,
    to: email,
    subject: 'Your Guap sign-in link',
    html: renderMagicLinkHtml(url),
    text: renderMagicLinkText(url),
    logTag: 'magic-link',
  });
};

export const sendOrganizationInvitationEmail = async ({
  email,
  invitationUrl,
  organizationName,
  role,
  inviterName,
}: InvitationEmailPayload) => {
  await sendWithResend({
    apiKey: pickApiKey(process.env.MAGIC_LINK_RESEND_API_KEY, process.env.RESEND_API_KEY),
    from: pickEnv(process.env.MAGIC_LINK_FROM_EMAIL, DEFAULT_FROM) ?? DEFAULT_FROM,
    to: email,
    subject: `You're invited to ${organizationName}`,
    html: renderInvitationHtml({ invitationUrl, organizationName, role, inviterName }),
    text: renderInvitationText({ invitationUrl, organizationName, role, inviterName }),
    logTag: 'organization-invite',
  });
};

export type { MagicLinkPayload, InvitationEmailPayload };
