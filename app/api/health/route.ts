import { testClaude, testDB, testTelegram, testTwilio } from '@/lib/health-checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [database, twilio, claude, telegram] = await Promise.all([
    testDB(),
    testTwilio(),
    testClaude(),
    testTelegram(),
  ]);

  const checks = { database, twilio, claude, telegram };
  const allOk = Object.values(checks).every((c) => c === true);

  return Response.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 },
  );
}
