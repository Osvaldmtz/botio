import 'server-only';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConversationThread } from '@/components/admin/conversation-thread';

export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

export default async function ConversationPage({ params }: Props) {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const { id } = params;

  const [summaryResult, messagesResult] = await Promise.all([
    supabase
      .from('conversation_summary')
      .select('customer_phone, bot_name')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (!summaryResult.data) notFound();

  const { customer_phone, bot_name } = summaryResult.data;
  const messages = (messagesResult.data ?? []) as Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }>;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-8">
        <Link
          href="/admin/conversations"
          className="mb-4 inline-block text-sm text-fg-muted hover:text-fg"
        >
          ← Conversations
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold text-fg">{customer_phone}</h1>
            <p className="text-sm text-fg-muted">{bot_name}</p>
          </div>
          <span className="text-xs text-fg-muted">{messages.length} messages</span>
        </div>
      </header>

      <ConversationThread messages={messages} />
    </main>
  );
}
