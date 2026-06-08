'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { playHotLeadSound } from '@/lib/hot-lead-sound';
import {
  getHotLeadLastCheck,
  initHotLeadLastCheck,
  isHotLeadNotificationsMuted,
  loadNotifiedHotLeadIds,
  markHotLeadNotified,
  setHotLeadLastCheck,
} from '@/lib/hot-lead-storage';
import { customerDisplayName } from '@/app/admin/conversations/lib/format';

export type HotLeadNotification = {
  id: string;
  customer_phone: string;
  lead_score: number | null;
  lead_signals: string[] | null;
  created_at: string;
};

const POLL_INTERVAL_MS = 10_000;

function notifyHotLead(lead: HotLeadNotification, router: ReturnType<typeof useRouter>): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const name = customerDisplayName(lead.customer_phone, lead.lead_signals);
  const score = lead.lead_score ?? 0;

  const notification = new Notification('🔥 HOT Lead nuevo!', {
    body: `${name} • Score ${score}/100\n${lead.customer_phone}`,
    icon: '/favicon.ico',
    tag: `hot-lead-${lead.id}`,
    requireInteraction: false,
  });

  notification.onclick = () => {
    window.focus();
    router.push(`/admin/conversations/${lead.id}`);
    notification.close();
  };

  setTimeout(() => notification.close(), 5000);
}

export function useHotLeadNotifier(): void {
  const router = useRouter();
  const pollingRef = useRef(false);
  const mutedRef = useRef(false);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;

    try {
      const lastCheck = getHotLeadLastCheck();
      if (!lastCheck) {
        initHotLeadLastCheck();
        return;
      }

      const res = await fetch(
        `/api/admin/conversations?onlyHot=true&newSince=${encodeURIComponent(lastCheck)}`,
      );
      if (!res.ok) return;

      const data = (await res.json()) as { conversations?: HotLeadNotification[] };
      const leads = data.conversations ?? [];
      if (leads.length === 0) {
        setHotLeadLastCheck(new Date().toISOString());
        return;
      }

      const notified = loadNotifiedHotLeadIds();
      const fresh = leads.filter((lead) => !notified.has(lead.id));
      if (fresh.length === 0) {
        setHotLeadLastCheck(new Date().toISOString());
        return;
      }

      const muted = mutedRef.current;
      if (!muted) {
        playHotLeadSound();
        for (const lead of fresh) {
          notifyHotLead(lead, router);
        }
      }

      for (const lead of fresh) {
        markHotLeadNotified(lead.id);
      }

      setHotLeadLastCheck(new Date().toISOString());
    } catch (err) {
      console.error('[hot-lead-notifier] poll failed', err);
    } finally {
      pollingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    initHotLeadLastCheck();
    mutedRef.current = isHotLeadNotificationsMuted();

    const onMuteChange = (e: Event) => {
      const detail = (e as CustomEvent<{ muted: boolean }>).detail;
      mutedRef.current = detail?.muted ?? isHotLeadNotificationsMuted();
    };
    window.addEventListener('hot-lead-mute-change', onMuteChange);

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      window.removeEventListener('hot-lead-mute-change', onMuteChange);
    };
  }, [poll]);
}
