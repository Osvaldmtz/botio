import { AdminHotLeadProvider } from '@/components/admin/admin-hot-lead-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <AdminHotLeadProvider>{children}</AdminHotLeadProvider>
    </div>
  );
}
