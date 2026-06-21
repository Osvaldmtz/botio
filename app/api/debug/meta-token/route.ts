import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { inspectMetaToken } from '@/lib/meta-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const inspection = await inspectMetaToken();
    return Response.json(inspection);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[debug/meta-token] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
