const LAST_CHECK_KEY = 'hot_lead_last_check';
const NOTIFIED_IDS_KEY = 'hot_lead_notified_ids';
const MUTED_KEY = 'hot_lead_notifications_muted';
const MAX_NOTIFIED_IDS = 500;
const NOTIFIED_TTL_MS = 24 * 60 * 60 * 1000;

type NotifiedStore = {
  ids: string[];
  updatedAt: string;
};

function readNotifiedStore(): NotifiedStore {
  if (typeof window === 'undefined') {
    return { ids: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(NOTIFIED_IDS_KEY);
    if (!raw) return { ids: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as NotifiedStore;
    if (!Array.isArray(parsed.ids)) return { ids: [], updatedAt: new Date().toISOString() };
    return parsed;
  } catch {
    return { ids: [], updatedAt: new Date().toISOString() };
  }
}

function writeNotifiedStore(store: NotifiedStore): void {
  localStorage.setItem(NOTIFIED_IDS_KEY, JSON.stringify(store));
}

export function getHotLeadLastCheck(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LAST_CHECK_KEY);
}

export function setHotLeadLastCheck(iso: string): void {
  localStorage.setItem(LAST_CHECK_KEY, iso);
}

export function initHotLeadLastCheck(): void {
  if (!getHotLeadLastCheck()) {
    setHotLeadLastCheck(new Date().toISOString());
  }
}

export function loadNotifiedHotLeadIds(): Set<string> {
  const store = readNotifiedStore();
  const age = Date.now() - new Date(store.updatedAt).getTime();
  if (age > NOTIFIED_TTL_MS) return new Set();
  return new Set(store.ids);
}

export function markHotLeadNotified(id: string): void {
  const store = readNotifiedStore();
  const age = Date.now() - new Date(store.updatedAt).getTime();
  let ids = age > NOTIFIED_TTL_MS ? [] : [...store.ids];
  if (!ids.includes(id)) ids.push(id);
  if (ids.length > MAX_NOTIFIED_IDS) {
    ids = ids.slice(ids.length - Math.floor(MAX_NOTIFIED_IDS / 2));
  }
  writeNotifiedStore({ ids, updatedAt: new Date().toISOString() });
}

export function isHotLeadNotificationsMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTED_KEY) === 'true';
}

export function setHotLeadNotificationsMuted(muted: boolean): void {
  localStorage.setItem(MUTED_KEY, String(muted));
  window.dispatchEvent(new CustomEvent('hot-lead-mute-change', { detail: { muted } }));
}
