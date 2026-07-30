import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  extractMeaningfulText,
  resolveReplyText,
} from '@/lib/claude-reply-text';
import { sendTelegramAlert } from '@/lib/telegram';

const DEFAULT_MODEL = 'claude-haiku-4-5';
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
  model?: string;
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

async function runToolHandlers(
  toolUseBlocks: Anthropic.Messages.ToolUseBlock[],
  toolHandlers: Record<string, ToolHandler> | undefined,
): Promise<{
  blocks: Anthropic.Messages.ToolResultBlockParam[];
  toolsCalled: string[];
  toolResults: Record<string, unknown>;
}> {
  const blocks: Anthropic.Messages.ToolResultBlockParam[] = [];
  const toolsCalled: string[] = [];
  const toolResults: Record<string, unknown> = {};

  for (const block of toolUseBlocks) {
    toolsCalled.push(block.name);
    const handler = toolHandlers?.[block.name];
    if (!handler) {
      toolResults[block.name] = { status: 'error', message: `Unknown tool: ${block.name}` };
      blocks.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Unknown tool: ${block.name}`,
        is_error: true,
      });
      continue;
    }
    try {
      const result = await handler(block.input);
      toolResults[block.name] = result;
      blocks.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[claude] tool "${block.name}" threw`, error);
      toolResults[block.name] = { status: 'error', message };
      blocks.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: ${message}`,
        is_error: true,
      });
    }
  }
  return { blocks, toolsCalled, toolResults };
}

export type GenerateReplyResult = {
  text: string;
  hadToolUse: boolean;
  toolsCalled: string[];
  toolResults: Record<string, unknown>;
};

async function alertGenericFallback(context: {
  hadToolUse: boolean;
  toolsCalled: string[];
}): Promise<void> {
  const tools = context.toolsCalled.length
    ? context.toolsCalled.join(', ')
    : 'none';
  try {
    await sendTelegramAlert(
      `⚠️ Claude empty reply — generic fallback sent.\n` +
        `hadToolUse=${context.hadToolUse} tools=[${tools}]\n` +
        `Possible tool-loop / empty end_turn bug.`,
    );
  } catch (error) {
    console.error('[claude] failed to send fallback telegram alert', error);
  }
}

export async function generateReply(
  systemPrompt: string,
  history: ChatMessage[],
  options: GenerateReplyOptions = {},
): Promise<GenerateReplyResult> {
  const { tools, toolHandlers, model = DEFAULT_MODEL } = options;
  const anthropic = getClient();
  let hadToolUse = false;
  const toolsCalled: string[] = [];
  const toolResults: Record<string, unknown> = {};
  let lastMeaningfulText = '';

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
  console.log('[tools]', tools?.length ?? 0, tools?.map((t) => t.name) ?? []);
  console.log('[system_prompt]', systemPrompt);

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      ...(hasTools ? { tools } : {}),
    });

    console.log('[anthropic]', 'stop_reason:', response.stop_reason, '| first_block:', JSON.stringify(response.content[0]));

    const turnText = extractMeaningfulText(response.content);
    if (turnText) {
      lastMeaningfulText = turnText;
    }

    if (response.stop_reason !== 'tool_use') {
      const resolved = resolveReplyText(response.content, lastMeaningfulText);

      if (resolved.source === 'tool_use_turn') {
        console.warn('[claude] end_turn empty, using text from tool_use turn');
      } else if (resolved.source === 'fallback') {
        console.error('[claude] empty reply after all turns — sending generic fallback', {
          hadToolUse,
          toolsCalled,
        });
        void alertGenericFallback({ hadToolUse, toolsCalled });
      }

      return { text: resolved.text, hadToolUse, toolsCalled, toolResults };
    }

    hadToolUse = true;

    // Echo the full assistant turn (including tool_use blocks) back into the
    // message history — Claude requires the exact content to resolve tool ids.
    messages.push({ role: 'assistant', content: response.content });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
    );
    const handled = await runToolHandlers(toolUseBlocks, toolHandlers);
    toolsCalled.push(...handled.toolsCalled);
    Object.assign(toolResults, handled.toolResults);
    messages.push({ role: 'user', content: handled.blocks });
  }

  console.warn('[claude] tool-use loop exceeded max iterations');
  return {
    text: 'Tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo? 🙏',
    hadToolUse,
    toolsCalled,
    toolResults,
  };
}
