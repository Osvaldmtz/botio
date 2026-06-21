import 'server-only';
import path from 'path';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { GA4ChannelRow, GA4DailyMetric, GA4PageRow } from '@/lib/kpi/types';

type DateRangeInput = {
  startDate: string;
  endDate: string;
};

function resolveGoogleCredentialsPath(): void {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (creds && !path.isAbsolute(creds)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), creds);
  }
}

function getClient(): BetaAnalyticsDataClient {
  resolveGoogleCredentialsPath();
  return new BetaAnalyticsDataClient();
}

function propertyName(propertyId: string): string {
  return `properties/${propertyId}`;
}

export async function fetchGA4Report(
  propertyId: string,
  metrics: string[],
  dimensions: string[],
  dateRange: DateRangeInput,
): Promise<Array<Record<string, string>>> {
  const client = getClient();
  const [response] = await client.runReport({
    property: propertyName(propertyId),
    dateRanges: [dateRange],
    metrics: metrics.map((name) => ({ name })),
    dimensions: dimensions.map((name) => ({ name })),
  });

  return (response.rows ?? []).map((row) => {
    const record: Record<string, string> = {};
    dimensions.forEach((dim, i) => {
      record[dim] = row.dimensionValues?.[i]?.value ?? '';
    });
    metrics.forEach((metric, i) => {
      record[metric] = row.metricValues?.[i]?.value ?? '0';
    });
    return record;
  });
}

function parseNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getLandingMetrics(days: number): Promise<GA4DailyMetric[]> {
  const propertyId = process.env.GA4_LANDING_PROPERTY_ID ?? '531207061';
  const rows = await fetchGA4Report(
    propertyId,
    ['activeUsers', 'sessions', 'engagedSessions', 'bounceRate', 'averageSessionDuration'],
    ['date'],
    { startDate: `${days}daysAgo`, endDate: 'today' },
  );

  return rows
    .map((row) => ({
      date: row.date,
      users: parseNumber(row.activeUsers),
      sessions: parseNumber(row.sessions),
      engagedSessions: parseNumber(row.engagedSessions),
      bounceRate: parseNumber(row.bounceRate),
      averageSessionDuration: parseNumber(row.averageSessionDuration),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAppMetrics(days: number): Promise<GA4DailyMetric[]> {
  const propertyId = process.env.GA4_APP_PROPERTY_ID ?? '539858946';
  const rows = await fetchGA4Report(
    propertyId,
    ['activeUsers', 'sessions', 'engagedSessions', 'bounceRate', 'averageSessionDuration'],
    ['date'],
    { startDate: `${days}daysAgo`, endDate: 'today' },
  );

  return rows
    .map((row) => ({
      date: row.date,
      users: parseNumber(row.activeUsers),
      sessions: parseNumber(row.sessions),
      engagedSessions: parseNumber(row.engagedSessions),
      bounceRate: parseNumber(row.bounceRate),
      averageSessionDuration: parseNumber(row.averageSessionDuration),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTopPages(propertyId: string, days = 30): Promise<GA4PageRow[]> {
  const rows = await fetchGA4Report(
    propertyId,
    ['screenPageViews', 'averageSessionDuration'],
    ['pagePath'],
    { startDate: `${days}daysAgo`, endDate: 'today' },
  );

  return rows
    .map((row) => ({
      pagePath: row.pagePath || '/',
      screenPageViews: parseNumber(row.screenPageViews),
      averageSessionDuration: parseNumber(row.averageSessionDuration),
    }))
    .sort((a, b) => b.screenPageViews - a.screenPageViews)
    .slice(0, 10);
}

export async function getChannelBreakdown(propertyId: string, days = 30): Promise<GA4ChannelRow[]> {
  const rows = await fetchGA4Report(
    propertyId,
    ['activeUsers', 'sessions', 'engagementRate'],
    ['sessionDefaultChannelGroup'],
    { startDate: `${days}daysAgo`, endDate: 'today' },
  );

  return rows
    .map((row) => ({
      channel: row.sessionDefaultChannelGroup || 'Unknown',
      activeUsers: parseNumber(row.activeUsers),
      sessions: parseNumber(row.sessions),
      engagementRate: parseNumber(row.engagementRate),
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function summarizeGA4Metrics(rows: GA4DailyMetric[]): {
  users: number;
  sessions: number;
  engagementRate: number;
  bounceRate: number;
  avgDuration: number;
} {
  if (rows.length === 0) {
    return { users: 0, sessions: 0, engagementRate: 0, bounceRate: 0, avgDuration: 0 };
  }

  const users = rows.reduce((sum, r) => sum + r.users, 0);
  const sessions = rows.reduce((sum, r) => sum + r.sessions, 0);
  const engagedSessions = rows.reduce((sum, r) => sum + r.engagedSessions, 0);
  const bounceRate =
    rows.reduce((sum, r) => sum + r.bounceRate, 0) / Math.max(rows.length, 1);
  const avgDuration =
    rows.reduce((sum, r) => sum + r.averageSessionDuration, 0) / Math.max(rows.length, 1);

  return {
    users,
    sessions,
    engagementRate: sessions > 0 ? (engagedSessions / sessions) * 100 : 0,
    bounceRate: bounceRate * 100,
    avgDuration,
  };
}
