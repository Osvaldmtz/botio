import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
const MAX_TOOL_ITERATIONS = 5;

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ToolHandler = (input: unknown) => Promise<unknown>;

export type GenerateReplyOptions = {
  tools?: Anthropic.Messages.Tool[];
  toolHandlers?: Record<string, ToolHandler>;
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

function extractFinalText(content: Anthropic.Messages.ContentBlock[]): string {
  const textBlock = content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    return 'Sorry, I could not generate a response.';
  }
  return textBlock.text;
}

async function runToolHandlers(
  toolUseBlocks: Anthropic.Messages.ToolUseBlock[],
  toolHandlers: Record<string, ToolHandler> | undefined,
): Promise<Anthropic.Messages.ToolResultBlockParam[]> {
  const results: Anthropic.Messages.ToolResultBlockParam[] = [];
  for (const block of toolUseBlocks) {
    const handler = toolHandlers?.[block.name];
    if (!handler) {
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Unknown tool: ${block.name}`,
        is_error: true,
      });
      continue;
    }
    try {
      const result = await handler(block.input);
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[claude] tool "${block.name}" threw`, error);
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: ${message}`,
        is_error: true,
      });
    }
  }
  return results;
}

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
  options: GenerateReplyOptions = {},
): Promise<string> {
  const { tools, toolHandlers } = options;
  const anthropic = getClient();

  const messages: Anthropic.Messages.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const system: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text',
      text: systemPrompt || 'You are a helpful assistant.',
      cache_control: { type: 'ephemeral' },
    },
  ];

  const hasTools = Array.isArray(tools) && tools.length > 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      ...(hasTools ? { tools } : {}),
    });

    if (response.stop_reason !== 'tool_use') {
      return extractFinalText(response.content);
    }

    // Echo the full assistant turn (including tool_use blocks) back into the
    // message history — Claude requires the exact content to resolve tool ids.
    messages.push({ role: 'assistant', content: response.content });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
    );
    const toolResults = await runToolHandlers(toolUseBlocks, toolHandlers);
    messages.push({ role: 'user', content: toolResults });
  }

  console.warn('[claude] tool-use loop exceeded max iterations');
  return 'Sorry, I got stuck. Please try again.';
}
