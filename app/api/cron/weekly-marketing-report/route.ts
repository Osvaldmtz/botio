import 'server-only';
import { buildWeeklyMarketingReport } from '@/lib/weekly-report-builder';
import { renderWeeklyReportHtml } from '@/lib/weekly-report-html';
import { storeWeeklyReportHtml } from '@/lib/weekly-report-storage';
import { sendWeeklyReportTelegram } from '@/lib/weekly-report-telegram';
import { formatUnknownError } from '@/lib/format-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const report = await buildWeeklyMarketingReport();
    const html = renderWeeklyReportHtml(report);
    const reportDate = report.range.endDate;

    const storage = await storeWeeklyReportHtml(html, reportDate);
    const telegramResult = await sendWeeklyReportTelegram(report, storage.public_url);

    return Response.json({
      ok: true,
      report_date: reportDate,
      executive_summary: report.executive_summary,
      storage,
      telegram: telegramResult,
      errors: report.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = formatUnknownError(error);
    console.error('[cron/weekly-marketing-report] failed', error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
