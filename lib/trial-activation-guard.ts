const ADMIN_TRIAL_TOOL_NAMES = [
  'admin_activate_trial_for_lead',
  'create_account_and_activate_trial',
] as const;

const TRIAL_ACTIVATION_HALLUCINATION_RE =
  /\btrial\s+(?:max|pro)\s+activado\b|\btrial\s+activado\s+para\b/i;

function extractToolBotMessage(
  toolResults: Record<string, unknown>,
  toolName: string,
): string | null {
  const raw = toolResults[toolName];
  if (!raw || typeof raw !== 'object') return null;
  const msg = (raw as Record<string, unknown>).bot_message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
}

function looksLikeTrialActivationHallucination(text: string): boolean {
  if (!TRIAL_ACTIVATION_HALLUCINATION_RE.test(text)) return false;
  return !/contraseña\s+temporal|🔑/i.test(text);
}

export function applyAdminTrialActivationGuard(params: {
  replyText: string;
  toolsCalled: string[];
  toolResults: Record<string, unknown>;
  conversationId: string;
}): { replyText: string; guarded: boolean } {
  for (const toolName of ADMIN_TRIAL_TOOL_NAMES) {
    if (!params.toolsCalled.includes(toolName)) continue;
    const botMessage = extractToolBotMessage(params.toolResults, toolName);
    if (botMessage) {
      console.log(
        `[trial-activation-guard] using tool bot_message verbatim | tool=${toolName} | conv=${params.conversationId}`,
      );
      return { replyText: botMessage, guarded: true };
    }
  }

  const usedAdminTrialTool = ADMIN_TRIAL_TOOL_NAMES.some((name) =>
    params.toolsCalled.includes(name),
  );

  if (
    !usedAdminTrialTool &&
    looksLikeTrialActivationHallucination(params.replyText)
  ) {
    console.error(
      `[trial-activation-guard] blocked hallucinated trial activation | conv=${params.conversationId}`,
    );
    return {
      replyText:
        'No pude confirmar la activación en el sistema porque no se ejecutó la herramienta de onboarding. ' +
        'Pásame email, nombre completo y WhatsApp del psicólogo (formato +57...) y lo activo de nuevo con contraseña.',
      guarded: true,
    };
  }

  return { replyText: params.replyText, guarded: false };
}
