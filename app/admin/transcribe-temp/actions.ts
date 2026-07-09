'use server';

import { del, get } from '@vercel/blob';

export async function transcribeAudio(
  blobUrl: string,
  fileName: string
): Promise<{ text: string } | { error: string }> {
  if (!blobUrl?.trim()) {
    return { error: 'falta la URL del archivo' };
  }

  const apiKey = process.env.GROQ_API_KEY;

  try {
    if (!apiKey) {
      return { error: 'GROQ_API_KEY no configurada' };
    }

    const blobResult = await get(blobUrl, { access: 'private' });
    if (!blobResult?.stream) {
      return { error: 'no se pudo descargar el audio desde Blob' };
    }

    const audioBuffer = await new Response(blobResult.stream).arrayBuffer();
    const audioBlob = new Blob([audioBuffer], {
      type: blobResult.blob.contentType || 'application/octet-stream',
    });

    const transcriptionForm = new FormData();
    transcriptionForm.append('file', audioBlob, fileName || 'audio.mp3');
    transcriptionForm.append('model', 'whisper-large-v3-turbo');
    transcriptionForm.append('language', 'es');
    transcriptionForm.append('response_format', 'text');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: transcriptionForm,
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return { error: errText };
    }

    const text = await groqRes.text();
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
