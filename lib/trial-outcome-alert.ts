import 'server-only';
import { sendTelegramAlert } from '@/lib/telegram';

export async function alertTrialTrackingFailure(detail: string): Promise<void> {
  await sendTelegramAlert(`⚠️ Trial tracking failed: ${detail}`);
}
