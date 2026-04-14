import 'server-only';

type SendWhatsAppArgs = {
  accountSid: string;
  authToken: string;
  from: string; // e.g. "whatsapp:+14155238886"
  to: string; // e.g. "whatsapp:+521..."
  body: string;
};

export async function sendWhatsApp({
  accountSid,
  authToken,
  from,
  to,
  body,
}: SendWhatsAppArgs): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const form = new URLSearchParams();
  form.set('From', toWhatsAppAddress(from));
  form.set('To', toWhatsAppAddress(to));
  form.set('Body', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio send failed: ${response.status} ${text}`);
  }
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
