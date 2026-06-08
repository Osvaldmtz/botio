import 'server-only';

type QuickReplyButton = {
  id: string;
  title: string;
};

type SendWhatsAppArgs = {
  accountSid: string;
  authToken: string;
  from: string; // e.g. "whatsapp:+14155238886"
  to: string; // e.g. "whatsapp:+521..."
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
  quickReplies?: QuickReplyButton[];
};

export class TwilioApiError extends Error {
  readonly code: number | null;
  readonly httpStatus: number;

  constructor(message: string, code: number | null, httpStatus: number) {
    super(message);
    this.name = 'TwilioApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type TwilioMessageSendResult = { sid: string };

export type TwilioMessageStatusResult = {
  status: string;
  errorCode: string | null;
};

function twilioAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

function buildWhatsAppForm(args: SendWhatsAppArgs): URLSearchParams {
  const form = new URLSearchParams();
  form.set('From', toWhatsAppAddress(args.from));
  form.set('To', toWhatsAppAddress(args.to));

  const quickReplyContentSid = process.env.KALYO_QUICK_REPLY_CONTENT_SID;
  if (args.quickReplies?.length && quickReplyContentSid) {
    const vars: Record<string, string> = { body: args.body ?? '' };
    args.quickReplies.slice(0, 3).forEach((btn, i) => {
      vars[String(i + 1)] = btn.title;
    });
    form.set('ContentSid', quickReplyContentSid);
    form.set('ContentVariables', JSON.stringify(vars));
  } else if (args.contentSid) {
    form.set('ContentSid', args.contentSid);
    form.set('ContentVariables', JSON.stringify(args.contentVariables ?? {}));
  } else if (args.body) {
    form.set('Body', args.body);
  }

  return form;
}

function parseTwilioError(text: string, httpStatus: number): TwilioApiError {
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: number };
    return new TwilioApiError(
      parsed.message ?? text,
      typeof parsed.code === 'number' ? parsed.code : null,
      httpStatus,
    );
  } catch {
    return new TwilioApiError(text, null, httpStatus);
  }
}

export async function sendWhatsAppMessage(
  args: SendWhatsAppArgs,
): Promise<TwilioMessageSendResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${args.accountSid}/Messages.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioAuthHeader(args.accountSid, args.authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildWhatsAppForm(args).toString(),
  });

  const text = await response.text();
  if (!response.ok) {
    throw parseTwilioError(text, response.status);
  }

  const data = JSON.parse(text) as { sid?: string };
  if (!data.sid) {
    throw new TwilioApiError('Twilio response missing sid', null, response.status);
  }

  return { sid: data.sid };
}

export async function fetchTwilioMessageStatus(
  accountSid: string,
  authToken: string,
  messageSid: string,
): Promise<TwilioMessageStatusResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;
  const response = await fetch(url, {
    headers: { Authorization: twilioAuthHeader(accountSid, authToken) },
  });

  const text = await response.text();
  if (!response.ok) {
    throw parseTwilioError(text, response.status);
  }

  const data = JSON.parse(text) as { status?: string; error_code?: string | null };
  return {
    status: data.status ?? 'unknown',
    errorCode: data.error_code ?? null,
  };
}

export async function sendWhatsApp(args: SendWhatsAppArgs): Promise<void> {
  await sendWhatsAppMessage(args);
}

// Twilio requires both From and To to carry the "whatsapp:" channel prefix for
// WhatsApp messages. Admin users sometimes store a bot's number as a bare
// "+E164" value, which triggers Twilio error 21910 ("Invalid From and To pair").
// Normalize here so callers don't have to think about it.
function toWhatsAppAddress(address: string): string {
  const trimmed = address.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export function emptyTwimlResponse(): Response {
  return new Response(EMPTY_TWIML, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}
