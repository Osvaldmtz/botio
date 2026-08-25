export const MANUAL_PAYMENT_PLATFORMS = ['mercadopago', 'transferencia', 'otro'] as const;
export type ManualPaymentPlatform = (typeof MANUAL_PAYMENT_PLATFORMS)[number];

export const MANUAL_PAYMENT_PLANS = ['starter', 'professional', 'clinic'] as const;
export type ManualPaymentPlan = (typeof MANUAL_PAYMENT_PLANS)[number];

export type ManualPaymentRow = {
  id: string;
  psychologist_email: string;
  psychologist_name: string | null;
  amount_mxn: number;
  amount_usd: number | null;
  platform: ManualPaymentPlatform;
  plan: ManualPaymentPlan;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};
