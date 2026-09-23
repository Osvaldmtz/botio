/**
 * Resolve a human-friendly customer name for demos / reminders.
 * Never returns "Lead WhatsApp" or similar placeholders.
 */

export const DEMO_NAME_FALLBACK = 'Doctor/a';

const GENERIC_NAME_RE =
  /^(lead(\s+whatsapp)?|whatsapp\s+lead|usuario|user|cliente|customer|test|prueba|undefined|null|n\/a|na|unknown|desconocido|sin\s+nombre)$/i;

/** Names that are usable in copy (not placeholders). */
export function isUsableDemoCustomerName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return false;
  if (GENERIC_NAME_RE.test(trimmed)) return false;
  // Reject pure emails / phones
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  if (/^\+?\d[\d\s-]{6,}$/.test(trimmed)) return false;
  // Need at least one letter
  if (!/[a-záéíóúñü]/i.test(trimmed)) return false;
  return true;
}

/** Title-case a simple person name (keeps accents). */
export function titleCasePersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2 && /^(de|del|la|las|los|y|da|do|dos|das)$/i.test(part)) {
        return part.toLowerCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * First name for greetings ("Miguel"), or fallback label.
 * "Doctor/a" and empty → DEMO_NAME_FALLBACK.
 */
export function demoGreetingName(name: string | null | undefined): string {
  if (!isUsableDemoCustomerName(name)) return DEMO_NAME_FALLBACK;
  const cleaned = titleCasePersonName(name!);
  if (/^doctor\/?a$/i.test(cleaned)) return DEMO_NAME_FALLBACK;
  const first = cleaned.split(/\s+/)[0] ?? DEMO_NAME_FALLBACK;
  return first || DEMO_NAME_FALLBACK;
}

/** "Hola Miguel," or "Hola Doctor/a," */
export function holaDemo(name: string | null | undefined): string {
  return `Hola ${demoGreetingName(name)},`;
}

/**
 * Pick the best available name from known sources (priority order).
 * Always returns a non-empty string — never a generic WhatsApp placeholder.
 */
export function resolveDemoCustomerName(sources: {
  formName?: string | null;
  conversationName?: string | null;
  pendingName?: string | null;
  toolName?: string | null;
  messageExtractedName?: string | null;
  emailLocalPart?: string | null;
}): string {
  const candidates = [
    sources.formName,
    sources.conversationName,
    sources.toolName,
    sources.pendingName,
    sources.messageExtractedName,
    sources.emailLocalPart,
  ];

  for (const raw of candidates) {
    if (!isUsableDemoCustomerName(raw)) continue;
    const titled = titleCasePersonName(raw!);
    // Skip if titled still looks like an email local-part garbage (digits only etc.)
    if (!isUsableDemoCustomerName(titled)) continue;
    return titled;
  }

  return DEMO_NAME_FALLBACK;
}

/** Soft extract: "miguel.ramirez" → "Miguel" when it looks like a person. */
export function nameFromEmailLocalPart(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return null;

  // Prefer first alpha token after splitting on separators / digits
  const parts = local
    .replace(/[0-9]+/g, '.')
    .split(/[._+\-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const alpha = parts[0] ?? '';
  if (alpha.length < 2 || alpha.length > 12) return null;
  if (!/^[a-záéíóúñü]+$/i.test(alpha)) return null;
  // Avoid common mailbox names
  if (/^(info|hola|admin|contacto|ventas|soporte|test|mail)$/i.test(alpha)) return null;
  // Reject glued full-name locals without separators (e.g. miguelaramirez)
  if (parts.length === 1 && alpha.length > 10) return null;
  return titleCasePersonName(alpha);
}

const NAME_INTRO_RE =
  /(?:me\s+llamo|mi\s+nombre\s+es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{1,60})/i;

function looksLikePersonNameLine(line: string): boolean {
  const t = line.trim();
  if (!isUsableDemoCustomerName(t)) return false;
  if (t.length > 80) return false;
  if (/[?]/.test(t)) return false;
  if (/\b(hola|demo|precio|plan|quiero|necesito|interesad[oa])\b/i.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 1 || words.length > 6) return false;
  return words.every((w) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’-]+$/.test(w));
}

/**
 * Extract a person name from recent user messages (lightweight heuristics, no LLM).
 * Prefers "Name\nemail" blocks and "me llamo X" patterns.
 */
export function extractNameFromUserMessages(
  messages: Array<{ role?: string | null; content?: string | null }>,
): string | null {
  const userMsgs = messages
    .filter((m) => (m.role ?? '') === 'user' && typeof m.content === 'string')
    .map((m) => (m.content as string).trim())
    .filter(Boolean);

  // Newest first — name usually appears when collecting contact info
  for (const content of [...userMsgs].reverse()) {
    const intro = content.match(NAME_INTRO_RE);
    if (intro?.[1] && looksLikePersonNameLine(intro[1])) {
      return titleCasePersonName(intro[1]);
    }

    const lines = content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length >= 2) {
      const maybeName = lines[0];
      const maybeEmail = lines[1];
      if (
        looksLikePersonNameLine(maybeName) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(maybeEmail)
      ) {
        return titleCasePersonName(maybeName);
      }
    }

    // Single-line full name (2–4 words, no punctuation)
    if (looksLikePersonNameLine(content) && content.split(/\s+/).length >= 2) {
      return titleCasePersonName(content);
    }
  }

  return null;
}

export function readConversationDisplayName(
  metadata: Record<string, unknown> | null | undefined,
  row?: Record<string, unknown> | null,
): string | null {
  const meta = metadata ?? {};
  const candidates = [
    meta.customer_name,
    meta.lead_name,
    meta.name,
    meta.full_name,
    row?.customer_name,
    row?.lead_name,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && isUsableDemoCustomerName(c)) {
      return titleCasePersonName(c);
    }
  }
  return null;
}
