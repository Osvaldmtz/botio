import 'server-only';
import type { WeeklyMarketingReport } from '@/lib/weekly-report-builder';

function fmtWowShort(current: number, deltaPct: number | null, suffix = ''): string {
  if (deltaPct == null) return `${current}${suffix}`;
  const sign = deltaPct >= 0 ? '+' : '';
  return `${current}${suffix} (${sign}${deltaPct}%)`;
}

/** Compact Telegram HTML summary (full report is in Storage). */
export function formatWeeklyReportTelegram(
  report: WeeklyMarketingReport,
  downloadUrl: string | null,
): string {
  const lines: string[] = [
    '📊 <b>Reporte Semanal Marketing — Kalyo</b>',
    `📅 ${report.period_label}`,
    '',
    '<b>Resumen ejecutivo</b>',
    ...report.executive_summary.map((b) => `• ${b}`),
    '',
    '<b>SEO orgánico</b>',
    `Clicks: ${fmtWowShort(report.gsc.totals.clicks.current, report.gsc.totals.clicks.delta_pct)}`,
    `Impresiones: ${fmtWowShort(report.gsc.totals.impressions.current, report.gsc.totals.impressions.delta_pct)}`,
    `CTR: ${fmtWowShort(report.gsc.totals.ctr.current, report.gsc.totals.ctr.delta_pct, '%')}`,
    '',
    '<b>Google Ads</b> (COP)',
    `Gasto: ${fmtWowShort(report.google_ads.combined.totals.spend.current, report.google_ads.combined.totals.spend.delta_pct)}`,
    `Conv.: ${fmtWowShort(report.google_ads.combined.totals.conversions.current, report.google_ads.combined.totals.conversions.delta_pct)}`,
    `CPA: ${fmtWowShort(report.google_ads.combined.totals.cpa.current, report.google_ads.combined.totals.cpa.delta_pct)}`,
    '',
    '<b>Meta Ads</b> (MXN)',
    `Gasto: ${fmtWowShort(report.meta_ads.totals.spend.current, report.meta_ads.totals.spend.delta_pct)}`,
    `Conv. WA: ${fmtWowShort(report.meta_ads.totals.conversations.current, report.meta_ads.totals.conversations.delta_pct)}`,
    `CPA: ${fmtWowShort(report.meta_ads.totals.cpa.current, report.meta_ads.totals.cpa.delta_pct)}`,
    '',
    '<b>Comparativa CPA (USD)</b>',
    `Meta: $${report.channel_compare.meta.cpa_usd?.toFixed(0) ?? '—'} · Google: $${report.channel_compare.google.cpa_usd?.toFixed(0) ?? '—'}`,
    `💡 ${report.channel_compare.budget_recommendation}`,
    '',
    '<b>SEO posiciones</b>',
    `↑ ${report.seo_position.keywords_improved ?? '—'} · ↓ ${report.seo_position.keywords_declined ?? '—'}`,
    '',
    '📊 <b>ChatGPT Ads</b>',
    `Registros: ${report.chatgpt_ads.registrations}`,
    `Activaciones: ${report.chatgpt_ads.activations}`,
  ];

  if (report.errors.length) {
    lines.push('', `⚠️ ${report.errors.length} fuente(s) con error`);
  }

  if (downloadUrl) {
    lines.push('', `<a href="${downloadUrl}">Descargar reporte HTML completo</a>`);
  } else {
    lines.push('', '<i>Reporte HTML guardado en backup interno</i>');
  }

  let text = lines.join('\n');
  if (text.length > 4000) {
    text = `${text.slice(0, 3950)}…`;
  }
  return text;
}

export async function sendWeeklyReportTelegram(
  report: WeeklyMarketingReport,
  downloadUrl: string | null,
): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[weekly-report-telegram] missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID');
    return { sent: false, error: 'missing env vars' };
  }

  const text = formatWeeklyReportTelegram(report, downloadUrl);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { sent: false, error: `${response.status}: ${body}` };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sent: false, error: message };
  }
}
