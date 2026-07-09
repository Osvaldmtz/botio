'use server';

import { del, get } from '@vercel/blob';

export async function transcribeAudio(
  blobUrl: string,
  fileName: string
): Promise<{ text: string } | { error: string }> {
  if (!blobUrl?.trim()) {
    return { error: 'falta la URL del archivo' };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  try {
    if (!apiKey) {
      return { error: 'OPENAI_API_KEY no configurada' };
    }

    const blobResult = await get(blobUrl, { access: 'private' });
    if (!blobResult?.stream) {
      return { error: 'no se pudo descargar el audio desde Blob' };
    }

    const audioBuffer = await new Response(blobResult.stream).arrayBuffer();
    const audioBlob = new Blob([audioBuffer], {
      type: blobResult.blob.contentType || 'application/octet-stream',
    });

    const openaiForm = new FormData();
    openaiForm.append('file', audioBlob, fileName || 'audio.mp3');
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  } finally {
    try {
      await del(blobUrl);
    } catch (deleteError) {
      console.error('[transcribe-temp] failed to delete blob', deleteError);
    }
  }
}
