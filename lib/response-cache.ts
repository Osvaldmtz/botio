import type { ChatMessage } from '@/lib/claude';

export type CachedResponse = {
  pattern: string;
  response: string;
};

const PRECIO_SIMPLE_RESPONSE =
  'Tenemos 3 planes:\n\n' +
  '• *Starter* (gratis): 3 pacientes activos, 10 evaluaciones/mes\n' +
  '• *Pro* ($29 USD/mes): pacientes ilimitados, +100 evaluaciones, reportes IA\n' +
  '• *Max* ($39 USD/mes): todo Pro + SOAP IA, videollamadas, agenda\n\n' +
  '¿Quieres probar Pro 15 días gratis?';

type CachePattern = {
  name: string;
  regex: RegExp;
  response: string;
};

const CACHE_PATTERNS: CachePattern[] = [
  {
    name: 'saludo',
    regex: /^(hola|buenos dias|buenas tardes|que tal|hey|holi)$/,
    response:
      '¡Hola! Soy Sofía de Kalyo 👋 Ayudamos a psicólogos a evaluar pacientes con +100 pruebas clínicas validadas, todo desde el navegador. ¿Qué te gustaría saber primero: evaluaciones, precios, o cómo funciona la prueba gratis?\n\nResponde con una opción:\n1️⃣ Evaluaciones\n2️⃣ Precios\n3️⃣ Prueba gratis',
  },
  {
    name: 'precio_simple',
    regex: /^(cuanto cuesta|que precio|cuanto vale|cuanto es|precio)$/,
    response: PRECIO_SIMPLE_RESPONSE,
  },
  {
    name: 'que_es_kalyo',
    regex: /^(que es kalyo|que hace kalyo|para que sirve kalyo)$/,
    response:
      'Kalyo es una plataforma SaaS para psicólogos clínicos en LATAM. Te ayudamos a digitalizar tu práctica: gestión de pacientes, +100 evaluaciones clínicas validadas, reportes PDF con IA. ¿Te gustaría conocer los planes o probar 15 días gratis?',
  },
  {
    name: 'quick_1',
    regex: /^(1|evaluaciones?)$/,
    response:
      'Tenemos +100 evaluaciones clínicas validadas incluyendo PHQ-9, GAD-7, PCL-5, Beck, Hamilton, AUDIT, SCL-90, STAI, BDI y más. Cada una genera reporte PDF con interpretación por IA. ¿Quieres probar 15 días gratis del plan Pro?',
  },
  {
    name: 'quick_2',
    regex: /^(2|precios?)$/,
    response: PRECIO_SIMPLE_RESPONSE,
  },
  {
    name: 'quick_3',
    regex: /^(3|prueba gratis|trial)$/,
    response:
      'La prueba de 15 días del plan Pro es muy rápida en 2 pasos:\n\n1. Te registras en app.kalyo.io/login?mode=register (1-2 minutos)\n2. Me escribes por aquí con el email que usaste y activo tu Pro al instante\n\n¿Te animas?',
  },
  {
    name: 'gracias',
    regex: /^(gracias|muchas gracias|mil gracias|thanks)$/,
    response: '¡De nada! 😊 ¿Te gustaría activar tu prueba gratuita de 15 días?',
  },
  {
    name: 'despedida',
    regex: /^(adios|hasta luego|chao|bye)$/,
    response: '¡Hasta luego! Cuando quieras retomar, aquí estaré 👋',
  },
];

export function normalizeForCache(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function countUserMessages(history: ChatMessage[]): number {
  return history.filter((m) => m.role === 'user').length;
}

export function checkCache(
  messageText: string,
  conversationHistory: ChatMessage[],
): CachedResponse | null {
  if (countUserMessages(conversationHistory) >= 4) {
    return null;
  }

  const normalized = normalizeForCache(messageText);
  if (!normalized) return null;

  for (const pattern of CACHE_PATTERNS) {
    if (pattern.regex.test(normalized)) {
      return { pattern: pattern.name, response: pattern.response };
    }
  }

  return null;
}
