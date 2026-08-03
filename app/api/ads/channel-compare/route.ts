import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { buildChannelCompareResponse } from '@/lib/ads-channel-compare-build';
import { formatUnknownError } from '@/lib/format-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await buildChannelCompareResponse();
    return Response.json(body, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    const message = formatUnknownError(error);
    console.error('[api/ads/channel-compare] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
