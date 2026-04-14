import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { Dashboard } from '@/components/admin/dashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isAdmin()) {
    return <LoginForm />;
  }

  const supabase = createAdminClient();

  const [businessesResult, botsResult] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('bots')
      .select('id, name, business_id, is_active, twilio_whatsapp_number, created_at')
      .order('created_at', { ascending: false }),
  ]);

  if (businessesResult.error || botsResult.error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-fg text-2xl font-bold">Admin dashboard</h1>
        <p className="mt-4 text-red-400">
          Failed to load data:{' '}
          {businessesResult.error?.message ?? botsResult.error?.message}
        </p>
      </main>
    );
  }

  return (
    <Dashboard
      businesses={businessesResult.data ?? []}
      bots={botsResult.data ?? []}
    />
  );
}
