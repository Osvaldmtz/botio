import { KALYO_PRICING } from '@/lib/kalyo-pricing-data';
import { renderName } from '@/lib/render-name';

const DEFAULT_PAYMENT_LINKS = {
  pro: KALYO_PRICING.pro.payment_link,
  max: KALYO_PRICING.max.payment_link,
} as const;

export const KALYO_PAYMENT_LINKS = {
  pro: process.env.KALYO_PAYMENT_LINK_PRO?.trim() || DEFAULT_PAYMENT_LINKS.pro,
  max: process.env.KALYO_PAYMENT_LINK_MAX?.trim() || DEFAULT_PAYMENT_LINKS.max,
};

export function getPaymentLink(plan: 'pro' | 'max', couponCode?: string): string {
  const base = KALYO_PAYMENT_LINKS[plan];
  if (!couponCode?.trim()) return base;
  return `${base}?prefilled_promo_code=${encodeURIComponent(couponCode.trim())}`;
}

/** Default payment link: full price, no coupon. */
export function getDefaultPaymentLink(plan: 'pro' | 'max' = 'max'): string {
  return getPaymentLink(plan);
}

export function formatPayIntentReply(params: {
  trialUserName?: string | null;
  trialUserEmail: string;
  day15SentAt?: string | null;
  preferredPlan?: 'pro' | 'max';
}): string {
  const name =
    renderName(params.trialUserName) ||
    renderName(params.trialUserEmail.split('@')[0]);
  const opener = name ? `¡Genial ${name}!` : '¡Genial!';
  const plan = params.preferredPlan ?? 'max';
  const maxLink = getPaymentLink('max');
  const proLink = getPaymentLink('pro');

  if (plan === 'pro') {
    return (
      `${opener} Aquí tienes el link de pago para *Pro* ($${KALYO_PRICING.pro.price_monthly}/mes):\n\n` +
      `💎 Pro: ${proLink}\n\n` +
      `El pago es vía Stripe (tarjeta de crédito/débito). Si tienes dudas, dime.`
    );
  }

  return (
    `${opener} Aquí tienes el link de pago para *Max* (recomendado):\n\n` +
    `🚀 Max $${KALYO_PRICING.max.price_monthly}/mes:\n${maxLink}\n\n` +
    `Si prefieres Pro ($${KALYO_PRICING.pro.price_monthly}/mes, más básico): ${proLink}\n\n` +
    `El pago es vía Stripe (tarjeta de crédito/débito). Si tienes dudas, dime.`
  );
}
