import 'server-only';

const GRAPH_API_VERSION = 'v19.0';

type SendMessengerMessageArgs = {
  recipientId: string;
  text: string;
  pageAccessToken: string;
};

// Sends a text reply to a Messenger PSID (or Instagram IGSID) via the Meta
// Graph API. Works for both Facebook Messenger and Instagram DMs when the
// page access token has the corresponding permissions.
export async function sendMessengerMessage({
  recipientId,
  text,
  pageAccessToken,
}: SendMessengerMessageArgs): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(
    pageAccessToken,
  )}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: 'RESPONSE',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meta Graph API send failed: ${response.status} ${body}`);
  }
}
