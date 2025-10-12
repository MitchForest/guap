const resendApiKey =
  process.env.MAGIC_LINK_RESEND_API_KEY ?? process.env.RESEND_API_KEY ?? process.env.RESEND_KEY;

const defaultFromAddress = 'Guap <no-reply@guap.app>';

const getFromAddress = () => process.env.MAGIC_LINK_FROM_EMAIL ?? defaultFromAddress;

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderTextBody = (url: string) => {
  return [
    'Sign in to Guap',
    '',
    'Click the secure link below to continue:',
    url,
    '',
    'If you did not request this email, you can safely ignore it.',
  ].join('\n');
};

const renderHtmlBody = (url: string) => {
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

type MagicLinkPayload = {
  email: string;
  url: string;
  token: string;
};

type SmokeMagicLinkRecord = MagicLinkPayload & {
  capturedAt: number;
};

const smokeMagicLinkSecret = process.env.SMOKE_MAGIC_LINK_SECRET ?? null;
const smokeMagicLinkQueue: Array<SmokeMagicLinkRecord> = [];

const maybeCaptureSmokeToken = (payload: MagicLinkPayload) => {
  if (!smokeMagicLinkSecret) {
    return false;
  }

  const entry: SmokeMagicLinkRecord = {
    ...payload,
    capturedAt: Date.now(),
  };

  smokeMagicLinkQueue.push(entry);
  if (smokeMagicLinkQueue.length > 10) {
    smokeMagicLinkQueue.splice(0, smokeMagicLinkQueue.length - 10);
  }

  return true;
};

export const consumeSmokeMagicLinkToken = () => smokeMagicLinkQueue.shift() ?? null;

const sendViaResend = async (payload: MagicLinkPayload) => {
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
      subject: 'Your Guap sign-in link',
      html: renderHtmlBody(payload.url),
      text: renderTextBody(payload.url),
    }),
  });

  if (response.ok) {
    return true;
  }

  const detail = await response.text().catch(() => 'Unknown error');
  throw new Error(`Resend magic link email failed: ${response.status} ${detail}`);
};

const deliverMagicLinkEmail = async (payload: MagicLinkPayload, { skipResendErrors = false } = {}) => {
  try {
    const delivered = await sendViaResend(payload);
    if (delivered) {
      console.info('[magic-link] Email sent via Resend', { email: payload.email });
      return;
    }
  } catch (error) {
    console.error('[magic-link] Resend delivery failed', error);
    if (process.env.NODE_ENV === 'production' && !skipResendErrors) {
      throw error;
    }
  }

  if (!resendApiKey) {
    console.info('[magic-link] RESEND_API_KEY missing – falling back to console logging');
  }

  console.info('[magic-link] Magic link ready', {
    email: payload.email,
    url: payload.url,
  });
};

export const sendMagicLinkEmail = async (payload: MagicLinkPayload) => {
  const captured = maybeCaptureSmokeToken(payload);
  await deliverMagicLinkEmail(payload, { skipResendErrors: captured });
  if (captured) {
    console.info('[magic-link] Captured smoke magic link token', { email: payload.email });
  }
};
