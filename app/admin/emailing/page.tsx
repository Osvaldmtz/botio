import 'server-only';
import { isAdmin } from '@/lib/admin-auth';
import { LoginForm } from '@/components/admin/login-form';
import { KalyoShell } from './components/kalyo-shell';

export const dynamic = 'force-dynamic';

export default function EmailingPage() {
  if (!isAdmin()) return <LoginForm />;

  return <KalyoShell />;
}
