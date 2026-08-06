import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestWeeklyReportMeta } from '@/lib/weekly-report-storage';

export const dynamic = 'force-dynamic';

/** Download latest weekly marketing report HTML (admin only). */
export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const meta = await getLatestWeeklyReportMeta();
  if (meta?.public_url) {
    return Response.redirect(meta.public_url, 302);
  }

  if (meta?.report_date) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('meta_cache')
      .select('payload')
      .eq('cache_key', `weekly_report_html_${meta.report_date}`)
      .maybeSingle();

    const html =
      data?.payload && typeof data.payload === 'object'
        ? String((data.payload as { html?: string }).html ?? '')
        : '';

    if (html) {
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="reporte-semanal-${meta.report_date}.html"`,
        },
      });
    }
  }

  return Response.json({ error: 'No hay reporte semanal disponible' }, { status: 404 });
}
