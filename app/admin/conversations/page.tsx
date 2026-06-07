import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchBots,
  fetchConversations,
  fetchDashboardStats,
} from './lib/conversation-queries';
import { ConversationsDashboard } from './components/conversations-dashboard';

export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();

  const [conversations, stats, bots] = await Promise.all([
    fetchConversations(supabase, {}),
    fetchDashboardStats(supabase),
    fetchBots(supabase),
  ]);

  return (
    <ConversationsDashboard
      initial={{
        conversations,
        stats,
        bots,
        fetchedAt: new Date().toISOString(),
      }}
    />
  );
}
