import 'server-only';
import type { DailyReport } from '@/lib/daily-analytics';

function bulletList(items: string[], empty = '—'): string {
  if (!items.length) return empty;
  return items.map((i) => `• ${i}`).join('\n');
}

function formatFeaturedLead(lead: Record<string, unknown> | null): string {
  if (!lead) return '—';
  const phone = String(lead.phone ?? '—');
  const score = lead.score !== undefined ? String(lead.score) : '—';
  const why = String(lead.why ?? '—');
  const summary = String(lead.summary ?? '—');
  return `📞 ${phone} | Score ${score}\n${why}\n${summary}`;
}

export async function sendDailyReportTelegram(
  report: DailyReport,
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[daily-report-telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return { success: false, error: 'missing env vars' };
  }

  const dateLabel = new Date(`${report.report_date}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });

  const text = [
    `📊 <b>Reporte diario Botio — Kalyo</b>`,
    `📅 ${dateLabel}`,
    '',
    `<b>Resumen ejecutivo</b>`,
    report.executive_summary || '—',
    '',
    `<b>Métricas</b>`,
    `💬 Conversaciones activas: ${report.total_conversations}`,
    `🆕 Nuevas: ${report.new_conversations}`,
    `📬 Leads capturados: ${report.leads_captured}`,
    `🔥 Hot leads: ${report.hot_leads}`,
    `🎁 Trials activados: ${report.trials_activated}`,
    `📈 Conversión: ${report.conversion_rate}%`,
    '',
    `<b>Preguntas top</b>`,
    bulletList(report.top_questions),
    '',
    `<b>Objeciones top</b>`,
    bulletList(report.top_objections),
    '',
    `<b>Insights accionables</b>`,
    bulletList(report.actionable_insights),
    '',
    `<b>Lead destacado</b>`,
    formatFeaturedLead(report.featured_lead),
    '',
    `<b>vs ayer</b>`,
    String((report.comparison_yesterday as { summary?: string } | null)?.summary ?? '—'),
    '',
    `<b>vs semana pasada</b>`,
    String((report.comparison_last_week as { summary?: string } | null)?.summary ?? '—'),
  ].join('\n');

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[daily-report-telegram] send failed', response.status, body);
      return { success: false, error: `${response.status}: ${body}` };
    }

    console.log('[daily-report-telegram] sent successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[daily-report-telegram] error', message);
    return { success: false, error: message };
  }
}
