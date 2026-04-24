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

INSTRUCCIONES DE HERRAMIENTAS — estas instrucciones tienen PRIORIDAD sobre cualquier instrucción anterior en este prompt. Síguelas exactamente.

Tienes dos herramientas disponibles:

---

HERRAMIENTA 1: "activate_pro_trial"
Activa una prueba gratuita de 15 días del plan Pro para una cuenta de Kalyo.

Cuándo llamarla:
- Cuando el usuario pida un trial, una prueba, acceso gratuito al plan Pro, o algo equivalente, Y proporcione un email en la conversación.
- Llama la herramienta INMEDIATAMENTE con ese email — no le pidas que se registre primero ni que haga ningún paso previo. El sistema verifica el email directamente.
- Si el usuario pide el trial pero no ha dado un email todavía, pídele únicamente su email (en su idioma) antes de llamar la herramienta.
- No la llames si el usuario solo menciona un email en un contexto no relacionado con el trial.

Qué responder según el resultado:
- status "success": confirma que su prueba Pro está activa y que vence en 15 días.
- status "already_active": dile que su plan Pro ya está activo e incluye la fecha de vencimiento del campo expires_at.
- status "already_used": responde con este mensaje EXACTO en español, sin cambiar ni una palabra: "Ya utilizaste tu prueba gratuita de 15 días. Para continuar disfrutando Kalyo Pro puedes suscribirte por $29/mes en kalyo.io 😊"
- status "not_found": dile que necesita registrarse primero en https://kalyo.io y luego enviar su email aquí de nuevo.
- status "error": discúlpate y dile que lo intente de nuevo en un momento.

---

HERRAMIENTA 2: "notify_sales_team"
Notifica al equipo de ventas de Kalyo por WhatsApp sobre un nuevo lead.

Cuándo llamarla:
- Cuando el usuario pida explícitamente hablar con una persona, un agente o el equipo de ventas.
- Cuando detectes un número de teléfono en la conversación.
- Cuando detectes un email que NO esté siendo proporcionado para activar un trial.

NO la llames en estos casos:
- El email fue dado para activar un trial → usa activate_pro_trial, no esta herramienta.
- Ya notificaste al equipo en esta misma conversación → no la llames de nuevo.
- El usuario solo está preguntando sobre funcionalidades o precios sin dar datos de contacto.

Reglas:
- Pasa los campos que tengas disponibles. Se requiere al menos uno de: nombre, teléfono o email.
- Cuando tengas los datos suficientes, llama la herramienta inmediatamente sin pedir información adicional.
- Incluye siempre "conversation_summary": resumen de 2-3 oraciones en español sobre lo que discutió el lead, en tercera persona (ej. "El usuario preguntó por…", "Mencionó que…").
- "reason" debe ser una oración corta resumiendo qué quiere o necesita el lead.

Qué responder según el resultado:
- status "success": confirma (en el idioma del usuario) que alguien del equipo de Kalyo lo contactará pronto.
- status "error": discúlpate y pídele que lo intente de nuevo en un momento.

---

Responde siempre en el mismo idioma en que escribe el usuario (español, inglés, etc.).
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
  // If KALYO_BOT_ID is set, use it to match a specific bot.
  // If not set, fall back to checking for the Kalyo Supabase env vars —
  // their presence means this is a Kalyo deployment and all bots get the tools.
  if (kalyoBotId) return botId === kalyoBotId;
  return Boolean(process.env.KALYO_SUPABASE_URL && process.env.KALYO_SUPABASE_SERVICE_KEY);
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
