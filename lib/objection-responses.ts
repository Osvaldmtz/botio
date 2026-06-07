import { getPaymentLink } from '@/lib/kalyo-payment-links';
import type { ObjectionType } from '@/lib/objection-detector';

export type ObjectionResponseContext = {
  name: string;
  isRepeat: boolean;
};

function displayName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed || 'ahí';
}

export function formatObjectionResponse(
  type: ObjectionType,
  ctx: ObjectionResponseContext,
): string {
  const name = displayName(ctx.name);
  const isRepeat = ctx.isRepeat;

  if (type === 'price') {
    if (!isRepeat) {
      const proLink = getPaymentLink('pro', 'PRIMER50');
      return (
        `Entiendo ${name}, $29 USD/mes puede sonar mucho al inicio. Pero hagamos las cuentas:\n\n` +
        `✓ Una sola sesión cobrada se paga el mes completo\n` +
        `✓ Te ahorra ~2 horas por paciente en documentación\n` +
        `✓ A $300/sesión, son 4 sesiones extra que puedes atender al mes\n\n` +
        `Aún así, te ofrezco 50% en tu primer mes ($14.50 USD):\n${proLink}\n\n` +
        `¿Te animas?`
      );
    }
    return (
      `${name}, entiendo. Te pongo en contacto con Osvaldo del equipo para que vea cómo ajustarte algo más conveniente.\n\n` +
      `En un momento te contacta alguien del equipo.`
    );
  }

  if (type === 'thinking') {
    if (!isRepeat) {
      return (
        `Claro ${name}, es una decisión importante. Mientras decides, puedes probar el trial Pro de 15 días GRATIS (sin tarjeta):\n\n` +
        `https://app.kalyo.io/login\n\n` +
        `Así pruebas todo sin presión. ¿Te lo activo? Solo necesito tu nombre completo y email.`
      );
    }
    return (
      `Entendido ${name}. Te dejo descansar la información. Si tienes preguntas en los próximos días, escríbeme aquí mismo.\n\n` +
      `¿Te sirve si te recontacto en 3 días para ver si surgieron dudas?`
    );
  }

  if (type === 'competition') {
    if (!isRepeat) {
      return (
        `Interesante ${name}, ¿qué usas? Pregunto porque Kalyo se diferencia en 3 cosas clave:\n\n` +
        `🎙️ Asistente de voz con IA (hablas y registra todo)\n` +
        `📊 Reportes ejecutivos automáticos (no más escribir reportes manualmente)\n` +
        `🇲🇽 Hecho en LATAM para psicólogos LATAM (interpretación DSM-5, idioma)\n\n` +
        `¿Te interesa ver una demo en vivo de cómo se compara? Te puedo agendar 15 min con Osvaldo.`
      );
    }
    return (
      `Perfecto ${name}, no busco convencerte si ya estás bien con tu sistema. Te dejo abierta la puerta — si algún día quieres probar Kalyo, te activo trial gratis sin pedir tarjeta.`
    );
  }

  if (type === 'no_time') {
    if (!isRepeat) {
      return (
        `Te entiendo ${name}, todos andamos contra el tiempo. ¿Qué te parece si:\n\n` +
        `1️⃣ Te activo el trial gratis ahora (te toma 30 segundos de tu tiempo)\n` +
        `2️⃣ Lo pruebas cuando puedas estos 15 días\n` +
        `3️⃣ Si te sirve, sigues. Si no, no pasa nada\n\n` +
        `¿Te activo el trial?`
      );
    }
    return (
      `Sin problema ${name}. Te recontacto en 7 días por si en ese momento es mejor.\n\n` +
      `Mientras, si surge alguna duda, escríbeme aquí.`
    );
  }

  if (type === 'not_useful') {
    if (!isRepeat) {
      return (
        `Cuéntame más ${name}, ¿qué es lo que estás buscando exactamente? Quiero entender bien tu necesidad para ver si Kalyo encaja o no.\n\n` +
        `Por ejemplo:\n` +
        `- ¿Necesitas algo más simple? ¿O más completo?\n` +
        `- ¿Para uso personal o equipo?\n` +
        `- ¿Manejo de pacientes, evaluaciones, citas?`
      );
    }
    return (
      `Perfecto ${name}, agradezco tu honestidad. Si en el futuro tu necesidad cambia o conoces a algún colega psicólogo que pueda beneficiarse, aquí estoy.`
    );
  }

  if (!isRepeat) {
    return (
      `¡Justo Kalyo es perfecto para arrancar bien ${name}!\n\n` +
      `Con pocos pacientes puedes:\n` +
      `✓ Estructurar tu práctica desde día 1 (no acumular caos)\n` +
      `✓ Hacer evaluaciones con IA y verte profesional ante cada paciente\n` +
      `✓ Tener tu agenda y registros impecables\n\n` +
      `Y además: el trial Pro es GRATIS por 15 días, así arrancas sin invertir. Solo pago si te sirve.\n\n` +
      `¿Te activo el trial ahora? Necesito tu nombre completo y email.`
    );
  }

  return `Sin presión ${name}. Cuando estés listo, aquí estoy.`;
}
