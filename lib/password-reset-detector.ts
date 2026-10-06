/**
 * Detects password-reset / locked-out access requests on WhatsApp.
 * Conservative: requires an explicit access/password signal (not vague "ayuda").
 */

const PASSWORD_RESET_RE =
  /(?:olvid[eé]\s+(?:mi\s+|la\s+)?(?:contrase[nñ]a|password)|olvide\s+(?:la\s+|mi\s+)?(?:contrase[nñ]a|password)|recupera(?:r)?\s+(?:mi\s+|la\s+)?(?:contrase[nñ]a|password)|reset(?:ear)?\s+(?:mi\s+|la\s+)?(?:contrase[nñ]a|password)|cambiar\s+(?:mi\s+|la\s+)?(?:contrase[nñ]a|password)|nueva\s+contrase[nñ]a)/i;

const ACCESS_BLOCKED_RE =
  /(?:contrase[nñ]a\s+incorrecta|password\s+incorrect[oa]|no\s+(?:puedo|pude)\s+entrar|no\s+me\s+deja\s+entrar|no\s+me\s+deja\s+acceder|no\s+puedo\s+acceder|no\s+puedo\s+iniciar\s+sesi[oó]n)/i;

/** Recovery / welcome email never arrives — common after in-app "Olvidé mi contraseña". */
const RESET_EMAIL_MISSING_RE =
  /no\s+me\s+(?:lleg(?:a|o|ó)|recib[oíó]|ha\s+llegado)\s+.{0,40}?(?:correo|email|mail|e-?mail)/i;

export function detectPasswordResetRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;

  if (PASSWORD_RESET_RE.test(text)) return true;
  if (ACCESS_BLOCKED_RE.test(text)) return true;
  if (RESET_EMAIL_MISSING_RE.test(text)) return true;

  return false;
}
