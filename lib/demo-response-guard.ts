import 'server-only';

export { applyDemoConfirmationGuard, looksLikeDemoConfirmation } from '@/lib/demo-flow-parsing';

export async function notifyDemoFlowWarning(conversationId: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const text =
    `⚠️ <b>Bug detectado</b>: bot dijo "demo confirmada" sin agendarla.\n` +
    `Conv: <code>${conversationId}</code>\n` +
    `Revisar manualmente.`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error('[demo-flow-warning] telegram notify failed', err);
  }
}
