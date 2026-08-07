'use client';

import { useState } from 'react';
import {
  BarChart3,
  Bell,
  Megaphone,
  LayoutDashboard,
  Search,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tabs } from './ui/tabs';
import { KalyoDashboard } from './kalyo-dashboard';
import { CampaignsOps } from './campaigns-ops';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { id: 'pacientes', label: 'Pacientes', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'campanas', label: 'Campañas', icon: <Megaphone className="h-3.5 w-3.5" /> },
  { id: 'analiticas', label: 'Analíticas', icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

export function KalyoShell() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div
      className={cn(
        'min-h-screen bg-ky-bg font-ky-sans text-ky-text-primary antialiased',
      )}
    >
      <header className="sticky top-0 z-30 h-ky-topbar border-b border-ky-border bg-ky-surface-0/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-kalyo items-center gap-4 px-4 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ky-nav text-ky-caption font-semibold text-white">
              K
            </span>
            <span className="text-ky-h3 text-ky-text-primary">Kalyo</span>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <Tabs items={NAV} value={tab} onChange={setTab} />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <label className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ky-text-muted" />
              <input
                type="search"
                placeholder="Buscar…"
                className="h-9 w-44 rounded-ky-badge border border-ky-border bg-ky-surface-1 pl-9 pr-3 text-ky-sm text-ky-text-primary placeholder:text-ky-text-muted focus:border-ky-accent focus:outline-none focus:ring-2 focus:ring-ky-accent-light lg:w-56"
              />
            </label>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-ky-text-secondary hover:bg-ky-surface-1"
              aria-label="Notificaciones"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ky-accent" />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ky-accent-light text-ky-caption font-medium text-ky-accent">
              OM
            </span>
          </div>
        </div>

        <div className="border-t border-ky-border-subtle px-4 py-2 md:hidden">
          <Tabs items={NAV} value={tab} onChange={setTab} className="w-full justify-between" />
        </div>
      </header>

      <main className="mx-auto max-w-kalyo px-4 py-ky-section sm:px-6">
        {tab === 'dashboard' ? <KalyoDashboard /> : null}
        {tab === 'campanas' ? <CampaignsOps /> : null}
        {tab === 'pacientes' || tab === 'analiticas' ? (
          <div className="rounded-ky-card border border-ky-border bg-ky-surface-0 p-ky-card text-center">
            <p className="text-ky-h3 text-ky-text-primary">
              {tab === 'pacientes' ? 'Pacientes' : 'Analíticas'}
            </p>
            <p className="mt-2 text-ky-sm text-ky-text-secondary">
              Sección en construcción — pronto conectada a datos clínicos.
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
