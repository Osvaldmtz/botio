import { AdminShell } from '@/components/admin/admin-shell';
import { KpiSubNav } from './kpi-sub-nav';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function KpiLayout({ title, subtitle, children }: Props) {
  return (
    <AdminShell title={title} subtitle={subtitle}>
      <KpiSubNav />
      {children}
    </AdminShell>
  );
}
