import 'server-only';
import Link from 'next/link';
import { Suspense } from 'react';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConversationsFilter } from '@/components/admin/conversations-filter';

export const dynamic = 'force-dynamic';

type SearchParams = {
  bot?: string;
  phone?: string;
  from?: string;
  to?: string;
};

type Props = { searchParams: SearchParams };

function truncate(text: string | null, len = 60) {
  if (!text) return '—';
  return text.length > len ? text.slice(0, len) + '…' : text;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Bogota',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ConversationsPage({ searchParams }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const { bot = '', phone = '', from = '', to = '' } = searchParams;

  const [botsResult, convsResult] = await Promise.all([
    supabase.from('bots').select('id, name').order('name'),
    (async () => {
      let q = supabase
        .from('conversation_summary')
        .select(
          'id, customer_phone, bot_id, bot_name, message_count, last_message_at, last_message_content',
        )
        .order('last_message_at', { ascending: false });

      if (bot) q = q.eq('bot_id', bot);
      if (phone) q = q.ilike('customer_phone', `%${phone}%`);
      if (from) q = q.gte('last_message_at', from);
      if (to) q = q.lte('last_message_at', `${to}T23:59:59`);

      return q;
    })(),
  ]);

  const bots = botsResult.data ?? [];
  const conversations = convsResult.data ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Conversations</h1>
          <p className="text-sm text-fg-muted">{conversations.length} result(s)</p>
        </div>
        <Link
          href="/admin"
          className="rounded-md border border-bg-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
        >
          ← Admin
        </Link>
      </header>

      <Suspense>
        <ConversationsFilter
          bots={bots}
          currentBot={bot}
          currentPhone={phone}
          currentFrom={from}
          currentTo={to}
        />
      </Suspense>

      {conversations.length === 0 ? (
        <p className="text-sm text-fg-muted">No conversations match the current filters.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-bg-border">
          <table className="w-full text-sm">
            <thead className="border-b border-bg-border bg-bg-elevated">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Bot</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Phone</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Messages</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Last message</th>
                <th className="px-4 py-3 text-left font-medium text-fg-muted">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-bg-border">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-bg-elevated">
                  <td className="px-4 py-3 text-fg">{c.bot_name}</td>
                  <td className="px-4 py-3 font-mono text-fg">{c.customer_phone}</td>
                  <td className="px-4 py-3 text-fg-muted">{c.message_count}</td>
                  <td className="max-w-xs px-4 py-3 text-fg-muted">
                    {truncate(c.last_message_content)}
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(c.last_message_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/conversations/${c.id}`}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
