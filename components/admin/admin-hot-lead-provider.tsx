'use client';

import { useHotLeadNotifier } from '@/lib/hooks/useHotLeadNotifier';

export function AdminHotLeadProvider({ children }: { children: React.ReactNode }) {
  useHotLeadNotifier();
  return <>{children}</>;
}
