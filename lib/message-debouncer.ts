const PROCESSING_LOCKS = new Map<
  string,
  {
    startedAt: number;
    promise: Promise<unknown>;
  }
>();

export const DEBOUNCE_WINDOW_MS = 3000;

/**
 * Prevents duplicate processing when a user sends several messages within a few seconds.
 * Returns null when the conversation is already being processed (second message absorbed).
 */
export async function processWithDebounce<T>(
  conversationKey: string,
  handler: () => Promise<T>,
): Promise<T | null> {
  const existing = PROCESSING_LOCKS.get(conversationKey);

  if (existing && Date.now() - existing.startedAt < DEBOUNCE_WINDOW_MS) {
    console.log('[debouncer] message ignored, conversation locked', { conversationKey });
    return null;
  }

  const promise = handler();
  PROCESSING_LOCKS.set(conversationKey, {
    startedAt: Date.now(),
    promise,
  });

  try {
    return await promise;
  } finally {
    setTimeout(() => PROCESSING_LOCKS.delete(conversationKey), DEBOUNCE_WINDOW_MS);
  }
}

/** Test helper — clears in-memory locks between test runs. */
export function clearDebounceLocksForTests(): void {
  PROCESSING_LOCKS.clear();
}
