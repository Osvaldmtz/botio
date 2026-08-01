import { getSeoKpis, type SeoKpisResponse } from '@/lib/dataforseo-api';

export type SeoCommandMode = 'resumen' | 'posiciones' | 'backlinks' | 'competidores';

const SEO_COMMAND_RE = /^\/seo\s*(posiciones?|backlinks?|competidores?|resumen)?/i;

export function shouldInterceptSeoCommand(messageBody: string): boolean {
  return SEO_COMMAND_RE.test(messageBody.trim());
}

export function parseSeoCommandMode(messageBody: string): SeoCommandMode {
  const match = messageBody.trim().match(SEO_COMMAND_RE);
  const raw = (match?.[1] ?? 'resumen').toLowerCase();
  if (raw.startsWith('posicion')) return 'posiciones';
  if (raw.startsWith('backlink')) return 'backlinks';
  if (raw.startsWith('competidor')) return 'competidores';
  return 'resumen';
}

function formatOverviewLines(data: SeoKpisResponse): string[] {
  if (data.overview.length === 0) {
    return ['Sin datos SEO en caché. El cron diario aún no ha corrido.'];
  }
  return data.overview.map(
    (row) =>
      `${row.flag} ${row.country}: ${row.keywords_count} keywords | pos. avg ${row.avg_position ?? '—'} | ETV ${row.etv}`,
  );
}

function formatTopKeywords(data: SeoKpisResponse, limit = 10): string[] {
  if (data.top_keywords.length === 0) {
    return ['Sin keywords en caché.'];
  }
  return data.top_keywords.slice(0, limit).map(
    (row) => `${row.country} · #${row.position} ${row.keyword} (vol ${row.volume})`,
  );
}

function formatBacklinks(data: SeoKpisResponse): string[] {
  if (!data.backlinks) return ['Sin datos de backlinks en caché.'];
  return [
    `🔗 Backlinks: ${data.backlinks.total.toLocaleString('es-MX')}`,
    `🌐 Dominios referentes: ${data.backlinks.referring_domains.toLocaleString('es-MX')}`,
    `📈 Domain rank: ${data.backlinks.rank}`,
  ];
}

function formatCompetitors(data: SeoKpisResponse, limit = 5): string[] {
  if (data.competitors.length === 0) return ['Sin competidores en caché.'];
  return data.competitors.slice(0, limit).map(
    (row) => `⚔️ ${row.domain} (${row.common_keywords} keywords comunes · ETV ${row.etv})`,
  );
}

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return 'sin fecha';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatSeoWhatsAppReply(data: SeoKpisResponse, mode: SeoCommandMode): string {
  const header = `📊 *SEO Kalyo.io — hoy*`;
  const updated = `_Actualizado: ${formatUpdatedAt(data.last_updated)}_`;
  const lines: string[] = [header, ''];

  switch (mode) {
    case 'posiciones':
      lines.push('*Top posiciones*', ...formatTopKeywords(data, 15));
      break;
    case 'backlinks':
      lines.push(...formatBacklinks(data));
      break;
    case 'competidores':
      lines.push('*Competidores (MX)*', ...formatCompetitors(data, 10));
      break;
    default:
      lines.push(...formatOverviewLines(data));
      if (data.backlinks) {
        lines.push('', `🔗 Backlinks: ${data.backlinks.referring_domains} dominios referentes`);
      }
      if (data.competitors[0]) {
        lines.push(
          '',
          `⚔️ Top competidor: ${data.competitors[0].domain} (${data.competitors[0].common_keywords} keywords comunes)`,
        );
      }
      break;
  }

  lines.push('', updated);
  return lines.join('\n');
}

export type SeoCommandInterceptResult = {
  replyText: string;
  source: 'seo_command_interceptor';
};

export async function handleSeoCommandMessage(params: {
  messageBody: string;
}): Promise<SeoCommandInterceptResult | null> {
  if (!shouldInterceptSeoCommand(params.messageBody)) return null;

  const mode = parseSeoCommandMode(params.messageBody);
  const data = await getSeoKpis({ allowStale: true });

  if (!data.configured && data.overview.length === 0 && !data.backlinks) {
    return {
      replyText:
        '📊 SEO Kalyo.io\n\nSin datos en caché. Configura DATAFORSEO_LOGIN/PASSWORD y espera el cron diario.',
      source: 'seo_command_interceptor',
    };
  }

  return {
    replyText: formatSeoWhatsAppReply(data, mode),
    source: 'seo_command_interceptor',
  };
}
