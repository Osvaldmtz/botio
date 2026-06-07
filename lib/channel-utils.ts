export type ConversationChannel = 'whatsapp' | 'webchat' | 'telegram';

export type ChannelFilter = 'all' | ConversationChannel;

export function normalizeChannel(value: string | null | undefined): ConversationChannel {
  if (value === 'webchat' || value === 'telegram') return value;
  return 'whatsapp';
}

export function channelBadge(channel: string | null | undefined): {
  label: string;
  emoji: string;
  className: string;
} {
  const c = normalizeChannel(channel);
  if (c === 'webchat') {
    return {
      label: 'Web',
      emoji: '💬',
      className: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    };
  }
  if (c === 'telegram') {
    return {
      label: 'Telegram',
      emoji: '📨',
      className: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    };
  }
  return {
    label: 'WhatsApp',
    emoji: '📱',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
}

export function formatCustomerIdentifier(
  customerPhone: string,
  channel: string | null | undefined,
): string {
  const c = normalizeChannel(channel);
  if (c === 'webchat' && customerPhone.startsWith('webchat:')) {
    return customerPhone.slice('webchat:'.length);
  }
  if (c === 'telegram' && customerPhone.startsWith('tg:')) {
    return `Telegram ${customerPhone.slice('tg:'.length)}`;
  }
  return customerPhone;
}

export function buildCustomerPhone(channel: ConversationChannel, identifier: string): string {
  if (channel === 'whatsapp') return identifier;
  if (channel === 'webchat') return `webchat:${identifier}`;
  return identifier.startsWith('tg:') ? identifier : `tg:${identifier}`;
}
