import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
}

export function truncate(text: string | null, len = 80): string {
  if (!text) return '—';
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export function extractLeadName(phone: string, signals: string[] | null): string {
  if (signals?.length) {
    const named = signals.find((s) => /nombre/i.test(s));
    if (named) {
      return named.replace(/^nombre[:\s]*/i, '').trim() || phone;
    }
  }
  return phone;
}

export function avatarLabel(phone: string, temperature: string | null): string {
  if (temperature === 'hot') return '🔥';
  if (temperature === 'warm') return '🟡';
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(-2);
  const cleaned = phone.replace(/^webchat:|^tg:/, '');
  return cleaned.slice(0, 2).toUpperCase() || '?';
}

export function whatsAppUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function isHandoffActive(conv: { handoff_active?: boolean | null } | null): boolean {
  return Boolean(conv?.handoff_active);
}

export function conversationStatus(conv: {
  is_closed: boolean;
  needs_reply: boolean;
  handoff_active?: boolean;
}): { label: string; tone: 'active' | 'unanswered' | 'closed' | 'handoff' } {
  if (conv.is_closed) return { label: 'Cerrada', tone: 'closed' };
  if (conv.handoff_active) return { label: 'En handoff', tone: 'handoff' };
  if (conv.needs_reply) return { label: 'Sin responder', tone: 'unanswered' };
  return { label: 'Activa', tone: 'active' };
}

export function temperatureBadge(temperature: string | null): {
  label: string;
  tone: 'hot' | 'warm' | 'cold';
} | null {
  if (!temperature) return null;
  if (temperature === 'hot') return { label: 'Hot', tone: 'hot' };
  if (temperature === 'warm') return { label: 'Warm', tone: 'warm' };
  return { label: 'Cold', tone: 'cold' };
}

export function statusToneToBadge(
  tone: 'active' | 'unanswered' | 'closed' | 'handoff',
): 'primary' | 'hot' | 'warning' | 'gray' {
  if (tone === 'unanswered') return 'hot';
  if (tone === 'handoff') return 'warning';
  if (tone === 'closed') return 'gray';
  return 'primary';
}
