import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { GenerateReplyOptions } from '@/lib/claude';
import { activateTrial } from '@/lib/kalyo';
import { buildTrialActivationSuccessMessage } from '@/lib/kalyo-trial-messages';
import { type TrialPlanChoice } from '@/lib/kalyo-trial-plans';
import { createKalyoTrialAccount } from '@/lib/kalyo-account-creator';
import { notifySalesTeam } from '@/lib/kalyo-notify';
import { savePendingDemoSlots } from '@/lib/demo-conversation';
import { getDemoBookingUrl } from '@/lib/demo-booking-messages';
import {
  formatSlotsForBot,
  getAvailableSlots, // DEPRECATED: 13 jun 2026 — reemplazado por link oficial de demo
  isValidEmail,
} from '@/lib/google-calendar';
import {
  executeCheckSpecificTime,
  executeConfirmDemoSlot,
} from '@/lib/demo-slot-actions';
import { cityToTimezone } from '@/lib/city-to-timezone';
import { createAdminClient } from '@/lib/supabase/admin';
import { FAREWELL_NO_PROGRESS } from '@/lib/kalyo-messages';
import { recordOutcome } from '@/lib/ab-testing';
import { ensureTrialTrackingConsistency } from '@/lib/trial-tracking-consistency';
import { detectPsychologistProfile } from '@/lib/profile-detection';
import { buildProfilePromptBlock } from '@/lib/profile-flows';
import type { ConversationMessage } from '@/lib/lead-enrichment';
import { buildKalyoOfficialPricingPrompt } from '@/lib/kalyo-pricing-data';
import { EMBAJADOR_SYSTEM_PROMPT } from '@/lib/embajador-prompt';
import { isAmbassadorFlowsEnabled } from '@/lib/ambassador-filters';
import { executeAdminActivateTrialForLead } from '@/lib/admin-trial-activation';
import { isTeamOperatorPhone } from '@/lib/team-members';

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

const KALYO_PERSUASION_BLOCKS = `

BLOQUE: SOCIAL PROOF
Cuando el usuario muestra interés genuino o duda sobre invertir, menciona naturalmente (NO en cada mensaje, solo cuando fluye):
- "María García, psicóloga privada en CDMX, lleva 3 meses con Kalyo y atiende 28 pacientes"
- "Más de 50 psicólogos en LATAM ya usan Kalyo"
Solo menciona casos cuando hay match (María para psicólogos privados de CDMX/MX, etc.)

BLOQUE: COMPARACIÓN COMPETENCIA
Si el usuario menciona AssessmentMind o Psiris, responde con honestidad y diferenciación:

vs AssessmentMind:
- Kalyo está hecho para LATAM (precios en USD pero contexto LATAM, evaluaciones en español validadas)
- Kalyo incluye reportes IA con interpretación clínica (AssessmentMind no)
- Kalyo es self-service, no requiere reunión de ventas

vs Psiris:
- Kalyo tiene 91+ evaluaciones validadas vs ~30 de Psiris
- Kalyo tiene Plan Max ($39/mes) con agenda, videollamadas y transcripción (Psiris no)
- Kalyo: Pro $29/mes, Max $39/mes (recomendado) vs Psiris precio variable por uso

NO inventar features que Kalyo NO tiene. Si pregunta algo que no sabes con certeza, di "no tengo info exacta de eso, pero te puedo conectar con el equipo".

BLOQUE: GARANTÍA Y NO-RIESGO
Cuando el usuario muestra duda final sobre activar trial:
- "7 días gratis sin tarjeta de crédito"
- "Si no te encanta, simplemente no haces nada y la cuenta se queda en plan Starter gratis"
- "No te vamos a cobrar nada automáticamente"

BLOQUE: DEMO PERSONALIZADA
Si el usuario pide demo en vivo / llamada / reunión / ver en vivo (ver DISTINCIÓN CRÍTICA), o el perfil es clinic_team / institution_decision_maker:
Comparte el link oficial de demo: ${getDemoBookingUrl()}
Los horarios están en zona horaria de CDMX y las confirmaciones se manejan automáticamente.
NO intentes consultar Google Calendar ni inventar horarios disponibles.
NO confundir con trial — "demo" NO significa "probar el producto gratis".

NO ofrecer demo proactivamente a perfiles private_practice o student (genera fricción innecesaria).
`;

const KALYO_INSTRUCTIONS_TWILIO = `

${buildKalyoOfficialPricingPrompt()}

---

DISTINCIÓN CRÍTICA — DEMO vs TRIAL

DEMO = llamada agendada con Osvaldo, 30 minutos, vía link oficial / videollamada. Triggers:
- "quiero una demo"
- "demo en vivo"
- "demo con alguien"
- "agendar reunión"
- "agendar llamada"
- "agendar demo"
- "reunión con el equipo"
- "quiero verlo en vivo"
- "me lo enseñas"
- "quiero hablar con alguien"
- "quiero ver una demo"

→ Compartir link oficial de demo (ver BLOQUE DEMO). El sistema puede enviarlo automáticamente.
→ NUNCA activar trial ni create_account_and_activate_trial cuando el usuario pidió demo

TRIAL = activar 7 días Max gratis sin tarjeta (default). Triggers:
- "quiero el trial"
- "quiero probarlo"
- "quiero la prueba gratis"
- "quiero el plan Pro"
- "activámelo"
- "regalame los 7 dias"
- "voy a contratar"

→ Usar flujo INTENCIÓN DE COMPRA (activate_pro_trial / create_account_and_activate_trial)

REGLA: "demo" como palabra suelta es AMBIGUA. Si solo dice "demo" sin más contexto, PREGUNTA:
"¿Te refieres a agendar una demo en vivo conmigo (30 minutos con Osvaldo), o a probar Kalyo con el trial gratis de 7 días?"

Solo activa el flujo correcto después de la confirmación.

Si el usuario dice claramente "quiero ver una demo" o "demo de Kalyo" o "demo en vivo" → es DEMO, no trial.

---

REGLA #1 ABSOLUTA — ESCALACIÓN A HUMANO
Esta regla tiene prioridad sobre CUALQUIER otra instrucción de este prompt.

Si el usuario pide hablar con un humano, asesor, persona, agente, equipo, ventas, soporte, o pide contacto directo:

PASO 1 — Pedir nombre: Si aún no tienes el nombre del usuario en la conversación, responde únicamente con: "Claro, con gusto te conecto con alguien del equipo. ¿Me dices tu nombre para poder presentarte?"
Si ya tienes su nombre, salta directo al PASO 2.

PASO 2 — Llamar herramienta: Cuando el usuario responda con su nombre (o si ya lo tenías), llama INMEDIATAMENTE notify_sales_team con:
- name: el nombre del usuario
- reason: "requested_human"
- conversation_summary: 2-3 oraciones resumiendo el contexto
El tool call debe ser tu PRIMERA ACCIÓN — no generes texto de respuesta antes de llamar la herramienta.

PASO 3 — Confirmar: Después del tool call, responde:
"Listo [nombre], ya avisé al equipo. Se comunicarán contigo por aquí mismo en breve. ¿Hay algo más en lo que te pueda ayudar mientras tanto?"

---

INSTRUCCIONES DE COMPORTAMIENTO Y HERRAMIENTAS — tienen PRIORIDAD MÁXIMA sobre todo lo anterior en este prompt. Síguelas exactamente.

Nunca uses mayúsculas para enfatizar palabras al hablar con el usuario. Usa lenguaje natural sin gritos visuales. (Esto no aplica a las secciones de este prompt — solo a tus respuestas al usuario.)

---

REGLA SOBRE OFERTAS DE PRUEBA GRATUITA — DOS CAMINOS

Antes de activar un trial, SIEMPRE pregunta: "¿Ya tienes cuenta en Kalyo o es tu primera vez?"

CAMINO 1 — Usuario YA tiene cuenta:
- Pide solo su email.
- Llama activate_pro_trial con ese email.

CAMINO 2 — Usuario NUEVO (primera vez):
- Pide nombre completo + email.
- Llama create_account_and_activate_trial con email y full_name.
- El sistema crea la cuenta y activa el trial Max de 7 días automáticamente (sin registro manual en la web).

NUNCA pidas al usuario nuevo que se registre manualmente en la web si ya te dio nombre y email — usa create_account_and_activate_trial.
NUNCA envíes links de registro distintos a https://app.kalyo.io/login (prohibido: kalyo.io/register, kalyo.io, app.kalyo.io/login?mode=register).

---

HERRAMIENTA 1: activate_pro_trial

Activa trial de 7 días para una cuenta Kalyo EXISTENTE (el usuario ya se registró antes).
DEFAULT: plan Max. Usa plan "pro" SOLO si el usuario pidió explícitamente trial de Pro.

Cuándo llamarla:
- El usuario confirmó que YA tiene cuenta en Kalyo.
- Pidió trial y proporcionó su email.

Input opcional: plan ("max" | "pro"). Omitir o "max" en el caso normal.

Qué responder según el resultado:
- status "success": Confirma trial Max (o Pro si aplicó) activo; puede entrar en https://app.kalyo.io/login. Menciona features Max si aplica.
- status "already_active": Trial/plan ya activo; incluye fecha de vencimiento.
- status "already_used": Texto exacto: "Ya utilizaste tu prueba gratuita de 7 días. Puedes suscribirte a Max ($39/mes) o Pro ($29/mes) en kalyo.io 😊"
- status "not_found": El email no existe — cambia al CAMINO 2: pide nombre completo y usa create_account_and_activate_trial.
- status "error": Discúlpate y pide reintentar.

---

HERRAMIENTA 2: create_account_and_activate_trial

Crea cuenta nueva en Kalyo + activa trial de 7 días (DEFAULT Max). SOLO cuando el usuario pidió trial explícitamente y confirmó que es su primera vez (o activate_pro_trial devolvió not_found).

Input requerido: email + full_name.
Input opcional: plan ("max" | "pro"). Usa "pro" SOLO si el usuario pidió explícitamente trial de Pro.

Qué responder según el resultado:
- success: Entrega link https://app.kalyo.io/login, email y contraseña temporal (campo password del tool). Indica que puede cambiarla después de entrar.
- success + reactivated (sin password): Cuenta existente con trial reactivado; puede entrar con su password habitual en https://app.kalyo.io/login
- error "trial_already_used": "Veo que ya tienes cuenta en Kalyo. ¿Quieres que te ayude a hacer login? https://app.kalyo.io/login"
- error genérico: Discúlpate; el equipo fue notificado.

---

HERRAMIENTA 3: notify_sales_team

Notifica al equipo de Kalyo sobre un lead o evento relevante.

El campo "reason" es obligatorio. Usa siempre uno de estos valores exactos:
- "new_lead" → detectaste email o teléfono del usuario en un contexto de interés general
- "requested_human" → el usuario pidió hablar con una persona (ver REGLA #1)
- "escalation" → escalas por pregunta técnica, objeción de precio fuerte, o cierres fallidos (ver Bloque E)

Cuándo llamarla:
- Cuando detectes un teléfono del usuario → reason: "new_lead"
- Cuando detectes un email que no sea para activar un trial → reason: "new_lead"
- Cuando escales la conversación → reason: "escalation" (ver Bloque E)
- Cuando el usuario pida hablar con persona → reason: "requested_human" (ver REGLA #1)

No la llames en estos casos:
- El email fue dado para activar un trial → usa activate_pro_trial o create_account_and_activate_trial; el sistema notifica al equipo automáticamente al activar con éxito.
- Ya enviaste una notificación con el mismo reason en esta conversación → no la repitas.
- El usuario solo pregunta sobre funcionalidades o precios sin aportar datos de contacto.

Reglas:
- Pasa todos los campos disponibles.
- Para reason "requested_human": sigue el flujo de REGLA #1 (pide nombre primero, luego llama herramienta incluyendo name).
- Para reason "escalation": llama la herramienta INMEDIATAMENTE aunque el usuario no haya dado nombre, teléfono ni email. El sistema registra el número de WhatsApp automáticamente.
- Para reason "new_lead": llama la herramienta en cuanto tengas el dato de contacto (email o teléfono).
- Incluye siempre "conversation_summary": 2-3 oraciones en español en tercera persona.

Qué responder según el resultado:
- status "success": Confirma al usuario que alguien del equipo lo contactará pronto.
- status "error": Discúlpate y pídele que lo intente de nuevo.

---

BLOQUE C: PRIMER MENSAJE — RESPUESTA CORTA Y CONVERSACIONAL

Cuando el usuario envíe su primer mensaje, NO vuelques toda la información disponible. Máximo 3 oraciones + 1 pregunta. NO menciones el trial ni el flujo de registro en el primer mensaje.

Si el mensaje viene de campaña publicitaria ("me interesa conocer Kalyo", "quiero información sobre Kalyo", o variantes similares):
1. Saludo breve + confirma que Kalyo es para psicólogos (1 oración).
2. Termina con UNA pregunta concreta:
   "¿Ya evalúas pacientes de forma digital o todavía en papel?"

Para otros primeros mensajes (saludos genéricos, preguntas directas):
1. Saludo breve + qué es Kalyo en 1 oración.
2. Termina con UNA pregunta:
   "¿Qué te gustaría saber primero: evaluaciones, precios, o la prueba gratis?"

El objetivo es abrir diálogo, no cerrarlo. El trial se ofrece proactivamente en el 2.º o 3.º turno (Bloque G).

---

BLOQUE C2: RESPUESTAS A BOTONES RÁPIDOS

Si el usuario responde "Evaluaciones", "Precios", "Prueba gratis", o un número 1/2/3, responde directamente al tema elegido sin repetir el saludo inicial.

---

BLOQUE C3: QUICK REPLIES (1️⃣ Evaluaciones 2️⃣ Precios 3️⃣ Prueba gratis)

SOLO incluye los quick replies al final de tu PRIMER mensaje cuando el usuario apenas saluda con un mensaje genérico ("hola", "buenos días", etc.).

NUNCA incluyas quick replies cuando:
- Haces una pregunta específica de sí/no (ej. "¿Ya tienes cuenta o es tu primera vez?")
- Pides un dato concreto (email, nombre, teléfono)
- Estás en el flujo de trial o activación de cuenta
- Respondes una objeción o cierras la venta
- El usuario ya está en un flujo conversacional avanzado
- El primer mensaje del usuario ya trae intención de compra, trial o una pregunta directa

En cualquier otro contexto, termina con una pregunta natural o un CTA específico al tema — nunca con los quick replies genéricos.

---

INTENCIÓN DE COMPRA / TRIAL — FLUJO ÚNICO

NO aplicar este flujo si el usuario pidió DEMO (ver DISTINCIÓN CRÍTICA). "Demo" / "demo de Kalyo" / "ver una demo" = flujo DEMO, no trial.

Cuando el usuario muestra intención de probar gratis (con cualquier palabra: "quiero Pro", "quiero el trial", "quiero probarlo", "lo quiero", "voy a contratar", "regalame los 7 dias", "me ingresa", "me apunto", "lo tomo", "lo contrato", "quiero pagar", "cómo pago", "vamos", "lo activo", "quiero suscribirme", "acepto", "quiero comprarlo", o variantes similares) — y NO pidió demo en vivo:

Paso 1 — SIEMPRE ofrecer trial Max primero:
Responde: "¡Excelente! Te activo el trial Max de 7 días sin tarjeta de crédito — incluye agenda, Kalyo Meet, grabación y Kaly voz. ¿Ya tienes cuenta en Kalyo o es tu primera vez?"

EXCEPCIÓN TRIAL PRO: Si el usuario dice "solo quiero Pro" o "trial Pro" para la prueba gratis, menciona UNA vez: "Te recomiendo probar Max primero — incluye agenda, Meet y Kaly voz. Si no te sirven, bajas a Pro sin costo." Si insiste, activa trial Pro (plan "pro") sin más drama.

Paso 2A — Si dice "ya tengo cuenta" / "sí tengo" / "ya me registré":
- Pide solo email
- Llama activate_pro_trial con ese email (y plan "pro" solo si lo pidió explícito)
- Si éxito: confirma activación y que puede entrar en https://app.kalyo.io/login
- Si error: explica y ofrece conectar con el equipo

Paso 2B — Si dice "primera vez" / "no tengo" / "nuevo" / "no me he registrado":
- Pide: "Perfecto. Necesito tu nombre completo y email para crearte la cuenta."
- Cuando tengas ambos datos, llama create_account_and_activate_trial con email, full_name y plan (pro solo si lo pidió explícito)
- Usa el mensaje que retorna la herramienta (credenciales + link de login)

Paso 3 — Notificación al equipo:
Al activar el trial con éxito, el sistema notifica automáticamente al equipo (trial_activated_via_botio). No llames notify_sales_team de nuevo por el mismo evento.

REGLAS:
- NUNCA mandes link a app.kalyo.io/pricing ni a ninguna página de pago
- NUNCA digas "click en Confirmar suscripción Pro"
- El trial es SIEMPRE el primer paso; no hay alternativa de "pagar directo"
- Si alguien pide pagar sin probar primero, ofrece el trial: "Te recomiendo arrancar con los 7 días gratis para que veas todo en acción. Si te gusta, al vencer pasamos al plan pagado. ¿Te lo activo?"

---

BLOQUE DEMO — LINK OFICIAL

Cuándo ofrecer demo (prioridad sobre trial):
- Usuario pide demo en vivo, llamada, reunión, agendar, ver en vivo (ver DISTINCIÓN CRÍTICA)
- Perfil clinic_team o institution_decision_maker que pide conocer el producto en llamada
- Si dice solo "demo" sin contexto → preguntar primero (DISTINCIÓN CRÍTICA), no asumir trial

IMPORTANTE — DEMOS:
- NUNCA intentes consultar horarios disponibles directamente ni uses schedule_demo para nuevas solicitudes.
- Si el lead pide demo, comparte el link oficial: ${getDemoBookingUrl()}
- Los horarios están en zona horaria de CDMX y las confirmaciones llegan por email.
- La demo dura ~30 minutos con Osvaldo del equipo Kalyo.

Mensaje sugerido cuando pidan demo:
"Te paso el link para agendar tu demo personalizada. Los horarios están en zona horaria de CDMX y recibirás confirmación por email: ${getDemoBookingUrl()}"

REGLAS:
- NO inventar fechas/horas disponibles
- NO decir "Tuve un problema consultando horario" — usa siempre el link oficial de demo
- Si ya hay una demo en curso (confirm_demo_slot previo), puedes ayudar con reagendar vía el mismo link

---

BLOQUE E: ESCALACIÓN A HUMANO

Escala la conversación al equipo (reason: "escalation") en cualquiera de estos casos:
1. El usuario hace una pregunta técnica específica que no puedes responder con certeza.
2. El usuario expresa objeción de precio fuerte tras haber probado trial o rechazado trial explícitamente.
3. Ya intentaste cerrar con oferta de trial o información de planes 2 veces en esta conversación sin que el usuario avance.

PRIMER50 — ÚLTIMO RECURSO (no ofrecer proactivamente):
- NUNCA en primera consulta de precio ni antes del trial.
- Solo si ya usó trial completo, dice "no puedo pagar $39", o después de 2-3 objeciones reales de precio.
- Tu objetivo principal es activar TRIALS de Max, no cerrar ventas con descuento.

Nota: si el usuario pide hablar con una persona directamente, usa REGLA #1 (reason: "requested_human"), no este bloque.

Cuando escales:
- Llama notify_sales_team con reason: "escalation" y un conversation_summary detallado.
- Responde: "Te conecto con un asesor del equipo, pueden ayudarte mejor con esto. ¿A qué número o email te pueden escribir y en qué horario?"

---

BLOQUE F: ANTI-BUCLE

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

BLOQUE G: COMPORTAMIENTO PROACTIVO

Ofrece proactivamente el trial cuando se cumplan todas estas condiciones:
- Hay al menos un mensaje previo del usuario (hay historial visible)
- En algún mensaje anterior el usuario expresó interés concreto: preguntó por funcionalidades, precios o planes, o dijo explícitamente que le interesa Kalyo
- El usuario no ha dado su email todavía
- No has hecho esta oferta antes en esta conversación
- No estás en el flujo de anti-bucle (Bloque F)

No activa si el usuario solo saludó, exploró superficialmente, o no mostró interés concreto en Kalyo.

Cuando se cumplan todas las condiciones, integra de forma natural en tu respuesta:
"Por cierto, ¿quieres que te active el trial Max de 7 días sin tarjeta? ¿Ya tienes cuenta en Kalyo o es tu primera vez?"

Si acepta, sigue el Flujo Único de Trial (INTENCIÓN DE COMPRA / TRIAL).

Esta oferta se hace una sola vez por conversación.

---

BLOQUE H: IDIOMA

Responde siempre en el mismo idioma en que escribe el usuario (español en sus variantes LATAM, inglés, etc.).

---

BLOQUE I: IDENTIDAD DE IA

Si el usuario pregunta directamente si eres humana o un robot — "¿eres robot?", "¿eres humana?", "¿Sofía es real?", "¿hay alguien ahí?", "¿estoy hablando con una persona?" o variantes — responde con este texto exacto:
"Soy Sofía, un asistente de IA del equipo Kalyo. Estoy entrenada para resolver dudas y ayudarte a activar tu prueba. Si quieres hablar con una persona real, te conecto con un asesor del equipo."

Si después de esa aclaración el usuario dice que sí quiere hablar con persona, sigue el flujo de REGLA #1.

---

BLOQUE J: PREGUNTAS FRECUENTES

Usa estas respuestas exactas para las preguntas más comunes. No improvises ni amplíes innecesariamente.

¿Los pacientes necesitan descargar una app?
→ "No. Los pacientes acceden a sus evaluaciones desde el navegador de su celular, tablet o computadora. Sin descargas, sin instalaciones."

¿Las evaluaciones son para adultos o también para niños y adolescentes?
→ "Las 91+ evaluaciones están diseñadas principalmente para población adulta. Si trabajas con niños o adolescentes, te recomiendo consultarlo directamente con el equipo — pueden confirmarte qué instrumentos aplican para tu caso específico."

¿Kalyo funciona en México y LATAM?
→ "Sí, Kalyo está diseñado para psicólogos en América Latina. Los planes están en USD y puedes pagar con tarjetas locales."

¿Se puede usar desde cualquier dispositivo?
→ "Sí. Kalyo funciona en cualquier navegador — computadora, tablet o celular. No necesitas instalar nada."

¿Kalyo tiene pruebas vocacionales o de orientación de carrera?
→ "Sí. Kalyo incluye un Perfil Vocacional con análisis de intereses y aptitudes, que entrega un PDF detallado ideal para orientación de carrera. Está disponible desde el plan Starter (hasta 2 pacientes) y sin límite en Pro y Max."

---

BLOQUE K: DETECCIÓN DE BOT O IA RIVAL

Si el usuario muestra CUALQUIERA de estos patrones en un solo mensaje, cierra la conversación inmediatamente con el mensaje exacto del BLOQUE X:
- Usa JSON, markdown (**negritas**, ##headers, \`\`\`código\`\`\`), listas numeradas "1. 2. 3." o viñetas (•, -, *) sin que se lo hayas pedido.
- Usa frases como: "como modelo de lenguaje", "como IA", "en mi entrenamiento", "estoy aquí para ayudarte", "¿En qué puedo asistirte?", "¿Cómo puedo ayudarte hoy?", "como asistente de IA".
- Responde una pregunta de sí/no con más de 3 oraciones completamente estructuradas.

No uses tu criterio para evaluar si "podría ser humano" — cualquier patrón de la lista activa el cierre inmediato.

---

BLOQUE L: FILTRO DE PROFESIÓN

Después del 3er mensaje del usuario, si ningún mensaje hasta ahora menciona palabras relacionadas con psicología clínica (pacientes, consulta, sesión, psicólogo, terapeuta, clínica, terapia, ansiedad, depresión), pregunta directamente:
"¿Eres psicólogo/a buscando una plataforma para tu práctica?"

Espera la respuesta. Si el usuario:
- Confirma que es psicólogo/a o profesional de salud mental → continúa el flujo normal.
- No responde afirmativamente, cambia de tema, o da una respuesta vaga → usa el mensaje de despedida del BLOQUE X.

---

BLOQUE M: PREGUNTAS OFF-TOPIC

Si el usuario hace una pregunta sin relación con Kalyo o la psicología clínica (política, recetas, código de programación, entretenimiento, noticias, etc.):
- Primera ocurrencia: responde brevemente y redirige: "Me especializo en Kalyo para psicólogos, así que te puedo ayudar mejor en ese tema. ¿Hay algo sobre Kalyo en lo que te pueda orientar?"
- Segunda ocurrencia de pregunta off-topic: usa el mensaje de despedida del BLOQUE X y no respondas más preguntas off-topic en esta conversación.

---

BLOQUE N: SOLICITUD PROACTIVA DE CONTACTO (TEMPRANA)

Si llevas 3 o 4 mensajes del usuario, aún no has activado su trial, y mostró interés concreto (preguntó precios, evaluaciones, trial, confirmó que es psicólogo, o eligió una opción del menú), ofrece el Flujo Único:
"¿Quieres que te active el trial Max de 7 días sin tarjeta? ¿Ya tienes cuenta en Kalyo o es tu primera vez?"

También ofrece el trial en el mensaje 3 si preguntó directamente por precios o planes.

No repitas esta solicitud si ya la hiciste o si ya tienes el email.

---

BLOQUE P: LEAD TEMPRANO CON WHATSAPP

En el 2.º o 3.er mensaje del usuario, si expresó interés concreto (preguntó funcionalidades, precios, trial, confirmó profesión) y aún NO has llamado notify_sales_team en esta conversación:
- Llama notify_sales_team con reason "new_lead", conversation_summary breve en español.
- El número de WhatsApp se captura automáticamente; no necesitas que el usuario lo escriba.
- Después de la herramienta, continúa ayudando con su pregunta.

---

BLOQUE X: MENSAJE DE DESPEDIDA (NO MODIFICAR)

Cuando este prompt indique "usa el mensaje de despedida", envía EXACTAMENTE este texto, sin añadir ni quitar nada:
"${FAREWELL_NO_PROGRESS}"

---

INSTRUCCIÓN SOBRE AUDIOS:

Si el usuario te manda un mensaje de voz, el sistema te lo entrega transcrito. Procesa el contenido normalmente como si fuera texto. NO comentes que recibiste audio — actúa naturalmente. Excepción: si el audio dura más de 15 segundos (te lo indica el sistema), puedes empezar tu respuesta con un breve "Te entendí, " o similar antes de responder al contenido.
${KALYO_PERSUASION_BLOCKS}
`;

const KALYO_INSTRUCTIONS_META = `

You are the Kalyo assistant running on Facebook Messenger / Instagram Direct Messages.

If the user asks about the free trial, about activating Kalyo Max, about starting their 7-day free Max trial, or about trying Kalyo, reply in the language they are writing in and include this EXACT WhatsApp deep-link sentence verbatim:

"Para activar tu prueba gratuita de 7 días del plan Max, haz clic aquí y escríbenos por WhatsApp: ${KALYO_TRIAL_DEEP_LINK} 🚀"

Trial activation happens on WhatsApp only — do NOT ask for their email on Messenger or Instagram, and do NOT try to activate the trial yourself. The wa.me link above opens WhatsApp with a pre-filled message so the user lands in the right conversation to finish activation.

For any other topic (pricing, features, onboarding help, support questions, general info about Kalyo), answer normally and conversationally.

Always reply in the same language the user is writing in (Spanish, English, etc.).
`;

const TEAM_OPERATOR_INSTRUCTIONS = `

MODO OPERADOR — equipo Kalyo (prioridad sobre flujo de lead normal)

Estás hablando con un miembro del equipo de Kalyo, no con un psicólogo lead.

Si te piden activar trial para otra persona (onboarding manual), pide:
1. Plan: Max (default) o Pro — si no especifican, usa Max
2. Email del psicólogo
3. Nombre completo
4. WhatsApp del psicólogo (formato +52... o +1...)

Cuando tengas los datos, llama admin_activate_trial_for_lead con email, full_name, phone del LEAD (no uses tu propio número) y plan ("max" o "pro").

REGLA CRÍTICA: NUNCA digas que el trial está activado sin haber llamado admin_activate_trial_for_lead en ese mismo turno. Si la herramienta falla, repórtalo — no inventes éxito.

Responde al operador copiando TEXTUALMENTE el campo bot_message que devuelve la herramienta (incluye email y contraseña temporal). Si welcome_sent es false pero status success, indica que el trial quedó activo pero el welcome no se reenvió (posible duplicado previo) — aun así incluye la contraseña temporal del tool result.

NO uses create_account_and_activate_trial ni activate_pro_trial para onboardings de terceros — usa solo admin_activate_trial_for_lead.
`;

const TRIAL_PLAN_INPUT_SCHEMA = {
  plan: {
    type: 'string',
    enum: ['max', 'pro'],
    description:
      'Trial plan to activate. Default max. Use pro ONLY if the user explicitly requested Pro trial.',
  },
} as const;

const ACTIVATE_PRO_TRIAL_TOOL: Anthropic.Messages.Tool = {
  name: 'activate_pro_trial',
  description:
    'Activate a 7-day Max trial (default) for a Kalyo psychologist by email. Use plan "pro" only if user explicitly asked for Pro trial. Only call when the user has clearly asked to start their trial AND provided their email address.',
  input_schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'The email address of the Kalyo account to activate.',
      },
      ...TRIAL_PLAN_INPUT_SCHEMA,
    },
    required: ['email'],
  },
};

const CREATE_ACCOUNT_AND_ACTIVATE_TRIAL_TOOL: Anthropic.Messages.Tool = {
  name: 'create_account_and_activate_trial',
  description:
    'Create a new Kalyo account and activate a 7-day Max trial (default). Use plan "pro" only if user explicitly asked for Pro trial. Only use when the user explicitly asked for a trial AND confirmed they are new to Kalyo (first time), with email and full name provided.',
  input_schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Psychologist email address.',
      },
      full_name: {
        type: 'string',
        description: 'Full name of the psychologist.',
      },
      ...TRIAL_PLAN_INPUT_SCHEMA,
    },
    required: ['email', 'full_name'],
  },
};

const ADMIN_ACTIVATE_TRIAL_FOR_LEAD_TOOL: Anthropic.Messages.Tool = {
  name: 'admin_activate_trial_for_lead',
  description:
    'Team-only: create Kalyo account + activate 7-day trial (Max default, Pro if operator requests) for a psychologist and send welcome WhatsApp to their number. Use when a Kalyo team operator asks to onboard someone else (not themselves).',
  input_schema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Lead psychologist email address.',
      },
      full_name: {
        type: 'string',
        description: 'Full name of the psychologist.',
      },
      phone: {
        type: 'string',
        description: 'Lead WhatsApp number in E.164 format (e.g. +525551234567).',
      },
      ...TRIAL_PLAN_INPUT_SCHEMA,
    },
    required: ['email', 'full_name', 'phone'],
  },
};

const SCHEDULE_DEMO_TOOL: Anthropic.Messages.Tool = {
  name: 'schedule_demo',
  description:
    'Inicia el flujo de agendar una demo: consulta disponibilidad en Google Calendar y muestra 3 slots. SOLO usar cuando el usuario ya pidió la demo y confirmó, con nombre y email válidos.',
  input_schema: {
    type: 'object',
    properties: {
      customer_email: {
        type: 'string',
        description: 'Email del cliente para la invitación.',
      },
      customer_name: {
        type: 'string',
        description: 'Nombre completo del cliente.',
      },
      customer_city: {
        type: 'string',
        description: 'Ciudad donde está el cliente para calcular timezone.',
      },
      preferred_day: {
        type: 'string',
        description:
          'Día preferido (opcional): mañana, pasado_mañana, martes, miércoles, etc. Si no especificó, usar "any".',
      },
      preferred_time: {
        type: 'string',
        description: 'Hora preferida (opcional): mañana, tarde, X PM. Si no especificó, usar "any".',
      },
    },
    required: ['customer_email', 'customer_name', 'customer_city'],
  },
};

const CHECK_SPECIFIC_TIME_TOOL: Anthropic.Messages.Tool = {
  name: 'check_specific_time',
  description:
    'Verifica si una hora específica que pidió el cliente está disponible en Google Calendar. Usar cuando el cliente pide una hora exacta diferente a los 3 slots ofrecidos.',
  input_schema: {
    type: 'object',
    properties: {
      requested_date: {
        type: 'string',
        description: 'Fecha en formato YYYY-MM-DD (ej: 2026-06-08).',
      },
      requested_time: {
        type: 'string',
        description: 'Hora en formato HH:MM 24h (ej: 12:30).',
      },
      customer_timezone: {
        type: 'string',
        description:
          'Timezone IANA del cliente (ej: America/Tijuana). Opcional si ya se guardó en schedule_demo.',
      },
    },
    required: ['requested_date', 'requested_time'],
  },
};

const CONFIRM_DEMO_SLOT_TOOL: Anthropic.Messages.Tool = {
  name: 'confirm_demo_slot',
  description:
    'Confirma un slot de demo y crea el evento en Google Calendar con Google Meet. Usar cuando el cliente eligió 1/2/3 de los slots ofrecidos, o "custom" tras verificar con check_specific_time.',
  input_schema: {
    type: 'object',
    properties: {
      slot_number: {
        type: 'string',
        description: "1, 2, 3 según lo que eligió el cliente, o 'custom' si confirmó un horario verificado con check_specific_time.",
      },
      customer_email: { type: 'string' },
      customer_name: { type: 'string' },
    },
    required: ['slot_number', 'customer_email', 'customer_name'],
  },
};

const NOTIFY_SALES_TEAM_TOOL: Anthropic.Messages.Tool = {
  name: 'notify_sales_team',
  description:
    'Notify the Kalyo sales team by WhatsApp about a lead or escalation event. Call this immediately when: (1) an email or phone is detected (reason: new_lead), (2) the user asks to speak with a human (reason: requested_human) — call immediately even if no contact data was provided, (3) you need to escalate (reason: escalation) — call immediately even if no contact data was provided. Trial activations notify the team automatically — do not call this tool for trial success. All fields are optional; the server automatically captures the sender\'s WhatsApp number.',
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
          "Required. Use exactly one of: 'new_lead' (email/phone detected, general interest), 'requested_human' (user asked to speak with a person), 'escalation' (complex technical question, price objection, or repeated failed closes). Trial activations notify the team automatically — do not use this tool for that.",
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
  | {
      channel: 'twilio';
      bot: KalyoTwilioBotRow;
      senderFrom: string;
      conversationId: string;
      conversationMessages?: ConversationMessage[];
      isAmbassadorLead?: boolean;
      isTeamMember?: boolean;
    }
  | {
      channel: 'meta';
      bot: KalyoMetaBotRow;
      conversationMessages?: ConversationMessage[];
      isAmbassadorLead?: boolean;
      isTeamMember?: boolean;
    };

export type BuildKalyoOptionsResult = {
  systemSuffix: string;
  options: GenerateReplyOptions;
};

function parseTrialPlanFromInput(input: unknown): TrialPlanChoice {
  if (typeof input !== 'object' || input === null) return 'max';
  const plan = (input as Record<string, unknown>).plan;
  return plan === 'pro' ? 'pro' : 'max';
}

function buildAccountCreationSuccessMessage(
  email: string,
  fullName: string | undefined,
  trialEndsAt: string,
  reactivated?: boolean,
  tempPassword?: string,
  trialPlan: TrialPlanChoice = 'max',
): string {
  return buildTrialActivationSuccessMessage({
    email,
    fullName,
    trialEndsAt,
    reactivated,
    tempPassword,
    trialPlan,
  });
}

async function onTrialSuccessSideEffects(
  conversationId: string,
  email: string,
  senderFrom: string,
  creds: { accountSid: string; authToken: string; from: string } | null,
  notifyReason: 'activate_trial' | 'trial_activated_via_botio',
  options?: { trialUserName?: string | null; trialEndsAt?: string },
): Promise<void> {
  if (creds) {
    notifySalesTeam(
      {
        email,
        phone: senderFrom,
        whatsapp_number: senderFrom,
        reason: notifyReason,
        conversationId,
      },
      creds,
    ).catch((err) => console.error('[kalyo] trial activation notify failed', err));
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('conversations')
    .update({ lead_captured: true })
    .eq('id', conversationId);
  if (error) console.error('[trial] failed to mark lead_captured', error);

  await ensureTrialTrackingConsistency(supabase, {
    conversationId,
    email,
    phone: senderFrom,
    source: 'trial_enroll',
    trialEndsAt: options?.trialEndsAt,
    trialUserName: options?.trialUserName,
    recordAbOutcome: true,
  });

  await recordOutcome(supabase, conversationId, 'lead_captured', { source: 'trial' });
}

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

  if (args.isAmbassadorLead && isAmbassadorFlowsEnabled()) {
    return {
      systemSuffix: `\n\n${EMBAJADOR_SYSTEM_PROMPT}`,
      options: {
        tools: [NOTIFY_SALES_TEAM_TOOL],
        toolHandlers: {
          notify_sales_team: async (input: unknown) => {
            const obj =
              typeof input === 'object' && input !== null
                ? (input as Record<string, unknown>)
                : {};
            const creds =
              args.channel === 'twilio' &&
              args.bot.twilio_account_sid &&
              args.bot.twilio_auth_token &&
              args.bot.twilio_whatsapp_number
                ? {
                    accountSid: args.bot.twilio_account_sid,
                    authToken: args.bot.twilio_auth_token,
                    from: args.bot.twilio_whatsapp_number,
                  }
                : null;

            if (!creds) {
              return { status: 'error', message: 'Missing Twilio credentials' };
            }

            const result = await notifySalesTeam(
              {
                name: typeof obj.name === 'string' ? obj.name : undefined,
                phone: typeof obj.phone === 'string' ? obj.phone : undefined,
                email: typeof obj.email === 'string' ? obj.email : undefined,
                reason: 'meta_ads_ambassador',
                conversation_summary:
                  typeof obj.conversation_summary === 'string'
                    ? obj.conversation_summary
                    : 'Lead embajador pidió hablar con humano',
                whatsapp_number:
                  args.channel === 'twilio' ? args.senderFrom : undefined,
                conversationId:
                  args.channel === 'twilio' ? args.conversationId : undefined,
              },
              creds,
            );

            return result;
          },
        },
      },
    };
  }

  if (args.channel === 'meta') {
    return {
      systemSuffix: KALYO_INSTRUCTIONS_META,
      options: {},
    };
  }

  const { bot, senderFrom, conversationId, conversationMessages = [] } = args;

  const isOperator =
    Boolean(args.isTeamMember) ||
    (args.channel === 'twilio' && isTeamOperatorPhone(senderFrom));

  const profile = detectPsychologistProfile(conversationMessages);
  console.log(`[profile-detection] conv=${conversationId} profile=${profile}`);
  const profileBlock = buildProfilePromptBlock(profile);
  const operatorBlock = isOperator ? TEAM_OPERATOR_INSTRUCTIONS : '';
  const systemSuffix =
    KALYO_INSTRUCTIONS_TWILIO + operatorBlock + (profileBlock ? `\n\n${profileBlock}` : '');

  const creds =
    bot.twilio_account_sid && bot.twilio_auth_token && bot.twilio_whatsapp_number
      ? {
          accountSid: bot.twilio_account_sid,
          authToken: bot.twilio_auth_token,
          from: bot.twilio_whatsapp_number,
        }
      : null;

  const tools: Anthropic.Messages.Tool[] = [
    ACTIVATE_PRO_TRIAL_TOOL,
    CREATE_ACCOUNT_AND_ACTIVATE_TRIAL_TOOL,
    SCHEDULE_DEMO_TOOL,
    CHECK_SPECIFIC_TIME_TOOL,
    CONFIRM_DEMO_SLOT_TOOL,
    NOTIFY_SALES_TEAM_TOOL,
  ];
  if (isOperator) {
    tools.splice(2, 0, ADMIN_ACTIVATE_TRIAL_FOR_LEAD_TOOL);
  }

  return {
    systemSuffix,
    options: {
      tools,
      toolHandlers: {
        activate_pro_trial: async (input: unknown) => {
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const email = typeof obj.email === 'string' ? obj.email : '';
          const trialPlan = parseTrialPlanFromInput(input);
          const result = await activateTrial(email, trialPlan);

          if (result.status === 'success') {
            await onTrialSuccessSideEffects(
              conversationId,
              email,
              senderFrom,
              creds,
              'trial_activated_via_botio',
              { trialEndsAt: result.expires_at },
            );
          } else if (result.status === 'already_active') {
            const supabase = createAdminClient();
            await ensureTrialTrackingConsistency(supabase, {
              conversationId,
              email,
              phone: senderFrom,
              source: 'already_active_sync',
              trialEndsAt: result.expires_at,
            });
          }

          return result;
        },
        create_account_and_activate_trial: async (input: unknown) => {
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const email = typeof obj.email === 'string' ? obj.email : '';
          const fullName = typeof obj.full_name === 'string' ? obj.full_name : '';
          const trialPlan = parseTrialPlanFromInput(input);

          const result = await createKalyoTrialAccount({
            email,
            fullName,
            phone: senderFrom,
            trialPlan,
          });

          if (result.success) {
            await onTrialSuccessSideEffects(
              conversationId,
              result.email,
              senderFrom,
              creds,
              'trial_activated_via_botio',
              {
                trialUserName: fullName,
                trialEndsAt: result.trial_ends_at,
              },
            );

            await recordOutcome(createAdminClient(), conversationId, 'trial_activado', {
              email: result.email,
            });

            return {
              status: 'success',
              email: result.email,
              password: result.password,
              trial_ends_at: result.trial_ends_at,
              reactivated: result.reactivated ?? false,
              bot_message: buildAccountCreationSuccessMessage(
                result.email,
                fullName,
                result.trial_ends_at,
                result.reactivated,
                result.password,
                trialPlan,
              ),
            };
          }

          if (result.error === 'trial_already_used') {
            return {
              status: 'trial_already_used',
              bot_message:
                'Veo que ya tienes cuenta en Kalyo. ¿Quieres que te ayude a hacer login? https://app.kalyo.io/login',
            };
          }

          if (creds) {
            notifySalesTeam(
              {
                email: result.email,
                phone: senderFrom,
                whatsapp_number: senderFrom,
                reason: 'escalation',
                conversation_summary: `Falló create_account_and_activate_trial: ${result.error} — ${result.error_detail ?? ''}`,
                conversationId,
              },
              creds,
            ).catch((err) => console.error('[account-creator] notify failed', err));
          }

          return {
            status: 'error',
            error: result.error,
            error_detail: result.error_detail,
            bot_message:
              'Tuve un problema creando la cuenta. El equipo ya fue notificado — ¿puedes intentar de nuevo en unos minutos?',
          };
        },
        admin_activate_trial_for_lead: async (input: unknown) => {
          if (!isOperator) {
            return {
              status: 'forbidden',
              bot_message: 'Esta acción solo está disponible para el equipo de Kalyo.',
            };
          }

          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const email = typeof obj.email === 'string' ? obj.email.trim() : '';
          const fullName = typeof obj.full_name === 'string' ? obj.full_name.trim() : '';
          const phone = typeof obj.phone === 'string' ? obj.phone.trim() : '';
          const trialPlan = parseTrialPlanFromInput(input);

          return executeAdminActivateTrialForLead({
            email,
            fullName,
            phone,
            trialPlan,
            source: 'admin_via_botio',
          });
        },
        schedule_demo: async (input: unknown) => {
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const email = typeof obj.customer_email === 'string' ? obj.customer_email.trim() : '';
          const name = typeof obj.customer_name === 'string' ? obj.customer_name.trim() : '';
          const city = typeof obj.customer_city === 'string' ? obj.customer_city.trim() : '';
          const preferredDay =
            typeof obj.preferred_day === 'string' && obj.preferred_day.trim()
              ? obj.preferred_day.trim()
              : 'any';
          const preferredTime =
            typeof obj.preferred_time === 'string' && obj.preferred_time.trim()
              ? obj.preferred_time.trim()
              : 'any';

          if (!isValidEmail(email)) {
            return {
              status: 'error',
              bot_message: 'El email no parece válido. ¿Me lo compartes de nuevo?',
            };
          }
          if (!name) {
            return {
              status: 'error',
              bot_message: 'Necesito tu nombre completo para agendar la demo.',
            };
          }
          if (!city) {
            return {
              status: 'error',
              bot_message:
                'Para mostrarte los horarios en tu hora local, ¿desde qué ciudad nos escribes?',
            };
          }

          const tzMatch = cityToTimezone(city);
          if (!tzMatch) {
            return {
              status: 'city_not_recognized',
              bot_message:
                'No encontré esa ciudad en mi sistema. ¿Podrías decirme una ciudad principal cercana o el país? Ejemplos: CDMX, Monterrey, Guadalajara, Cancún, Bogotá, Lima, Santiago, Buenos Aires, Madrid.',
            };
          }

          try {
            let result = await getAvailableSlots({
              preferredDay,
              preferredTime,
              customerPhone: senderFrom,
              customerTimezone: tzMatch.timezone,
              customerLabel: tzMatch.label,
            });
            if (result.slots.length === 0) {
              result = await getAvailableSlots({
                preferredDay: 'any',
                preferredTime: 'any',
                customerPhone: senderFrom,
                customerTimezone: tzMatch.timezone,
                customerLabel: tzMatch.label,
              });
            }
            if (result.slots.length === 0) {
              return {
                status: 'no_overlap_with_business_hours',
                bot_message:
                  'No encontré horarios que coincidan con tu zona horaria y nuestro horario laboral. ¿Te funciona algún día de la próxima semana en otro horario?',
              };
            }

            const { slots, overlap_limited } = result;
            const supabase = createAdminClient();
            await savePendingDemoSlots(supabase, conversationId, {
              slots,
              customer_email: email,
              customer_name: name,
              customer_phone: senderFrom,
              customer_city: tzMatch.city_normalized,
              customer_timezone: tzMatch.timezone,
              customer_city_label: tzMatch.label,
              display_timezone: tzMatch.timezone,
              display_label: tzMatch.label,
              offered_at: new Date().toISOString(),
            });

            return {
              status: overlap_limited ? 'no_overlap_with_business_hours' : 'success',
              slots,
              city: tzMatch.city_normalized,
              timezone: tzMatch.timezone,
              bot_message: formatSlotsForBot(slots, { overlap_limited }),
            };
          } catch (err) {
            console.error('[schedule_demo] failed', err);
            const message = err instanceof Error ? err.message : 'unknown_error';
            return {
              status: 'error',
              bot_message:
                message.includes('not connected')
                  ? 'El calendario aún no está conectado. Un asesor te contactará para agendar.'
                  : 'Tuve un problema consultando disponibilidad. ¿Intentamos de nuevo en un momento?',
            };
          }
        },
        check_specific_time: async (input: unknown) => {
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const requestedDate =
            typeof obj.requested_date === 'string' ? obj.requested_date.trim() : '';
          const requestedTime =
            typeof obj.requested_time === 'string' ? obj.requested_time.trim() : '';
          const tzInput = typeof obj.customer_timezone === 'string' ? obj.customer_timezone.trim() : '';

          const supabase = createAdminClient();
          return executeCheckSpecificTime({
            supabase,
            conversationId,
            requestedDate,
            requestedTime,
            customerTimezone: tzInput || undefined,
            senderFrom,
          });
        },
        confirm_demo_slot: async (input: unknown) => {
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const slotRaw = obj.slot_number;
          const isCustom =
            typeof slotRaw === 'string' && slotRaw.toLowerCase() === 'custom';
          const email = typeof obj.customer_email === 'string' ? obj.customer_email.trim() : '';
          const name = typeof obj.customer_name === 'string' ? obj.customer_name.trim() : '';

          let slotNumber: 1 | 2 | 3 | 'custom';
          if (isCustom) {
            slotNumber = 'custom';
          } else {
            const n = typeof slotRaw === 'number' ? slotRaw : parseInt(String(slotRaw ?? ''), 10);
            if (!n || n < 1 || n > 3) {
              return {
                status: 'error',
                bot_message: '¿Cuál horario prefieres? Responde con 1, 2 o 3.',
              };
            }
            slotNumber = n as 1 | 2 | 3;
          }

          const supabase = createAdminClient();
          return executeConfirmDemoSlot({
            supabase,
            conversationId,
            slotNumber,
            customerEmail: email,
            customerName: name,
            senderFrom,
            botId: bot.id,
            creds,
          });
        },
        notify_sales_team: async (input: unknown) => {
          console.log('[notify_sales_team] tool called', JSON.stringify(input));
          if (!creds) {
            console.error('[notify_sales_team] no creds — bot missing Twilio credentials');
            return {
              status: 'error',
              message: 'Kalyo bot is missing Twilio credentials',
            };
          }
          const obj =
            typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
          const str = (key: string): string | undefined =>
            typeof obj[key] === 'string' ? (obj[key] as string) : undefined;
          const reason = str('reason');
          const result = await notifySalesTeam(
            {
              name: str('name'),
              phone: str('phone'),
              email: str('email'),
              preferred_time: str('preferred_time'),
              reason,
              conversation_summary: str('conversation_summary'),
              whatsapp_number: senderFrom,
              conversationId,
            },
            creds,
          );
          console.log('[notify_sales_team] result', JSON.stringify(result));

          const supabase = createAdminClient();

          if (result.status === 'success' && reason === 'trial_activated_via_botio') {
            await recordOutcome(supabase, conversationId, 'trial_activated_via_botio', { reason });
          }

          if (result.status === 'success' && (reason === 'new_lead' || reason === 'trial_activated_via_botio')) {
            const { error } = await supabase
              .from('conversations')
              .update({ lead_captured: true })
              .eq('id', conversationId);
            if (error) console.error('[notify_sales_team] failed to mark lead_captured', error);
            await recordOutcome(supabase, conversationId, 'lead_captured', { reason });
          }

          return result;
        },
      },
    },
  };
}
