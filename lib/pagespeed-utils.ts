/** Ensures PageSpeed API receives an absolute URL (requires http:// or https://). */
export function ensureValidUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return 'https://kalyo.io';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export type PageSpeedScores = {
  performance: number;
  seo: number;
  accessibility: number;
  best_practices: number;
  lcp: number;
  fcp: number;
  cls: number;
  tbt: number;
};

export type PageSpeedCompactScores = {
  performance: number;
  seo: number;
  lcp: number;
};

export type PageSpeedMetrics = {
  landing_mobile: PageSpeedScores;
  landing_desktop: PageSpeedScores;
  article_mobile: PageSpeedCompactScores;
  app_mobile: PageSpeedCompactScores;
  updated_at: string;
};

export type PageSpeedHistoryRow = {
  date: string;
  performance_mobile: number | null;
  performance_desktop: number | null;
  lcp_mobile: number | null;
  fcp_mobile: number | null;
  cls_mobile: number | null;
  tbt_mobile: number | null;
  seo_mobile: number | null;
};

export type VitalsStatus = 'good' | 'needs-improvement' | 'poor';

export function performanceAccent(score: number): 'emerald' | 'amber' | 'rose' {
  if (score > 89) return 'emerald';
  if (score >= 50) return 'amber';
  return 'rose';
}

export function lcpStatus(sec: number): VitalsStatus {
  if (sec < 2.5) return 'good';
  if (sec <= 4) return 'needs-improvement';
  return 'poor';
}

export function fcpStatus(sec: number): VitalsStatus {
  if (sec < 1.8) return 'good';
  if (sec <= 3) return 'needs-improvement';
  return 'poor';
}

export function tbtStatus(ms: number): VitalsStatus {
  if (ms < 200) return 'good';
  if (ms <= 600) return 'needs-improvement';
  return 'poor';
}

export function clsStatus(value: number): VitalsStatus {
  if (value < 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

export function vitalsStatusLabel(status: VitalsStatus): string {
  if (status === 'good') return '✅ Good';
  if (status === 'needs-improvement') return '⚠️ Needs improvement';
  return '❌ Poor';
}
