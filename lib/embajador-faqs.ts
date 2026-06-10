export const LUMA_WEBINAR_URL = 'https://luma.com/eklqji50';

export type EmbajadorFaq = {
  id: string;
  triggers: string[];
  response: string;
};

export const EMBAJADOR_FAQS: EmbajadorFaq[] = [
  {
    id: 'intro_embajador',
    triggers: [
      'programa de embajadores',
      'programa embajadores',
      'embajadores kalyo',
      'estudiante de psicología',
      'estudiante de psicologia',
      'vi el anuncio',
      'vi tu anuncio',
      'soy estudiante',
    ],
    response: `¡Hola! 👋 Qué gusto que te interese el Programa de Embajadores Kalyo.

Es 100% gratis: recomiendas Kalyo a psicólogos y ganas comisión por cada cliente que se registre gracias a ti.

En el webinar gratuito te explicamos cómo funciona, cuánto puedes ganar y las estrategias paso a paso.

📅 Regístrate aquí 👇
${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'que_es_kalyo',
    triggers: ['qué es kalyo', 'que es kalyo', 'qué es la plataforma', 'qué hace kalyo', 'plataforma'],
    response: `Kalyo es una plataforma tecnológica para psicólogos. Les ayuda a gestionar pacientes, historias clínicas, agenda, videollamadas, pruebas psicológicas y procesos administrativos en un solo lugar. 🧠✨

¿Te gustaría conocer más sobre el programa de Embajadores?`,
  },
  {
    id: 'que_hago_yo',
    triggers: ['qué hago yo', 'que hago yo', 'qué tengo que hacer', 'mi función', 'qué trabajo'],
    response: `Tu función será recomendar Kalyo a psicólogos, estudiantes próximos a graduarse, consultorios o instituciones.

Cuando se genere una venta gracias a tu recomendación, recibes una comisión. 💰

¿Quieres conocer todos los detalles? Te invitamos al webinar gratuito 👇
${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'inversion',
    triggers: ['invertir', 'pagar', 'cuánto cuesta', 'cuanto cuesta', 'tengo que pagar', 'tiene costo', 'cuánto pago', 'cuanto pago'],
    response: `¡No necesitas invertir nada! 🎉

El programa de Embajadores Kalyo es 100% gratis. Solo necesitas tu tiempo y ganas de recomendar.

¿Te apuntas al webinar? ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'horarios',
    triggers: ['horario', 'metas', 'tiempo', 'cuánto trabajo', 'horarios obligatorios'],
    response: `Tú decides cuánto tiempo le dedicas. 📚

✓ No hay horarios obligatorios
✓ No hay metas mínimas
✓ Puedes hacerlo en tus tiempos libres
✓ Combínalo con tus estudios

Aprende todas las estrategias en el webinar: ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'cuanto_gano',
    triggers: ['cuánto gano', 'cuanto gano', 'cuánto pagan', 'comisión', 'comisiones', 'cuánto dinero'],
    response: `Tu ganancia depende de cuántos psicólogos recomiendes que se vuelvan clientes Kalyo. 💪

Mientras más usuarios refieras, mayores ingresos.

Los detalles completos de comisiones los explicamos en el webinar 👇
${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'experiencia',
    triggers: ['experiencia', 'no sé vender', 'nunca he vendido', 'sin experiencia'],
    response: `No necesitas experiencia en ventas. 🚀

En el webinar te daremos:
✓ Capacitación completa
✓ Materiales de apoyo
✓ Estrategias paso a paso
✓ Plantillas de mensajes

Regístrate gratis: ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'tracking',
    triggers: ['cómo saben', 'como saben', 'rastrear', 'tracking', 'mi código', 'cómo identifican'],
    response: `Cada Embajador tendrá su propio código o enlace de referencia. ✅

Cuando alguien se registre con tu código, sabremos que llegó por ti y se te asigna la comisión.

Te enseñamos cómo usarlo en el webinar 👇
${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'cuando_pagan',
    triggers: ['cuándo me pagan', 'cuando me pagan', 'cómo me pagan', 'pago de comisiones', 'cobrar'],
    response: `Las comisiones se pagan cuando el cliente referido activa su servicio. 💳

Las condiciones del programa, métodos de pago y frecuencia las explicamos al detalle en el webinar.

¡Apártalo aquí! ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'a_quien',
    triggers: ['a quién recomendar', 'a quien recomendar', 'quién es el cliente', 'a quién vendo', 'target'],
    response: `Principalmente a:

✓ Psicólogos independientes
✓ Consultorios psicológicos
✓ Centros de atención psicológica
✓ Universidades con facultades de psicología
✓ Estudiantes de psicología próximos a graduarse

En el webinar te damos estrategias específicas para llegar a cada uno: ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'por_que_compran',
    triggers: ['por qué les interesa', 'por que les interesa', 'por qué van a comprar', 'beneficio para psicólogos'],
    response: `Kalyo les ayuda a:

✓ Ahorrar tiempo en tareas administrativas
✓ Organizar su práctica profesional
✓ Gestionar pacientes en un solo lugar
✓ Automatizar reportes con IA
✓ Mejorar su trabajo clínico

Es lo que todo psicólogo necesita en 2026. 🎯

Aprende todos los argumentos de venta en el webinar 👇
${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'no_conozco',
    triggers: ['no conozco psicólogos', 'no tengo contactos', 'cómo encuentro', 'sin contactos'],
    response: `¡No necesitas conocerlos previamente! 💡

En el webinar aprenderás estrategias para encontrarlos a través de:

✓ Redes sociales (Instagram, TikTok, Facebook)
✓ LinkedIn
✓ Grupos profesionales
✓ Universidades
✓ Referidos

Es más fácil de lo que crees. Regístrate: ${LUMA_WEBINAR_URL}`,
  },
  {
    id: 'webinar_info',
    triggers: ['webinar', 'reunión', 'meeting', 'cuándo es', 'fecha', 'hora del webinar', 'registrarme al webinar', 'quiero registrarme'],
    response: `🎤 Webinar Embajadores Kalyo

Te explicamos todo: cómo funciona, cuánto puedes ganar, estrategias de venta, y más.

📅 Regístrate gratis aquí 👇
${LUMA_WEBINAR_URL}

Una vez registrado, Luma te enviará la confirmación y el link de Meet al correo. 📧`,
  },
];

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function matchEmbajadorFaq(text: string): EmbajadorFaq | null {
  const normalized = normalizeForMatch(text);

  for (const faq of EMBAJADOR_FAQS) {
    for (const trigger of faq.triggers) {
      if (normalized.includes(normalizeForMatch(trigger))) {
        return faq;
      }
    }
  }

  return null;
}

export function wantsDirectMeetLink(text: string): boolean {
  return /meet\.google|link\s+del\s+meet|link\s+de\s+meet|enlace\s+del\s+meet|dame\s+el\s+meet|google\s+meet/i.test(
    text,
  );
}

export function wantsWebinarRegistration(text: string): boolean {
  return /registrarme|registro|apuntarme|inscribirme|reservar\s+(?:mi\s+)?lugar|quiero\s+entrar/i.test(
    text,
  );
}

/** FAQ/guard signals that identify an embajador lead even when intent regex misses. */
export function matchesAmbassadorFaqSignal(messageBody: string): boolean {
  return (
    matchEmbajadorFaq(messageBody) !== null ||
    wantsWebinarRegistration(messageBody) ||
    wantsDirectMeetLink(messageBody)
  );
}

export function responseContainsLumaLink(text: string): boolean {
  return text.includes(LUMA_WEBINAR_URL);
}

export const MEET_LINK_BLOCKED_RESPONSE = `Para recibir el link de Google Meet necesitas registrarte primero en el webinar gratuito. 📧

Luma te envía la confirmación y el acceso al Meet directo a tu correo.

Regístrate aquí 👇
${LUMA_WEBINAR_URL}`;

export const WEBINAR_OFFER_SUFFIX = `\n\n¿Te gustaría reservar tu lugar en el webinar gratuito? Es súper sencillo 👇\n${LUMA_WEBINAR_URL}`;
