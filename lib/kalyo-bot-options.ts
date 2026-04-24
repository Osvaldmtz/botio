import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { GenerateReplyOptions } from '@/lib/claude';
import { activateProTrial } from '@/lib/kalyo';
import { notifySalesTeam } from '@/lib/kalyo-notify';

// --------------------------------------------------------------------------
// Kalyo-specific Claude wiring shared by both the Twilio and Meta webhooks.
//
// The Kalyo bot (identified by KALYO_BOT_ID) gets a different system prompt
// suffix and a different tool set per channel:
//
//   - Twilio (WhatsApp)   → activate_pro_trial + notify_sales_team tools.
//                            The user is already on WhatsApp, so tool calls
//                            can run the full trial-activation flow.
//
//   - Meta (Messenger/IG) → NO tools. Messenger users who ask about the
//                            free trial get redirected to WhatsApp via a
//                            wa.me deep link, because trial activation
//                            needs the WhatsApp conversation context.
//
// Any other bot (bot.id !== KALYO_BOT_ID) gets an empty suffix and no tools.
// --------------------------------------------------------------------------

const KALYO_TRIAL_DEEP_LINK =
  'https://wa.me/15559374917?text=Hola,%20quiero%20mi%20prueba%20gratis%20de%20Kalyo';

const KALYO_INSTRUCTIONS_TWILIO = `

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

Call notify_sales_team when ANY of the following is true:
- The user explicitly asks to speak with a human, a real person, an agent, or the sales team.
- You detect an email address or a phone number anywhere in the current message or in any previous message in the conversation — regardless of the user's stated intent. Do not wait to classify them as a "potential customer". Contact data alone is sufficient to trigger the notification.

Rules:
- Pass whatever fields you have. All fields are optional, but you must provide at least one of: name, phone, or email.
- If you have detected an email or phone number, call the tool immediately — do not ask the user for additional information before calling it.
- Call the tool only once per conversation. If you have already notified the sales team, do not call it again.
- "reason" should be a short one-sentence summary of what the lead wants or needs.
- ALWAYS include "conversation_summary": a brief 2-3 sentence summary in Spanish of what the lead discussed in the WhatsApp conversation so far — what questions they asked, what needs or concerns they mentioned, and any context the sales team should know before replying. Write it in third person (e.g. "El usuario preguntó por…", "Mencionó que…"). Do not omit this field.

After notify_sales_team returns:
- status "success": confirm (in the user's language) that someone from the Kalyo team will contact them soon.
- status "error": apologize and ask them to try again in a moment.

Always reply in the same language the user is writing in (Spanish, English, etc.).
`;

const KALYO_INSTRUCTIONS_META = `

You are the Kalyo assistant running on Facebook Messenger / Instagram Direct Messages.

If the user asks about the free trial, about activating Kalyo Pro, about starting their 15-day free Pro trial, or about trying the Pro plan, reply in the language they are writing in and include this EXACT WhatsApp deep-link sentence verbatim:

"Para activar tu prueba gratuita de 15 días del plan Pro, haz clic aquí y escríbenos por WhatsApp: ${KALYO_TRIAL_DEEP_LINK} 🚀"

Trial activation happens on WhatsApp only — do NOT ask for their email on Messenger or Instagram, and do NOT try to activate the trial yourself. The wa.me link above opens WhatsApp with a pre-filled message so the user lands in the right conversation to finish activation.

For any other topic (pricing, features, onboarding help, support questions, general info about Kalyo), answer normally and conversationally.

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
    'Notify the Kalyo sales team by WhatsApp about a new lead. Call this immediately when an email address or phone number is detected in the conversation, OR when the user asks to speak with a human or the sales team. Requires at least one of: name, phone, or email. All other fields are optional — pass them if available.',
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

export type KalyoTwilioBotRow = {
  id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
};

export type KalyoMetaBotRow = {
  id: string;
};

export type BuildKalyoOptionsArgs =
  | { channel: 'twilio'; bot: KalyoTwilioBotRow; senderFrom: string }
  | { channel: 'meta'; bot: KalyoMetaBotRow };

export type BuildKalyoOptionsResult = {
  systemSuffix: string;
  options: GenerateReplyOptions;
};

function isKalyoBot(botId: string): boolean {
  const kalyoBotId = process.env.KALYO_BOT_ID;
  return Boolean(kalyoBotId) && botId === kalyoBotId;
}

export function buildKalyoClaudeOptions(args: BuildKalyoOptionsArgs): BuildKalyoOptionsResult {
  if (!isKalyoBot(args.bot.id)) {
    return { systemSuffix: '', options: {} };
  }

  if (args.channel === 'meta') {
    // Meta channel: text-only instructions with the WhatsApp deep link.
    // No tools — trial activation is deliberately WhatsApp-only.
    return {
      systemSuffix: KALYO_INSTRUCTIONS_META,
      options: {},
    };
  }

  // Twilio channel: full tool set.
  const { bot, senderFrom } = args;
  const creds =
    bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number
      ? {
          accountSid: bot.twilio_account_sid,
          authToken: bot.twilio_auth_token,
          from: bot.twilio_whatsapp_number,
        }
      : null;

  return {
    systemSuffix: KALYO_INSTRUCTIONS_TWILIO,
    options: {
      tools: [ACTIVATE_PRO_TRIAL_TOOL, NOTIFY_SALES_TEAM_TOOL],
      toolHandlers: {
        activate_pro_trial: async (input: unknown) => {
          const email =
            typeof input === 'object' && input !== null && 'email' in input
              ? String((input as { email: unknown }).email ?? '')
              : '';
          const result = await activateProTrial(email);

          if (result.status === 'success' && creds) {
            notifySalesTeam(
              {
                title: '🎉 Trial activado por Botio',
                email,
                phone: senderFrom,
                whatsapp_number: senderFrom,
                expires_at: result.expires_at,
              },
              creds,
            ).catch((err) => console.error('[kalyo] trial activation notify failed', err));
          }

          return result;
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
