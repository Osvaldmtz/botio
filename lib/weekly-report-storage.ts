import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatUnknownError } from '@/lib/format-error';

const BUCKET = 'weekly-reports';

export type WeeklyReportStorageResult = {
  stored: boolean;
  path: string | null;
  public_url: string | null;
  error?: string;
};

/** Persist HTML report to Supabase Storage; falls back to meta_cache if bucket unavailable. */
export async function storeWeeklyReportHtml(
  html: string,
  reportDate: string,
): Promise<WeeklyReportStorageResult> {
  const path = `marketing/${reportDate}.html`;
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, html, {
      contentType: 'text/html',
      upsert: true,
    });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    await supabase.from('meta_cache').upsert(
      {
        cache_key: `weekly_report_latest`,
        payload: {
          path,
          report_date: reportDate,
          public_url: urlData.publicUrl,
          stored_at: new Date().toISOString(),
        },
        cached_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: 'cache_key' },
    );

    return { stored: true, path, public_url: urlData.publicUrl };
  } catch (error) {
    const message = formatUnknownError(error);
    console.warn('[weekly-report-storage] Storage upload failed, saving to meta_cache:', message);

    try {
      await supabase.from('meta_cache').upsert(
        {
          cache_key: `weekly_report_html_${reportDate}`,
          payload: { html, report_date: reportDate, stored_at: new Date().toISOString() },
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'cache_key' },
      );
      return { stored: true, path: `meta_cache:${reportDate}`, public_url: null, error: message };
    } catch (cacheError) {
      return {
        stored: false,
        path: null,
        public_url: null,
        error: `${message}; cache: ${formatUnknownError(cacheError)}`,
      };
    }
  }
}

export async function getLatestWeeklyReportMeta(): Promise<{
  report_date: string;
  public_url: string | null;
  path: string | null;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meta_cache')
    .select('payload')
    .eq('cache_key', 'weekly_report_latest')
    .maybeSingle();

  if (!data?.payload || typeof data.payload !== 'object') return null;
  const p = data.payload as Record<string, unknown>;
  return {
    report_date: String(p.report_date ?? ''),
    public_url: p.public_url ? String(p.public_url) : null,
    path: p.path ? String(p.path) : null,
  };
}
