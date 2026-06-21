import { isAdmin } from '@/lib/admin-auth';
import { buildKpiAnalysisPrompt, KPI_ANALYSIS_SYSTEM_PROMPT } from '@/lib/kpi/insights-prompt';
import type { KpiInsightsData } from '@/lib/kpi/insights-types';

export const dynamic = 'force-dynamic';

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function extractTextDelta(line: string): string | null {
  if (!line.startsWith('data: ')) return null;
  const payload = line.slice(6).trim();
  if (!payload || payload === '[DONE]') return null;

  try {
    const parsed = JSON.parse(payload) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
      return parsed.delta.text ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  if (!isAdmin()) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }), { status: 500 });
  }

  let kpiData: KpiInsightsData;
  try {
    kpiData = (await request.json()) as KpiInsightsData;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  kpiData = {
    ...kpiData,
    metaAds: { ...kpiData.metaAds, currency: 'MXN' },
  };

  const userPrompt = buildKpiAnalysisPrompt(kpiData);

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      stream: true,
      system: KPI_ANALYSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const detail = await anthropicRes.text().catch(() => 'Anthropic API error');
    console.error('[kpis/analyze] Anthropic error', anthropicRes.status, detail);
    return new Response(JSON.stringify({ error: 'Error al contactar Claude' }), { status: 502 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const text = extractTextDelta(line);
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
        }

        if (buffer) {
          const text = extractTextDelta(buffer);
          if (text) controller.enqueue(new TextEncoder().encode(text));
        }
      } catch (err) {
        console.error('[kpis/analyze] stream error', err);
        controller.error(err);
        return;
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
