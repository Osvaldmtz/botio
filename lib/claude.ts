import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

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

    if (response.stop_reason !== 'tool_use') {
      return { text: extractFinalText(response.content), hadToolUse, toolsCalled, toolResults };
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
  return { text: 'Sorry, I got stuck. Please try again.', hadToolUse, toolsCalled, toolResults };
}
