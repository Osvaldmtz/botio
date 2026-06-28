import 'server-only';
import { sendTelegramAlert } from '@/lib/telegram';

export async function sendLearningInsightTelegram(
  text: string,
): Promise<{ sent: boolean; error?: string }> {
  return sendTelegramAlert(text);
}

export { formatLearningInsightTelegram } from '@/lib/learning-analysis';
export type { LearningTelegramParams } from '@/lib/learning-analysis';
