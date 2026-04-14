import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReply, type ChatMessage, type GenerateReplyOptions } from '@/lib/claude';
import { sendWhatsApp, emptyTwimlResponse } from '@/lib/twilio';
import { activateProTrial } from '@/lib/kalyo';
import { notifySalesTeam } from '@/lib/kalyo-notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 20;
const FALLBACK_MESSAGE = "Sorry, I'm having trouble right now. Please try again in a moment.";

const KALYO_INSTRUCTIONS = `

You have two tools available for this conversation:

1) "activate_pro_trial" — activates a 15-day Pro trial for a Kalyo psychologist account.

Rules for using activate_pro_trial:
- Call it ONLY when the user has explicitly asked to start their free Pro trial AND has provided an email address in the conversation.
- If the user wants the trial but has not given an email yet, ask them for it in the language they are writing in.
- Do not call the tool for casual mentions of email or unrelated questions.

After activate_pro_trial returns:
- status "success": confirm their Pro trial is active and mention it expires in 15 days.
- status "already_active": tell them their Pro plan is already active and mention the expires_at date from the tool result.
- status "already_used": reply with this EXACT message in Spanish, verbatim, with no rephrasing and no additions: "Ya utilizaste tu prueba gratuita de 15 días. Para continuar disfrutando Kalyo Pro puedes suscribirte por $29/mes en kalyo.io 😊"
- status "not_found": tell them they need to register first at https://kalyo.io and then send their email here again.
- status "error": apologize and tell them to try again in a moment.

2) "notify_sales_team" — hands a new lead off to the Kalyo sales team via WhatsApp.

Call notify_sales_team when:
- The user explicitly asks to speak with a human, a real person, an agent, or the sales team.
- The user has shared contact information (name, phone, email, or preferred time to be contacted) AND is a potential customer who should be followed up with — for example, they are asking about pricing, onboarding help, custom plans, or a demo.

Rules:
- Pass whatever fields you have. The fields name, phone, email, preferred_time, and reason are all optional, but you must provide at least a name or a phone number.
- If you do not have a name or phone yet, first ask the user for at least one of them (in their language) before calling the tool.
- "reason" should be a short one-sentence summary of what the lead wants or needs.
- ALWAYS include "conversation_summary": a brief 2-3 sentence summary in Spanish of what the lead discussed in the WhatsApp conversation so far — what questions they asked, what needs or concerns they mentioned, and any context the sales team should know before replying. Write it in third person (e.g. "El usuario preguntó por…", "Mencionó que…"). Do not omit this field.

After notify_sales_team returns:
- status "success": confirm (in the user's language) that someone from the Kalyo team will contact them soon.
- status "error": apologize and ask them to try again in a moment.

Always reply in the same language the user is writing in (Spanish, English, etc.).
`;

const ACTIVATE_PRO_TRIAL_TOOL: Anthropic.Messages.Tool = {
  name: 'activate_pro_trial',
  description:
    'Activate a 15-day Pro trial for a Kalyo psychologist by email. Only call when the user has clearly asked to start their trial AND provided their email address.',
  input_schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'The email address of the Kalyo account to activate.',
      },
    },
    required: ['email'],
  },
};

const NOTIFY_SALES_TEAM_TOOL: Anthropic.Messages.Tool = {
  name: 'notify_sales_team',
  description:
    'Notify the Kalyo sales team by WhatsApp about a new potential customer. Call this when the user asks to speak with a human or sales, or when they have shared contact info and should be followed up with. Requires at least a name OR a phone; other fields are optional — pass them if the user mentioned them, otherwise omit.',
  input_schema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: "The lead's full name, if provided.",
      },
      phone: {
        type: 'string',
        description: "The lead's phone number, if provided.",
      },
      email: {
        type: 'string',
        description: "The lead's email address, if provided.",
      },
      preferred_time: {
        type: 'string',
        description: 'Preferred time or day to be contacted, if mentioned (free text).',
      },
      reason: {
        type: 'string',
        description:
          "Short summary of why the lead wants to be contacted or what they're interested in.",
      },
      conversation_summary: {
        type: 'string',
        description:
          'A brief 2-3 sentence summary of what the lead discussed in the WhatsApp conversation so far — questions they asked, needs they mentioned, concerns, etc. Written in Spanish.',
      },
    },
    required: [],
  },
};

type KalyoBotRow = {
  id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
};

function buildClaudeOptions(
  bot: KalyoBotRow,
  senderFrom: string,
): {
  systemSuffix: string;
  options: GenerateReplyOptions;
} {
  const kalyoBotId = process.env.KALYO_BOT_ID;
  if (!kalyoBotId || bot.id !== kalyoBotId) {
    return { systemSuffix: '', options: {} };
  }

  const creds =
    bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number
      ? {
          accountSid: bot.twilio_account_sid,
          authToken: bot.twilio_auth_token,
          from: bot.twilio_whatsapp_number,
        }
      : null;

  return {
    systemSuffix: KALYO_INSTRUCTIONS,
    options: {
      tools: [ACTIVATE_PRO_TRIAL_TOOL, NOTIFY_SALES_TEAM_TOOL],
      toolHandlers: {
        activate_pro_trial: async (input: unknown) => {
          const email =
            typeof input === 'object' && input !== null && 'email' in input
              ? String((input as { email: unknown }).email ?? '')
              : '';
          return activateProTrial(email);
        },
        notify_sales_team: async (input: unknown) => {
          if (!creds) {
            return {
              status: 'error',
              message: 'Kalyo bot is missing Twilio credentials',
            };
          }
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const str = (key: string): string | undefined =>
            typeof obj[key] === 'string' ? (obj[key] as string) : undefined;
          return notifySalesTeam(
            {
              name: str('name'),
              phone: str('phone'),
              email: str('email'),
              preferred_time: str('preferred_time'),
              reason: str('reason'),
              conversation_summary: str('conversation_summary'),
              whatsapp_number: senderFrom,
            },
            creds,
          );
        },
      },
    },
  };
}

type Params = { params: { botId: string } };

export async function POST(request: Request, { params }: Params) {
  const { botId } = params;

  let from: string;
  let messageBody: string;
  try {
    const form = await request.formData();
    from = String(form.get('From') ?? '');
    messageBody = String(form.get('Body') ?? '');
    if (!from || !messageBody) {
      return new Response('Missing From or Body', { status: 400 });
    }
  } catch {
    return new Response('Invalid form body', { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .select(
      'id, system_prompt, twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, is_active',
    )
    .eq('id', botId)
    .maybeSingle();

  if (botError || !bot) {
    return new Response('Bot not found', { status: 404 });
  }
  if (!bot.is_active) {
    return new Response('Bot inactive', { status: 403 });
  }

  // Upsert conversation on (bot_id, customer_phone) unique constraint.
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .upsert({ bot_id: bot.id, customer_phone: from }, { onConflict: 'bot_id,customer_phone' })
    .select('id')
    .single();

  if (convError || !conversation) {
    console.error('[webhook] failed to upsert conversation', convError);
    return new Response('Internal error', { status: 500 });
  }

  // Persist the incoming user message.
  const { error: userMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'user',
    content: messageBody,
  });
  if (userMsgError) {
    console.error('[webhook] failed to insert user message', userMsgError);
    return new Response('Internal error', { status: 500 });
  }

  // Load recent history (oldest → newest), including the message we just wrote.
  const { data: historyRows, error: historyError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) {
    console.error('[webhook] failed to load history', historyError);
    return new Response('Internal error', { status: 500 });
  }

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Generate the assistant reply. For the Kalyo bot, expose the activate_pro_trial tool.
  const { systemSuffix, options: claudeOptions } = buildClaudeOptions(bot, from);
  const systemPrompt = (bot.system_prompt ?? '') + systemSuffix;

  let replyText: string;
  try {
    replyText = await generateReply(systemPrompt, history, claudeOptions);
  } catch (error) {
    console.error('[webhook] Claude call failed', error);
    replyText = FALLBACK_MESSAGE;
  }

  // Persist the assistant reply (best effort — don't abort on failure).
  const { error: assistantMsgError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'assistant',
    content: replyText,
  });
  if (assistantMsgError) {
    console.error('[webhook] failed to insert assistant message', assistantMsgError);
  }

  // Send the reply via Twilio REST using the bot's stored credentials.
  if (bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number) {
    try {
      await sendWhatsApp({
        accountSid: bot.twilio_account_sid,
        authToken: bot.twilio_auth_token,
        from: bot.twilio_whatsapp_number,
        to: from,
        body: replyText,
      });
    } catch (error) {
      console.error('[webhook] Twilio send failed', error);
    }
  } else {
    console.warn('[webhook] bot missing Twilio credentials — skipping outbound send');
  }

  return emptyTwimlResponse();
}
