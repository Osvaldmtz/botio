/**
 * Detects "congreso" keyword for the Plan MAX 30-day trial flow.
 */
export function detectCongreso(message: string): boolean {
  return /congreso/i.test(message.trim());
}
