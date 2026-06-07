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
  return digits.slice(-2) || '?';
}

export function whatsAppUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function conversationStatus(conv: {
  is_closed: boolean;
  needs_reply: boolean;
}): { label: string; tone: 'active' | 'unanswered' | 'closed' } {
  if (conv.is_closed) return { label: 'Cerrada', tone: 'closed' };
  if (conv.needs_reply) return { label: 'Sin responder', tone: 'unanswered' };
  return { label: 'Activa', tone: 'active' };
}

export function temperatureBadge(temperature: string | null): {
  label: string;
  className: string;
} | null {
  if (!temperature) return null;
  if (temperature === 'hot') {
    return { label: 'Hot', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
  }
  if (temperature === 'warm') {
    return {
      label: 'Warm',
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    };
  }
  return { label: 'Cold', className: 'bg-bg-border text-fg-muted border-bg-border' };
}
