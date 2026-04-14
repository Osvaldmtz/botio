import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }
  client = new Anthropic({ apiKey });
  return client;
}

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: systemPrompt || 'You are a helpful assistant.',
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  const firstTextBlock = response.content.find((block) => block.type === 'text');
  if (!firstTextBlock || firstTextBlock.type !== 'text') {
    return 'Sorry, I could not generate a response.';
  }
  return firstTextBlock.text;
}
