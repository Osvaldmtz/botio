import { AdminShell } from '@/components/admin/admin-shell';
import { KpiSubNav } from './kpi-sub-nav';
import { cn } from '@/lib/cn';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  jarvis?: boolean;
};

export function KpiLayout({ title, subtitle, children, jarvis }: Props) {
  return (
    <AdminShell
      title={title}
      subtitle={subtitle}
      className={jarvis ? 'text-slate-100' : undefined}
    >
      <KpiSubNav jarvis={jarvis} />
      <div className={cn(jarvis && 'mt-1')}>{children}</div>
    </AdminShell>
  );
}
