export type ConversationChannel = 'whatsapp' | 'webchat' | 'telegram';

export type ChannelFilter = 'all' | ConversationChannel;

export function normalizeChannel(value: string | null | undefined): ConversationChannel {
  if (value === 'webchat' || value === 'telegram') return value;
  return 'whatsapp';
}

export function channelBadge(channel: string | null | undefined): {
  label: string;
  emoji: string;
  tone: 'primary' | 'info' | 'gray';
} {
  const c = normalizeChannel(channel);
  if (c === 'webchat') {
    return { label: 'Web', emoji: '💬', tone: 'info' };
  }
  if (c === 'telegram') {
    return { label: 'Telegram', emoji: '📨', tone: 'info' };
  }
  return { label: 'WhatsApp', emoji: '📱', tone: 'primary' };
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
