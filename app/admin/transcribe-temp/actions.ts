'use server';

import { del, get } from '@vercel/blob';
import { transcribeGroqBuffer } from '@/lib/audio-transcription';

export async function transcribeAudio(
  blobUrl: string,
  fileName: string
): Promise<{ text: string } | { error: string }> {
  if (!blobUrl?.trim()) {
    return { error: 'falta la URL del archivo' };
  }

  if (!process.env.GROQ_API_KEY) {
    return { error: 'GROQ_API_KEY no configurada' };
  }

  try {
    const blobResult = await get(blobUrl, { access: 'private' });
    if (!blobResult?.stream) {
      return { error: 'no se pudo descargar el audio desde Blob' };
    }

    const audioBuffer = Buffer.from(await new Response(blobResult.stream).arrayBuffer());
    const mimeType = blobResult.blob.contentType || 'application/octet-stream';

    const { text } = await transcribeGroqBuffer(audioBuffer, fileName || 'audio.mp3', mimeType);
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
