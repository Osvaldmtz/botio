import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processIncomingMessage } from '@/lib/process-message';
import { buildCustomerPhone } from '@/lib/channel-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: { botId: string } };

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: Request, { params }: Params) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id')?.trim();

  if (!sessionId) {
    return jsonResponse({ error: 'session_id is required' }, 400);
  }

  const supabase = createAdminClient();
  const customerPhone = buildCustomerPhone('webchat', sessionId);

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('bot_id', params.botId)
    .eq('customer_phone', customerPhone)
    .maybeSingle();

  if (convError) {
    return jsonResponse({ error: convError.message }, 500);
  }

  if (!conversation) {
    return jsonResponse({ messages: [], conversation_id: null });
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, role, content, created_at, source_type')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  if (msgError) {
    return jsonResponse({ error: msgError.message }, 500);
  }

  return jsonResponse({
    conversation_id: conversation.id,
    messages: messages ?? [],
  });
}

type PostBody = {
  session_id?: string;
  message?: string;
  name?: string;
  email?: string;
};

export async function POST(request: Request, { params }: Params) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const sessionId = body.session_id?.trim();
  const message = body.message?.trim();

  if (!sessionId || !message) {
    return jsonResponse({ error: 'session_id and message are required' }, 400);
  }

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select('id, is_active')
    .eq('id', params.botId)
    .maybeSingle();

  if (botError || !bot) {
    return jsonResponse({ error: 'Bot not found' }, 404);
  }
  if (!bot.is_active) {
    return jsonResponse({ error: 'Bot inactive' }, 403);
  }

  console.log(`[widget] new message | session=${sessionId}`);

  const metadata: Record<string, unknown> = { channel: 'webchat' };
  if (body.name?.trim()) metadata.name = body.name.trim();
  if (body.email?.trim()) metadata.email = body.email.trim();

  try {
    const result = await processIncomingMessage({
      supabase,
      botId: params.botId,
      channel: 'webchat',
      identifier: sessionId,
      sessionId,
      messageBody: message,
      metadata,
    });

    if (result.rateLimited) {
      return jsonResponse({ error: 'Rate limited' }, 429);
    }

    console.log(`[widget] new message | conv=${result.conversationId} | session=${sessionId}`);

    return jsonResponse({
      reply: result.replyText,
      conversation_id: result.conversationId,
      source: result.source,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[widget] process failed', error);
    return jsonResponse({ error: msg }, 500);
  }
}
