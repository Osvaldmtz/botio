import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
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
  const starter = KALYO_PRICING.starter;
  const proDiscount = KALYO_PRICING.pro.payment_link_with_discount;
  const discount = KALYO_PRICING.discount;

  if (type === 'price') {
    if (!isRepeat) {
      return (
        `Entiendo ${name}, $29 al mes puede sonar a mucho al inicio. Te pongo las cuentas reales:\n\n` +
        `✓ Con UNA sola sesión cobrada cubres el mes completo\n` +
        `✓ Te ahorra ~2 horas por paciente en escribir reportes\n` +
        `✓ A $300 MXN por sesión, son ~4 sesiones extra al mes con el tiempo que recuperas\n\n` +
        `Te ofrezco 50% en tu primer mes: $${discount.pro_with_discount} USD\n` +
        `${proDiscount}\n\n` +
        `O si prefieres probar sin pagar nada, te activo el plan Starter gratis:\n` +
        `✓ ${starter.max_patients} pacientes activos\n` +
        `✓ ${starter.max_evaluations_per_month} evaluaciones por mes\n` +
        `✓ Reportes en PDF\n\n` +
        `¿Cuál prefieres?`
      );
    }
    return (
      `${name}, entiendo. Te pongo en contacto con Osvaldo del equipo para que vea cómo ajustarte algo más conveniente.\n\n` +
      `Solo necesito tu email para que te escriba directamente.`
    );
  }

  if (type === 'thinking') {
    if (!isRepeat) {
      return (
        `Claro ${name}, es una decisión importante. Mientras lo piensas, puedes probar el trial Pro de 15 días GRATIS (sin tarjeta):\n\n` +
        `https://app.kalyo.io/login\n\n` +
        `Así ves todo sin presión. ¿Te lo activo? Solo necesito tu nombre completo y email.`
      );
    }
    return (
      `Entendido ${name}. Te dejo descansar la información — sin presión.\n\n` +
      `Si tienes preguntas en los próximos días, escríbeme aquí mismo.\n\n` +
      `¿Te sirve si te recontacto en 3 días para ver si surgieron dudas?`
    );
  }

  if (type === 'competition') {
    if (!isRepeat) {
      return (
        `Interesante ${name}, ¿qué usas hoy? Kalyo se diferencia en 3 cosas clave:\n\n` +
        `🎙️ Asistente de voz con IA (hablas y registra todo)\n` +
        `📊 Reportes ejecutivos automáticos (sin escribir reportes a mano)\n` +
        `🇲🇽 Hecho en LATAM para psicólogos LATAM (DSM-5, español)\n\n` +
        `¿Te interesa ver una demo en vivo de cómo se compara? Te agendo 15 min con Osvaldo.`
      );
    }
    return (
      `Perfecto ${name}, no busco convencerte si ya estás bien con tu sistema. Te dejo la puerta abierta — si algún día quieres probar Kalyo, te activo trial gratis sin pedir tarjeta.`
    );
  }

  if (type === 'no_time') {
    if (!isRepeat) {
      return (
        `Te entiendo ${name}, todos andamos contra el tiempo. ¿Qué te parece si:\n\n` +
        `1️⃣ Te activo el trial gratis ahora (30 segundos)\n` +
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
        `Cuéntame más ${name}, ¿qué estás buscando exactamente? Quiero entender tu necesidad para ver si Kalyo encaja.\n\n` +
        `Por ejemplo:\n` +
        `- ¿Algo más simple o más completo?\n` +
        `- ¿Uso personal o equipo?\n` +
        `- ¿Pacientes, evaluaciones, citas?`
      );
    }
    return (
      `Perfecto ${name}, agradezco tu honestidad. Si en el futuro tu necesidad cambia o conoces a algún colega que pueda beneficiarse, aquí estoy.`
    );
  }

  if (!isRepeat) {
    return (
      `¡Justo Kalyo es perfecto para arrancar bien ${name}!\n\n` +
      `Con pocos pacientes puedes:\n` +
      `✓ Estructurar tu práctica desde día 1\n` +
      `✓ Hacer evaluaciones con IA y verte profesional ante cada paciente\n` +
      `✓ Tener registros impecables\n\n` +
      `El trial Pro es GRATIS 15 días — arrancas sin invertir. Solo pagas si te sirve.\n\n` +
      `¿Te activo el trial? Necesito tu nombre completo y email.`
    );
  }

  return `Sin presión ${name}. Cuando estés listo, aquí estoy.`;
}
