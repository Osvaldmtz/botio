export const FALLBACK_RESPONSE_ES =
  'Dame un segundo, estoy procesando tu mensaje... 🤔 Si no recibes respuesta en 1 minuto, por favor reformula tu pregunta.';

export type ContentBlockLike = { type: string; text?: string };

/** Extract meaningful text from Anthropic content blocks, or null if empty. */
export function extractMeaningfulText(
  content: ContentBlockLike[] | undefined | null,
): string | null {
  if (!content || content.length === 0) return null;
  const textBlock = content.find((block) => block.type === 'text');
  if (!textBlock || typeof textBlock.text !== 'string' || !textBlock.text.trim()) {
    return null;
  }
  return textBlock.text;
}

export type ReplyTextSource = 'final' | 'tool_use_turn' | 'fallback';

export type ResolveReplyTextResult = {
  text: string;
  source: ReplyTextSource;
};

/**
 * Prefer the final end_turn text; if empty, fall back to text captured
 * during a prior tool_use turn; only then use the generic fallback.
 */
export function resolveReplyText(
  finalContent: ContentBlockLike[] | undefined | null,
  lastMeaningfulText: string,
): ResolveReplyTextResult {
  const finalText = extractMeaningfulText(finalContent);
  if (finalText) {
    return { text: finalText, source: 'final' };
  }
  if (lastMeaningfulText.trim()) {
    return { text: lastMeaningfulText, source: 'tool_use_turn' };
  }
  return { text: FALLBACK_RESPONSE_ES, source: 'fallback' };
}
