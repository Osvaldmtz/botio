import { transcribeGroqBuffer } from '../lib/audio-transcription';

const SAMPLE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg';

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    console.error('Missing GROQ_API_KEY — set it in .env.local to run this test.');
    process.exit(2);
  }

  console.log('[test-audio] downloading sample OGG from Wikimedia...');
  const downloadStart = Date.now();
  const response = await fetch(SAMPLE_URL, { redirect: 'follow' });
  if (!response.ok) {
    console.error('[test-audio] download failed', response.status);
    process.exit(1);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const downloadMs = Date.now() - downloadStart;
  console.log(`[test-audio] downloaded | size=${buffer.length} bytes | latency=${downloadMs}ms`);

  try {
    const result = await transcribeGroqBuffer(buffer, 'sample.ogg', 'audio/ogg');
    console.log('\n[test-audio] transcription success');
    console.log('text:', result.text);
    console.log('durationSeconds:', result.durationSeconds ?? 'unknown');
    console.log('transcriptionLatencyMs:', result.latencyMs);
    console.log('totalMs:', downloadMs + result.latencyMs);
  } catch (error) {
    console.error('[test-audio] transcription failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
