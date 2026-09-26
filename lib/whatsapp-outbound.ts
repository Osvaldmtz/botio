/** Twilio rejects concatenated WhatsApp bodies over 1,600 characters (error 21617). */
export const WHATSAPP_BODY_PART_LIMIT = 1500;

/**
 * Twilio requires the whatsapp: prefix and rejects numbers with whitespace
 * (for example "whatsapp:+593 996001411").
 */
export function normalizeWhatsAppAddress(address: string): string {
  const compact = address.replace(/\s/g, '');
  return compact.startsWith('whatsapp:') ? compact : `whatsapp:${compact}`;
}

/**
 * Split a WhatsApp body into parts of at most `maxLength` characters.
 * Breaks at a paragraph, then a sentence, then a line, then a space.
 */
export function splitWhatsAppBody(text: string, maxLength = WHATSAPP_BODY_PART_LIMIT): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized.length <= maxLength) return [normalized];

  const parts: string[] = [];
  let rest = normalized;

  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength);
    const cut = findSplitIndex(window, maxLength);
    const part = rest.slice(0, cut).trimEnd();
    if (!part) {
      parts.push(rest.slice(0, maxLength));
      rest = rest.slice(maxLength).trimStart();
      continue;
    }
    parts.push(part);
    rest = rest.slice(cut).trimStart();
  }

  if (rest.length > 0) parts.push(rest);
  return parts;
}

function findSplitIndex(window: string, maxLength: number): number {
  const min = Math.min(window.length, Math.floor(maxLength * 0.4));

  const paragraph = window.lastIndexOf('\n\n');
  if (paragraph >= min) return paragraph;

  const sentence = lastSentenceEnd(window);
  if (sentence >= min) return sentence;

  const line = window.lastIndexOf('\n');
  if (line >= min) return line;

  const space = window.lastIndexOf(' ');
  if (space > 0) return space;

  return window.length;
}

function lastSentenceEnd(window: string): number {
  for (let i = window.length - 1; i >= 0; i--) {
    const ch = window[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
    const next = window[i + 1];
    if (next !== undefined && !/\s/.test(next)) continue;
    if (ch === '.' && isListMarker(window, i)) continue;
    return i + 1;
  }
  return -1;
}

function isListMarker(window: string, periodIndex: number): boolean {
  let j = periodIndex - 1;
  if (j < 0 || !/\d/.test(window[j])) return false;
  while (j >= 0 && /\d/.test(window[j])) j--;
  const before = j >= 0 ? window[j] : '';
  return j < 0 || /\s/.test(before);
}
