export function personalizeTemplate(
  html: string,
  psychologistName?: string | null,
): string {
  const name = psychologistName?.trim() ? ` ${psychologistName.trim()}` : '';
  return html.replaceAll('{{name}}', name);
}

export function triggerLabel(
  triggerTag: string,
  cancelOnTag: string | null,
): string {
  if (cancelOnTag) return `Sin ${cancelOnTag}`;
  return triggerTag;
}

export function delayLabel(delayDays: number): string {
  if (delayDays <= 0) return 'Inmediato';
  if (delayDays === 1) return '1 día';
  return `${delayDays} días`;
}
