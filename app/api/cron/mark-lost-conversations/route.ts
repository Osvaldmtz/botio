import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { markLostNoResponseConversations } from '@/lib/conversation-outcome';

export const dynamic = 'force-dynamic';

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const updated = await markLostNoResponseConversations(supabase);
    console.log(`[mark-lost-conversations] updated=${updated}`);
    return Response.json({ updated, timestamp: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mark-lost-conversations] failed', error);
    return Response.json({ error: message }, { status: 500 });
  }
}
