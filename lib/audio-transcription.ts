const GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export type TranscriptionResult = {
  success: boolean;
  text?: string;
  durationSeconds?: number;
  transcriptionLatencyMs?: number;
  error?: string;
};

type GroqVerboseResponse = {
  text?: string;
  segments?: Array<{ end?: number }>;
};

function durationFromGroqResponse(data: GroqVerboseResponse): number | undefined {
  const ends = (data.segments ?? [])
    .map((s) => s.end)
    .filter((n): n is number => typeof n === 'number');
  if (ends.length === 0) return undefined;
  return Math.ceil(Math.max(...ends));
}

export async function transcribeGroqBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<{ text: string; durationSeconds?: number; latencyMs: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  if (buffer.length > GROQ_MAX_BYTES) {
    throw new Error('audio too large');
  }

  console.log('[audio-transcription] transcribing with groq...');
  const groqStart = Date.now();

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'es');
  form.append('response_format', 'verbose_json');

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('[audio-transcription] groq api failed', response.status, body);
    throw new Error(`groq api failed: ${response.status}`);
  }

  const data = (await response.json()) as GroqVerboseResponse;
  const text = data.text?.trim();
  if (!text) {
    throw new Error('groq returned empty transcription');
  }

  return {
    text,
    durationSeconds: durationFromGroqResponse(data),
    latencyMs: Date.now() - groqStart,
  };
}

export async function transcribeAudio(
  audioUrl: string,
  accountSid: string,
  authToken: string,
): Promise<TranscriptionResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[audio-transcription] starting | url=${audioUrl}`);

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const downloadResponse = await fetch(audioUrl, {
      headers: { Authorization: `Basic ${auth}` },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!downloadResponse.ok) {
      console.error('[audio-transcription] twilio download failed', downloadResponse.status);
      return { success: false, error: 'twilio download failed' };
    }

    const buffer = Buffer.from(await downloadResponse.arrayBuffer());
    console.log(`[audio-transcription] downloaded | size=${buffer.length} bytes`);

    if (buffer.length > GROQ_MAX_BYTES) {
      console.error('[audio-transcription] audio too large', buffer.length);
      return { success: false, error: 'audio too large' };
    }

    const contentType = downloadResponse.headers.get('content-type') ?? 'audio/ogg';
    const extension = contentType.includes('mpeg') ? 'mp3' : 'ogg';

    const groq = await transcribeGroqBuffer(
      buffer,
      `audio.${extension}`,
      contentType,
      controller.signal,
    );

    const totalLatency = Date.now() - started;
    console.log(
      `[audio-transcription] success | text="${groq.text.slice(0, 120)}" | duration=${groq.durationSeconds ?? 'unknown'}s | latency=${totalLatency}ms`,
    );

    return {
      success: true,
      text: groq.text,
      durationSeconds: groq.durationSeconds,
      transcriptionLatencyMs: groq.latencyMs,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    console.error(`[audio-transcription] error | reason=${isTimeout ? 'timeout' : reason}`);
    return { success: false, error: isTimeout ? 'timeout' : reason };
  } finally {
    clearTimeout(timeout);
  }
}
