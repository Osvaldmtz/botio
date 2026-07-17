import { detectTrialPlanPreference, type TrialPlanChoice } from '@/lib/kalyo-trial-plans';
import { normalizePhoneForDB } from '@/lib/phone-validation';

const ADMIN_TRIAL_TRIGGER_RE = /activar\s+trial/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_LABELED_RE =
  /(?:whatsapp|whats\s*app|tel[eé]fono|celular|m[óo]vil|wa)\s*:?\s*(\+?\d[\d\s().-]{8,})/i;
const NAME_LABELED_RE = /(?:nombre|name)\s*:?\s*(.+)/i;
const PLAN_LABELED_RE = /(?:plan)\s*:?\s*(max|pro)\b/i;
const COMMA_FORMAT_RE =
  /activar\s+trial(?:\s+(max|pro))?\s*:?\s*([^,\n]+?)\s*,\s*([^\s,@]+@[^\s,]+)\s*,\s*(\+?\d[\d\s().-]{8,})/i;

/** Strip bidi marks and normalize unicode whitespace (e.g. NBSP from WhatsApp paste). */
function normalizeAdminTrialText(text: string): string {
  return text
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ');
}

export type AdminTrialParsedRequest = {
  email: string;
  fullName: string;
  phone: string;
  trialPlan: TrialPlanChoice;
};

export function parseAdminTrialPlanFromText(text: string): TrialPlanChoice | null {
  const normalized = text.trim().toLowerCase();
  if (
    /\bactivar\s+trial\s+pro\b/.test(normalized) ||
    /\btrial\s+pro\b/.test(normalized) ||
    PLAN_LABELED_RE.test(normalized)
  ) {
    const labeled = normalized.match(PLAN_LABELED_RE);
    if (labeled?.[1] === 'pro') return 'pro';
    if (/\bpro\b/.test(normalized) && !/\bmax\b/.test(normalized)) return 'pro';
  }
  if (
    /\bactivar\s+trial\s+max\b/.test(normalized) ||
    /\btrial\s+max\b/.test(normalized) ||
    PLAN_LABELED_RE.test(normalized)
  ) {
    const labeled = normalized.match(PLAN_LABELED_RE);
    if (labeled?.[1] === 'max') return 'max';
    if (/\bmax\b/.test(normalized) && !/\bpro\b/.test(normalized)) return 'max';
  }
  if (detectTrialPlanPreference(text) === 'pro') return 'pro';
  return null;
}

function resolveTrialPlanFromMessages(
  messages: Array<{ role: string; content: string }>,
): TrialPlanChoice {
  const userMessages = messages.filter((m) => m.role === 'user');
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const plan = parseAdminTrialPlanFromText(userMessages[i].content);
    if (plan) return plan;
  }
  return 'max';
}

function extractEmail(text: string): string | null {
  const match = text.match(EMAIL_RE);
  return match ? match[0].toLowerCase() : null;
}

function extractPhone(text: string): string | null {
  const cleaned = normalizeAdminTrialText(text);
  const labeled = cleaned.match(PHONE_LABELED_RE);
  const raw =
    labeled?.[1] ??
    cleaned.match(/(\+\d[\d\s().-]{8,})/)?.[1] ??
    cleaned.match(/(\+\d{10,15})/)?.[1];
  if (!raw) return null;
  const normalized = normalizePhoneForDB(raw.replace(/[\s().-]/g, ''));
  return normalized || null;
}

function parseMultilineAdminTrialRequest(
  text: string,
): Partial<AdminTrialParsedRequest> | null {
  const cleaned = normalizeAdminTrialText(text);
  if (!ADMIN_TRIAL_TRIGGER_RE.test(cleaned)) return null;

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const emailLine = lines.find((line) => EMAIL_RE.test(line));
  const email = emailLine?.match(EMAIL_RE)?.[0]?.toLowerCase();
  if (!email) return null;

  const phoneLine = lines.find((line) => /\+\d/.test(line.replace(/[\s().-]/g, '')));
  const phone = phoneLine ? extractPhone(phoneLine) : null;
  if (!phone) return null;

  const nameLine = lines.find((line) => {
    if (line === emailLine || line === phoneLine) return false;
    if (EMAIL_RE.test(line)) return false;
    if (ADMIN_TRIAL_TRIGGER_RE.test(line)) return false;
    if (/^(?:plan|nombre|name|correo|email|whatsapp)\s*:/i.test(line)) return false;
    return looksLikeNameOnlyMessage(line);
  });

  if (!nameLine) return null;

  return {
    email,
    phone,
    fullName: nameLine.trim(),
    trialPlan: parseAdminTrialPlanFromText(cleaned) ?? undefined,
  };
}

function extractLabeledName(text: string): string | null {
  const match = text.match(NAME_LABELED_RE);
  if (!match?.[1]) return null;
  const name = match[1]
    .split(/\n/)[0]
    .replace(/\s*(?:correo|email|whatsapp|whats\s*app|tel[eé]fono)\s*:.*$/i, '')
    .trim();
  return name || null;
}

function looksLikePlaceholderName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n.length < 3) return true;
  if (/^(?:nombre|name|placeholder|xxx|test)\b/.test(n)) return true;
  if (/^(?:psic\.?\s*)?(?:clinica|consultorio|centro|cl[ií]nica)\b/.test(n)) return true;
  return false;
}

function looksLikeNameOnlyMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (EMAIL_RE.test(trimmed)) return false;
  if (ADMIN_TRIAL_TRIGGER_RE.test(trimmed)) return false;
  if (/\+\d{10,}/.test(trimmed)) return false;
  if (/^(?:correo|email|whatsapp|nombre)\s*:/i.test(trimmed)) return false;
  return /^[\p{L}\p{M}\s'.-]+$/u.test(trimmed);
}

export function parseAdminTrialRequestFromText(text: string): Partial<AdminTrialParsedRequest> {
  const multiline = parseMultilineAdminTrialRequest(text);
  if (multiline?.email && multiline.phone && multiline.fullName) {
    return multiline;
  }

  const trialPlan = parseAdminTrialPlanFromText(text) ?? undefined;
  const commaMatch = normalizeAdminTrialText(text).match(COMMA_FORMAT_RE);
  if (commaMatch) {
    const commaPlan =
      commaMatch[1]?.toLowerCase() === 'pro'
        ? 'pro'
        : commaMatch[1]?.toLowerCase() === 'max'
          ? 'max'
          : undefined;
    return {
      fullName: commaMatch[2].trim(),
      email: commaMatch[3].trim().toLowerCase(),
      phone: extractPhone(commaMatch[4]) ?? undefined,
      trialPlan: commaPlan ?? trialPlan,
    };
  }

  return {
    email: extractEmail(text) ?? undefined,
    phone: extractPhone(text) ?? undefined,
    fullName: extractLabeledName(text) ?? undefined,
    trialPlan,
  };
}

export function parseAdminTrialRequestFromMessages(
  messages: Array<{ role: string; content: string }>,
): AdminTrialParsedRequest | null {
  const userMessages = messages.filter((m) => m.role === 'user').slice(-5);
  if (userMessages.length === 0) return null;

  const hasTrialIntent = userMessages.some((m) => ADMIN_TRIAL_TRIGGER_RE.test(m.content));
  const latest = userMessages[userMessages.length - 1]?.content ?? '';

  let email: string | undefined;
  let phone: string | undefined;
  let fullName: string | undefined;

  for (const msg of userMessages) {
    const parsed = parseAdminTrialRequestFromText(msg.content);
    email = email ?? parsed.email;
    phone = phone ?? parsed.phone;
    fullName = fullName ?? parsed.fullName;
  }

  if (looksLikeNameOnlyMessage(latest) && email && phone) {
    fullName = latest.trim();
  }

  if (!email || !phone || !fullName) return null;

  if (!hasTrialIntent && !looksLikeNameOnlyMessage(latest)) {
    return null;
  }

  if (looksLikePlaceholderName(fullName)) {
    if (!looksLikeNameOnlyMessage(latest) || latest.trim() === fullName.trim()) {
      return null;
    }
  }

  return {
    email,
    phone,
    fullName: fullName.trim(),
    trialPlan: resolveTrialPlanFromMessages(userMessages),
  };
}

export function shouldInterceptAdminTrialActivation(
  messageBody: string,
  messages: Array<{ role: string; content: string }>,
): boolean {
  if (ADMIN_TRIAL_TRIGGER_RE.test(messageBody)) return true;
  if (parseAdminTrialRequestFromMessages([...messages, { role: 'user', content: messageBody }])) {
    return true;
  }
  return false;
}
