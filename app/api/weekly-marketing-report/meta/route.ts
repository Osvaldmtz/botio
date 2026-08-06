import { isAdmin } from '@/lib/admin-auth';
import { getLatestWeeklyReportMeta } from '@/lib/weekly-report-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const meta = await getLatestWeeklyReportMeta();
  if (!meta) {
    return Response.json({ error: 'No report yet' }, { status: 404 });
  }

  return Response.json(meta);
}
