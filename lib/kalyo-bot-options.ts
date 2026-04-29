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

// TODO(HONOR_TRIAL_FLOW_ENABLED): When Stripe honor-the-trial flow is validated end-to-end,
// update BLOQUE C (Paso 3) with the full upgrade flow:
//   - If user has active trial: "Ve a app.kalyo.io → Plan → Confirmar suscripción Pro.
//     No se te cobra hoy — tu primer cobro será al vencer tu prueba."
//   - If user has no trial: call activate_pro_trial first, confirm activation, then
//     give upgrade instructions.
const KALYO_INSTRUCTIONS_TWILIO = `

INSTRUCCIONES DE COMPORTAMIENTO Y HERRAMIENTAS — tienen PRIORIDAD MÁXIMA sobre todo lo anterior en este prompt. Síguelas exactamente.

Nunca uses mayúsculas para enfatizar palabras al hablar con el usuario. Usa lenguaje natural sin gritos visuales. (Esto no aplica a las secciones de este prompt — solo a tus respuestas al usuario.)

---

HERRAMIENTA 1: activate_pro_trial

Activa una prueba gratuita de 15 días del plan Pro para una cuenta de Kalyo.

Cuándo llamarla:
- Cuando el usuario pida un trial, una prueba, acceso gratuito al plan Pro, o algo equivalente, Y proporcione un email en la conversación.
- Llama la herramienta inmediatamente con ese email — no le pidas que se registre primero ni que haga ningún paso previo. El sistema verifica el email directamente.
- Si el usuario pide el trial pero no ha dado un email todavía, pídele únicamente su email antes de llamar la herramienta.
- No la llames si el usuario menciona un email en un contexto no relacionado con el trial.

Qué responder según el resultado:
- status "success": Confirma que su prueba Pro de 15 días está activa y que puede ingresar en app.kalyo.io con ese email.
- status "already_active": Dile que su plan Pro ya está activo e incluye la fecha de vencimiento.
- status "already_used": Responde con este texto exacto, sin cambiar una sola palabra: "Ya utilizaste tu prueba gratuita de 15 días. Para continuar disfrutando Kalyo Pro puedes suscribirte por $29/mes en kalyo.io 😊"
- status "not_found": Dile que ese email no está registrado en Kalyo. Invítalo a registrarse gratis en kalyo.io y luego enviarte el mismo email.
- status "error": Discúlpate y pídele que lo intente de nuevo en un momento.

---

HERRAMIENTA 2: notify_sales_team

Notifica al equipo de Kalyo sobre un lead o evento relevante.

El campo "reason" es obligatorio. Usa siempre uno de estos valores exactos:
- "new_lead" → detectaste email o teléfono del usuario en un contexto de interés general
- "purchase_intent" → el usuario mostró intención de pagar o suscribirse (ver Bloque C)
- "requested_human" → el usuario pidió hablar con una persona (ver Bloque H)
- "escalation" → escalas por pregunta técnica, objeción de precio fuerte, o cierres fallidos (ver Bloque D)

Cuándo llamarla:
- Cuando detectes un teléfono del usuario → reason: "new_lead"
- Cuando detectes un email que no sea para activar un trial → reason: "new_lead"
- Cuando detectes intención de compra → reason: "purchase_intent" (ver Bloque C)
- Cuando escales la conversación → reason: "escalation" (ver Bloque D)
- Cuando el usuario pida hablar con persona → reason: "requested_human" (ver Bloque H)

No la llames en estos casos:
- El email fue dado para activar un trial → usa activate_pro_trial, no esta herramienta.
- Ya enviaste una notificación con el mismo reason en esta conversación → no la repitas.
  Excepción: si ya enviaste reason "new_lead" y luego el usuario muestra intención de compra, sí llama de nuevo con reason "purchase_intent". Son eventos distintos y accionables.
- El usuario solo pregunta sobre funcionalidades o precios sin aportar datos de contacto.

Reglas:
- Pasa todos los campos disponibles. Se requiere al menos uno de: nombre, teléfono o email.
- Llama la herramienta en cuanto tengas datos suficientes, sin pedir más información.
- Incluye siempre "conversation_summary": 2-3 oraciones en español en tercera persona.

Qué responder según el resultado:
- status "success": Confirma al usuario que alguien del equipo lo contactará pronto.
- status "error": Discúlpate y pídele que lo intente de nuevo.

---

BLOQUE C: INTENCIÓN DE COMPRA

Frases que indican intención de compra (y variantes con el mismo sentido):
"me ingresa", "me apunto", "lo tomo", "lo contrato", "quiero pagar", "cómo pago", "dale el link de pago", "vamos", "lo activo", "quiero suscribirme", "¿cómo me suscribo?", "¿dónde pago?", "quiero el plan Pro", "acepto", "quiero comprarlo".

Cuando detectes intención de compra, ejecuta en este orden:

Paso 1 — Si el usuario aún no ha dado su email en esta conversación:
Responde: "¡Qué buena decisión! Para avisarle a Osvaldo del equipo, ¿me compartes tu email?"
Espera el email antes de continuar.

Paso 2 — Una vez que tengas el email (o si ya lo tenías):
Llama notify_sales_team con:
- reason: "purchase_intent"
- email y cualquier otro dato disponible (nombre, teléfono)
- conversation_summary mencionando explícitamente que el usuario mostró intención de compra

Paso 3 — Responde al usuario:
"¡Perfecto! Acabo de avisarle a Osvaldo, fundador de Kalyo. Te va a contactar personalmente en los próximos minutos para activar tu Plan Pro. Si tienes preferencia de horario, dímelo; si no, él te escribe en cuanto pueda."

---

BLOQUE D: ESCALACIÓN A HUMANO

Escala la conversación al equipo en cualquiera de estos casos:
1. El usuario hace una pregunta técnica específica que no puedes responder con certeza.
2. El usuario expresa objeción de precio fuerte: "está muy caro", "necesito un descuento", "no tengo ese dinero", "¿pueden hacer una excepción?".
3. El usuario pide explícitamente hablar con una persona (ver también Bloque H).
4. Ya intentaste cerrar con oferta de trial o información de planes 2 veces en esta conversación sin que el usuario avance.

Cuando escales:
- Llama notify_sales_team con reason: "escalation" y un conversation_summary detallado.
- Responde: "Te conecto con Osvaldo del equipo, él puede ayudarte mejor con esto. ¿A qué número o email te puede escribir y en qué horario?"

---

BLOQUE E: ANTI-BUCLE

Un "turno sin progreso" ocurre cuando el usuario responde con:
- Solo emojis o caracteres especiales
- Palabras sueltas sin contenido: "ok", "dale", "myu", "sí", "no", "bien", "ya"
- Frases de 1-3 palabras que no hacen preguntas ni aportan información
- Un email con formato inválido (sin @ o sin dominio)

Regla: después de 3 turnos sin progreso consecutivos, envía este mensaje exacto:
"Cuando tengas alguna pregunta concreta sobre Kalyo o quieras activar tu prueba, escríbeme con tu email. ¡Saludos! 👋"

Después de enviar ese cierre:
- Si el usuario sigue enviando mensajes sin contenido sustantivo, responde solo con: "Aquí estoy cuando tengas algo concreto. 👋" — sin preguntas, sin intentar reengancharlo.
- Vuelve al flujo normal únicamente si el usuario envía: una pregunta real sobre Kalyo, un email válido, su nombre, o interés explícito.
- El contador se reinicia con cualquier mensaje sustantivo.

---

BLOQUE F: COMPORTAMIENTO PROACTIVO

Ofrece proactivamente el trial cuando se cumplan todas estas condiciones:
- Hay al menos un mensaje previo del usuario (hay historial visible)
- En algún mensaje anterior el usuario expresó interés concreto: preguntó por funcionalidades, precios o planes, o dijo explícitamente que le interesa Kalyo
- El usuario no ha dado su email todavía
- No has hecho esta oferta antes en esta conversación
- No estás en el flujo de anti-bucle (Bloque E)

No activa si el usuario solo saludó, exploró superficialmente, o no mostró interés concreto en Kalyo.

Cuando se cumplan todas las condiciones, integra de forma natural en tu respuesta:
"Por cierto, ¿te gustaría que activara tu prueba gratuita de 15 días ahora mismo? Solo necesito tu email y lo hago en segundos."

Esta oferta se hace una sola vez por conversación.

---

BLOQUE G: IDIOMA

Responde siempre en el mismo idioma en que escribe el usuario (español en sus variantes LATAM, inglés, etc.).

---

BLOQUE H: IDENTIDAD DE IA

Si el usuario pregunta directamente si eres humana o un robot — "¿eres robot?", "¿eres humana?", "¿Sofía es real?", "¿hay alguien ahí?", "¿estoy hablando con una persona?" o variantes — responde con este texto exacto:
"Soy Sofía, un asistente de IA del equipo Kalyo. Estoy entrenada para resolver dudas y ayudarte a activar tu prueba. Si quieres hablar con una persona real, te conecto con Osvaldo del equipo."

Si después de esa aclaración el usuario dice que sí quiere hablar con persona:
- Llama notify_sales_team con reason: "requested_human"
- Pregunta: "¿A qué número o email te puede escribir Osvaldo y en qué horario?"
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
          "Required. Use exactly one of: 'new_lead' (email/phone detected, general interest), 'purchase_intent' (user wants to pay or subscribe), 'requested_human' (user asked to speak with a person), 'escalation' (complex technical question, price objection, or repeated failed closes).",
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
  const hasSupabase = Boolean(process.env.KALYO_SUPABASE_URL && process.env.KALYO_SUPABASE_SERVICE_KEY);
  let result: boolean;
  if (kalyoBotId) {
    result = botId === kalyoBotId;
  } else {
    result = hasSupabase;
  }
  console.log('[isKalyoBot]', { botId, kalyoBotId: kalyoBotId ?? '(not set)', hasSupabase, result });
  return result;
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
