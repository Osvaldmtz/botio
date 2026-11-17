/**
 * Idempotent courtesy grants to apply when the past_due cron runs.
 * Safe to leave after applied — compSubscriptionByEmail short-circuits if already comped.
 */
export const PENDING_STRIPE_COMPS: Array<{
  email: string;
  reason: string;
  by: string;
  subscriptionId?: string;
}> = [
  {
    email: 'yermisayala@a-traxia.com',
    reason: 'contenido generado',
    by: 'osvaldo',
    subscriptionId: 'sub_1TyCCMD5T9oDXXE9Rq6XeGyo',
  },
];
