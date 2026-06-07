import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  formatMexicoDate,
  generateDailyReport,
  persistDailyReport,
} from '@/lib/daily-analytics';
import { sendDailyReportTelegram } from '@/lib/daily-report-telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const botId = process.env.KALYO_BOT_ID;
  if (!botId) {
    return Response.json({ error: 'Missing KALYO_BOT_ID' }, { status: 500 });
  }

  const url = new URL(request.url);
  const overrideDate = url.searchParams.get('date');
  const reportDate = overrideDate ?? formatMexicoDate(new Date());

  console.log('[daily-analytics-cron] starting', { botId, reportDate });

  const supabase = createAdminClient();

  try {
    const report = await generateDailyReport(supabase, botId, reportDate);
    const telegram = await sendDailyReportTelegram(report);
    await persistDailyReport(supabase, report, telegram.success);

    console.log('[daily-analytics-cron] done', {
      reportDate,
      total: report.total_conversations,
      leads: report.leads_captured,
      telegram: telegram.success,
    });

    return Response.json({
      ok: true,
      report_date: reportDate,
      total_conversations: report.total_conversations,
      leads_captured: report.leads_captured,
      hot_leads: report.hot_leads,
      conversion_rate: report.conversion_rate,
      telegram_sent: telegram.success,
      telegram_error: telegram.error ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[daily-analytics-cron] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
