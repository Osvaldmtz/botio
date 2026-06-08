import { renderName } from '@/lib/render-name';

const DEFAULT_PAYMENT_LINKS = {
  pro: 'https://buy.stripe.com/6oU5kCbIcaFS4xa7AzgQE00',
  max: 'https://buy.stripe.com/dRm7sK27CbJW7Jmf31gQE01',
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

export function formatPayIntentReply(params: {
  trialUserName?: string | null;
  trialUserEmail: string;
  day15SentAt: string | null;
}): string {
  const name =
    renderName(params.trialUserName) ||
    renderName(params.trialUserEmail.split('@')[0]);
  const opener = name ? `¡Genial ${name}!` : '¡Genial!';
  const coupon = params.day15SentAt ? 'PRIMER50' : undefined;
  const proLink = getPaymentLink('pro', coupon);
  const maxLink = getPaymentLink('max', coupon);

  return (
    `${opener} Aquí tienes los links de pago:\n\n` +
    `💎 *Pro $29/mes* (lo que tienes en el trial):\n${proLink}\n\n` +
    `🚀 *Max $39/mes* (incluye asistente de voz con IA):\n${maxLink}\n\n` +
    `El pago es vía Stripe (tarjeta de crédito/débito). Si tienes dudas, dime.`
  );
}
