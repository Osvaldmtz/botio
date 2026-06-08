'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  isHotLeadNotificationsMuted,
  setHotLeadNotificationsMuted,
} from '@/lib/hot-lead-storage';
import { cn } from '@/lib/cn';

export function HotLeadMuteToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isHotLeadNotificationsMuted());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      setMuted(detail?.muted ?? isHotLeadNotificationsMuted());
    };
    window.addEventListener('hot-lead-mute-change', onChange);
    return () => window.removeEventListener('hot-lead-mute-change', onChange);
  }, []);

  function toggle() {
    const next = !muted;
    setHotLeadNotificationsMuted(next);
    setMuted(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={muted ? 'Notificaciones silenciadas' : 'Notificaciones activas'}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors',
        muted
          ? 'text-fg-muted hover:bg-bg-subtle hover:text-fg'
          : 'text-accent hover:bg-accent-muted/30',
      )}
    >
      {muted ? (
        <>
          <BellOff className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Silenciado</span>
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Alertas HOT</span>
        </>
      )}
    </button>
  );
}
