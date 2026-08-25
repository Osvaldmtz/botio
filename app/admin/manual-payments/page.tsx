import 'server-only';
import { LoginForm } from '@/components/admin/login-form';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { listManualPayments } from '@/lib/manual-payments';
import { ManualPaymentsDashboard } from './components/manual-payments-dashboard';

export const dynamic = 'force-dynamic';

export default async function ManualPaymentsPage() {
  if (!isAdmin()) return <LoginForm />;

  const supabase = createAdminClient();
  const payments = await listManualPayments(supabase, { limit: 200 });

  return <ManualPaymentsDashboard initialPayments={payments} />;
}
