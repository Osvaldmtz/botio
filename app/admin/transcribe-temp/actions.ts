'use server';

export async function transcribeAudio(formData: FormData): Promise<{ text: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: 'OPENAI_API_KEY no configurada' };
  }

  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return { error: 'falta el archivo' };
  }

  const openaiForm = new FormData();
  openaiForm.append('file', file, (file as File).name || 'audio.mp3');
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', 'es');
  openaiForm.append('response_format', 'text');

  const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: openaiForm,
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return { error: errText };
  }

  const text = await openaiRes.text();
  return { text };
}
