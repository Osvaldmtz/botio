import type { WeeklyMarketingReport } from '@/lib/weekly-report-builder';
import type { WowNumber } from '@/lib/weekly-report/types';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wowCell(wow: WowNumber, suffix = ''): string {
  const cls =
    wow.delta > 0 ? 'up' : wow.delta < 0 ? 'down' : 'flat';
  const pct =
    wow.delta_pct != null
      ? ` <span class="wow ${cls}">(${wow.delta >= 0 ? '+' : ''}${wow.delta_pct}%)</span>`
      : '';
  return `${wow.current.toLocaleString('es-MX')}${suffix}${pct}`;
}

function renderKeywordTable(
  rows: Array<{ keyword: string; position: number; position_change: number | null; volume: number }>,
  title: string,
): string {
  if (!rows.length) return `<p class="muted">Sin datos</p>`;
  const trs = rows
    .map(
      (k) =>
        `<tr><td>${esc(k.keyword)}</td><td>#${k.position}</td><td>${k.position_change != null ? (k.position_change > 0 ? '+' : '') + k.position_change : '—'}</td><td>${k.volume.toLocaleString('es-MX')}</td></tr>`,
    )
    .join('');
  return `<h3>${esc(title)}</h3><table><thead><tr><th>Keyword</th><th>Pos.</th><th>Δ</th><th>Vol.</th></tr></thead><tbody>${trs}</tbody></table>`;
}

/** Render self-contained HTML report for download / storage. */
export function renderWeeklyReportHtml(report: WeeklyMarketingReport): string {
  const bullets = report.executive_summary
    .map((b) => `<li>${esc(b)}</li>`)
    .join('');

  const gscPages = report.gsc.top_pages_by_clicks
    .map(
      (p) =>
        `<tr><td>${esc(p.page)}</td><td>${p.clicks}</td><td>${p.impressions.toLocaleString('es-MX')}</td><td>${p.ctr}%</td></tr>`,
    )
    .join('');

  const gscQueries = report.gsc.top_queries_by_impressions
    .map(
      (q) =>
        `<tr><td>${esc(q.query)}</td><td>${q.impressions.toLocaleString('es-MX')}</td><td>${q.clicks}</td><td>${q.ctr}%</td></tr>`,
    )
    .join('');

  const googleCampaigns = report.google_ads.combined.campaigns
    .map(
      (c) =>
        `<tr><td>${esc(c.campaign_name)}</td><td>${c.status}</td><td>${c.spend.toLocaleString('es-MX')}</td><td>${c.conversions}</td><td>${c.ctr}%</td><td>${c.cpa != null ? c.cpa.toLocaleString('es-MX') : '—'}</td></tr>`,
    )
    .join('');

  const metaCampaigns = report.meta_ads.active_campaigns
    .map(
      (c) =>
        `<tr><td>${esc(c.campaign_name)}</td><td>${c.effective_status}</td><td>${c.spend.toLocaleString('es-MX')}</td><td>${c.conversations}</td><td>${c.ctr}%</td><td>${c.cpa != null ? c.cpa.toLocaleString('es-MX') : '—'}</td></tr>`,
    )
    .join('');

  const errorsBlock =
    report.errors.length > 0
      ? `<div class="errors"><strong>Fuentes con error:</strong><ul>${report.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporte Semanal Marketing — Kalyo</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e7ecf3; --muted:#8b9cb3; --accent:#6366f1; --up:#22c55e; --down:#ef4444; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.5; }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    h2 { font-size: 1.1rem; margin: 2rem 0 0.75rem; color: var(--accent); border-bottom: 1px solid #2d3748; padding-bottom: 0.35rem; }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.5rem; }
    .meta { color: var(--muted); font-size: 0.875rem; margin-bottom: 1.5rem; }
    section { background: var(--card); border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; }
    ul.summary { margin: 0; padding-left: 1.25rem; }
    ul.summary li { margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #2d3748; }
    th { color: var(--muted); font-weight: 600; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
    .metric { background: #111827; border-radius: 8px; padding: 0.75rem; }
    .metric label { display: block; font-size: 0.75rem; color: var(--muted); }
    .metric value { font-size: 1.1rem; font-weight: 600; }
    .wow.up { color: var(--up); }
    .wow.down { color: var(--down); }
    .wow.flat { color: var(--muted); }
    .errors { background: #451a1a; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.85rem; }
    .muted { color: var(--muted); }
    .rec { background: #1e1b4b; border-left: 3px solid var(--accent); padding: 0.75rem 1rem; border-radius: 0 8px 8px 0; margin-top: 0.75rem; }
  </style>
</head>
<body>
  <h1>📊 Reporte Semanal de Marketing — Kalyo</h1>
  <p class="meta">Periodo: ${esc(report.period_label)} · Generado: ${esc(new Date(report.generated_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }))}</p>
  ${errorsBlock}

  <section>
    <h2>Resumen ejecutivo</h2>
    <ul class="summary">${bullets}</ul>
  </section>

  <section>
    <h2>1. SEO Orgánico (GSC)</h2>
    <div class="metrics">
      <div class="metric"><label>Clicks</label><value>${wowCell(report.gsc.totals.clicks)}</value></div>
      <div class="metric"><label>Impresiones</label><value>${wowCell(report.gsc.totals.impressions)}</value></div>
      <div class="metric"><label>CTR</label><value>${wowCell(report.gsc.totals.ctr, '%')}</value></div>
      <div class="metric"><label>Posición prom.</label><value>${wowCell(report.gsc.totals.position)}</value></div>
    </div>
    <h3>Top 10 páginas por clicks</h3>
    <table><thead><tr><th>Página</th><th>Clicks</th><th>Imp.</th><th>CTR</th></tr></thead><tbody>${gscPages || '<tr><td colspan="4" class="muted">Sin datos</td></tr>'}</tbody></table>
    <h3>Top 10 queries por impresiones</h3>
    <table><thead><tr><th>Query</th><th>Imp.</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>${gscQueries || '<tr><td colspan="4" class="muted">Sin datos</td></tr>'}</tbody></table>
  </section>

  <section>
    <h2>2. Google Ads (COP)</h2>
    <p class="muted">Cuentas: ${report.google_ads.customer_ids.join(', ')}</p>
    <div class="metrics">
      <div class="metric"><label>Gasto</label><value>${wowCell(report.google_ads.combined.totals.spend, ' COP')}</value></div>
      <div class="metric"><label>Conversiones</label><value>${wowCell(report.google_ads.combined.totals.conversions)}</value></div>
      <div class="metric"><label>CTR</label><value>${wowCell(report.google_ads.combined.totals.ctr, '%')}</value></div>
      <div class="metric"><label>CPA</label><value>${wowCell(report.google_ads.combined.totals.cpa, ' COP')}</value></div>
    </div>
    <h3>Campañas</h3>
    <table><thead><tr><th>Campaña</th><th>Estado</th><th>Gasto</th><th>Conv.</th><th>CTR</th><th>CPA</th></tr></thead><tbody>${googleCampaigns || '<tr><td colspan="6" class="muted">Sin datos</td></tr>'}</tbody></table>
  </section>

  <section>
    <h2>3. Meta Ads (MXN)</h2>
    <div class="metrics">
      <div class="metric"><label>Gasto</label><value>${wowCell(report.meta_ads.totals.spend, ' MXN')}</value></div>
      <div class="metric"><label>Conversaciones</label><value>${wowCell(report.meta_ads.totals.conversations)}</value></div>
      <div class="metric"><label>CTR</label><value>${wowCell(report.meta_ads.totals.ctr, '%')}</value></div>
      <div class="metric"><label>CPA</label><value>${wowCell(report.meta_ads.totals.cpa, ' MXN')}</value></div>
    </div>
    <h3>Campañas activas / con gasto</h3>
    <table><thead><tr><th>Campaña</th><th>Estado</th><th>Gasto</th><th>Conv.</th><th>CTR</th><th>CPA</th></tr></thead><tbody>${metaCampaigns || '<tr><td colspan="6" class="muted">Sin datos</td></tr>'}</tbody></table>
  </section>

  <section>
    <h2>4. Comparativa de canales</h2>
    <table>
      <thead><tr><th>Canal</th><th>Gasto USD</th><th>Conversiones</th><th>CPA USD</th></tr></thead>
      <tbody>
        <tr><td>Meta</td><td>$${report.channel_compare.meta.spend_usd.toFixed(2)}</td><td>${report.channel_compare.meta.conversions}</td><td>${report.channel_compare.meta.cpa_usd != null ? '$' + report.channel_compare.meta.cpa_usd.toFixed(2) : '—'}</td></tr>
        <tr><td>Google</td><td>$${report.channel_compare.google.spend_usd.toFixed(2)}</td><td>${report.channel_compare.google.conversions}</td><td>${report.channel_compare.google.cpa_usd != null ? '$' + report.channel_compare.google.cpa_usd.toFixed(2) : '—'}</td></tr>
      </tbody>
    </table>
    <div class="rec"><strong>Recomendación:</strong> ${esc(report.channel_compare.budget_recommendation)}</div>
  </section>

  <section>
    <h2>5. SEO Técnico — Posiciones (DataForSEO MX)</h2>
    <p>Keywords mejoradas: <strong>${report.seo_position.keywords_improved ?? '—'}</strong> · Empeoradas: <strong>${report.seo_position.keywords_declined ?? '—'}</strong></p>
    ${renderKeywordTable(report.seo_position.top_improved, 'Top keywords que subieron')}
    ${renderKeywordTable(report.seo_position.top_declined, 'Top keywords que bajaron')}
  </section>
</body>
</html>`;
}
