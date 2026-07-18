import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
import { getPaymentLink } from '@/lib/kalyo-payment-links';
import type { ObjectionType } from '@/lib/objection-detector';
import {
  nameThenVerb,
  prefixWithName,
  prefixWithNamePeriod,
  renderName,
} from '@/lib/render-name';

export type ObjectionResponseContext = {
  name?: string | null;
  isRepeat: boolean;
  priceObjectionCount?: number;
};

export function formatObjectionResponse(
  type: ObjectionType,
  ctx: ObjectionResponseContext,
): string {
  const name = renderName(ctx.name);
  const isRepeat = ctx.isRepeat;
  const priceCount = ctx.priceObjectionCount ?? (isRepeat ? 2 : 1);
  const starter = KALYO_PRICING.starter;
  const discount = KALYO_PRICING.discount;
  const maxLink = getPaymentLink('max');
  const proLink = getPaymentLink('pro');
  const maxCoupon = getPaymentLink('max', discount.code);

  if (type === 'price') {
    if (priceCount <= 1) {
      const greeting = name ? `Entiendo ${name}` : 'Entiendo';
      return (
        `${greeting}, $${KALYO_PRICING.max.price_monthly} al mes puede sonar a mucho al inicio. Te pongo las cuentas reales:\n\n` +
        `✓ Con UNA sola sesión cobrada cubres el mes completo\n` +
        `✓ Te ahorra horas en reportes y documentación\n` +
        `✓ Max incluye agenda, videollamadas y transcripción de sesiones\n\n` +
        `Prueba Max *7 días gratis* primero, sin tarjeta — incluye Kaly voz y Meet. Si te sirve, decides al final.\n\n` +
        `¿Te activo el trial? Solo necesito saber si ya tienes cuenta o es tu primera vez.`
      );
    }

    if (priceCount === 2) {
      const opener = name ? `Sin problema ${name}` : 'Sin problema';
      return (
        `${opener}. Si ya probaste y aún te parece caro, estos son los precios completos:\n\n` +
        `🚀 Max $${KALYO_PRICING.max.price_monthly}/mes (recomendado): ${maxLink}\n` +
        `💎 Pro $${KALYO_PRICING.pro.price_monthly}/mes (más básico): ${proLink}\n\n` +
        `Si no has probado aún, el trial Max gratis sigue disponible — sin tarjeta.\n\n` +
        `¿Quieres el trial o prefieres uno de los planes?`
      );
    }

    if (priceCount === 3) {
      const opener = name ? `Entiendo ${name}` : 'Entiendo';
      return (
        `${opener}. Como último recurso, puedo ofrecerte 50% en tu primer mes de Max con cupón ${discount.code} ($${discount.max_with_discount} USD):\n\n` +
        `${maxCoupon}\n\n` +
        `Si prefieres seguir sin pagar, el plan Starter es gratis:\n` +
        `✓ ${starter.max_patients} pacientes activos\n` +
        `✓ ${starter.max_evaluations_per_month} evaluaciones por mes`
      );
    }

    const opener = nameThenVerb(name, 'entiendo');
    return (
      `${opener}. Te pongo en contacto con Osvaldo del equipo para que vea cómo ajustarte algo más conveniente.\n\n` +
      `Solo necesito tu email para que te escriba directamente.`
    );
  }

  if (type === 'thinking') {
    if (!isRepeat) {
      return (
        `${prefixWithName('Claro', name)} es una decisión importante. Mientras lo piensas, puedes probar el trial Max de 7 días GRATIS (sin tarjeta) — incluye agenda, Meet y Kaly voz:\n\n` +
        `https://app.kalyo.io/login\n\n` +
        `Así ves todo sin presión. Si te gusta, al vencer te recomiendo Max ($${KALYO_PRICING.max.price_monthly}/mes) o Pro si prefieres algo más básico. ¿Te activo el trial? Solo necesito tu nombre completo y email.`
      );
    }
    return (
      `${prefixWithNamePeriod('Entendido', name)} Te dejo descansar la información — sin presión.\n\n` +
      `Si tienes preguntas en los próximos días, escríbeme aquí mismo.\n\n` +
      `¿Te sirve si te recontacto en 3 días para ver si surgieron dudas?`
    );
  }

  if (type === 'competition') {
    if (!isRepeat) {
      return (
        `${prefixWithName('Interesante', name)} ¿qué usas hoy? Kalyo se diferencia en 3 cosas clave:\n\n` +
        `🚀 Plan Max: agenda + videollamadas + transcripción + portal del paciente\n` +
        `📊 91+ tests con reportes IA avanzados (sin escribir reportes a mano)\n` +
        `🇲🇽 Hecho en LATAM para psicólogos LATAM (DSM-5, español)\n\n` +
        `Max ($${KALYO_PRICING.max.price_monthly}/mes) es el recomendado. Pro ($${KALYO_PRICING.pro.price_monthly}/mes) si buscas algo más básico.\n\n` +
        `¿Te interesa probar Max 7 días gratis primero?`
      );
    }
    return (
      `${prefixWithName('Perfecto', name)} no busco convencerte si ya estás bien con tu sistema. Te dejo la puerta abierta — si algún día quieres probar Kalyo, te activo trial gratis sin pedir tarjeta.`
    );
  }

  if (type === 'no_time') {
    if (!isRepeat) {
      return (
        `${prefixWithName('Te entiendo', name)} todos andamos contra el tiempo. ¿Qué te parece si:\n\n` +
        `1️⃣ Te activo el trial gratis ahora (30 segundos)\n` +
        `2️⃣ Lo pruebas cuando puedas estos 7 días\n` +
        `3️⃣ Si te sirve, sigues con Max o Pro. Si no, no pasa nada\n\n` +
        `¿Te activo el trial?`
      );
    }
    return (
      `${prefixWithNamePeriod('Sin problema', name)} Te recontacto en 7 días por si en ese momento es mejor.\n\n` +
      `Mientras, si surge alguna duda, escríbeme aquí.`
    );
  }

  if (type === 'not_useful') {
    if (!isRepeat) {
      return (
        `${prefixWithName('Cuéntame más', name)} ¿qué estás buscando exactamente? Quiero entender tu necesidad para ver si Kalyo encaja.\n\n` +
        `Por ejemplo:\n` +
        `- ¿Algo más simple (Pro) o consultorio completo (Max)?\n` +
        `- ¿Uso personal o equipo?\n` +
        `- ¿Pacientes, evaluaciones, citas?`
      );
    }
    return (
      `${prefixWithName('Perfecto', name)} agradezco tu honestidad. Si en el futuro tu necesidad cambia o conoces a algún colega que pueda beneficiarse, aquí estoy.`
    );
  }

  if (!isRepeat) {
    const opener = name
      ? `¡Justo Kalyo es perfecto para arrancar bien ${name}!`
      : '¡Justo Kalyo es perfecto para arrancar bien!';
    return (
      `${opener}\n\n` +
      `Con pocos pacientes puedes:\n` +
      `✓ Estructurar tu práctica desde día 1\n` +
      `✓ Hacer evaluaciones con IA y verte profesional ante cada paciente\n` +
      `✓ Tener registros impecables\n\n` +
      `El trial Max es GRATIS 7 días — pruebas agenda, Meet y Kaly voz sin invertir. Si te sirve, Max ($${KALYO_PRICING.max.price_monthly}/mes) es el recomendado al pagar.\n\n` +
      `¿Te activo el trial? Necesito tu nombre completo y email.`
    );
  }

  return `${prefixWithNamePeriod('Sin presión', name)} Cuando estés listo, aquí estoy.`;
}
