import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getExperimentResults,
  listExperiments,
  type Experiment,
} from '@/lib/ab-testing';
import { fetchBots } from '@/app/admin/conversations/lib/conversation-queries';

export const dynamic = 'force-dynamic';

const KALYO_BOT_ID = process.env.KALYO_BOT_ID ?? '64f6eed2-1522-48fe-a2c6-f858b767df06';

const DEFAULT_VARIANT_A =
  '¡Hola! Soy Sofía de Kalyo 👋 Ayudamos a psicólogos a evaluar pacientes con +100 pruebas clínicas validadas, todo desde el navegador. ¿Qué te gustaría saber primero: evaluaciones, precios, o cómo funciona la prueba gratis?';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const [experiments, bots] = await Promise.all([
      listExperiments(supabase),
      fetchBots(supabase),
    ]);

    const withResults = await Promise.all(
      experiments.map(async (exp) => {
        const results = await getExperimentResults(supabase, exp.id);
        return { ...exp, results };
      }),
    );

    return NextResponse.json({
      experiments: withResults,
      bots,
      defaults: {
        botId: KALYO_BOT_ID,
        variantA: DEFAULT_VARIANT_A,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[admin/experiments] GET failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateBody = {
  name: string;
  description?: string;
  bot_id?: string;
  scope?: string;
  variant_a?: string;
  variant_b?: string;
  min_sample_size?: number;
  traffic_split_a?: number;
};

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const variantA = body.variant_a?.trim() || DEFAULT_VARIANT_A;
  const variantB = body.variant_b?.trim() || variantA;
  const splitA = body.traffic_split_a ?? 0.5;
  const splitB = Math.max(0, 1 - splitA);

  const supabase = createAdminClient();

  const row = {
    name,
    description: body.description?.trim() || null,
    bot_id: body.bot_id || KALYO_BOT_ID,
    scope: body.scope || 'first_message',
    status: 'active',
    variants: {
      A: { first_message: variantA },
      B: { first_message: variantB },
    },
    traffic_split: { A: splitA, B: splitB },
    min_sample_size: body.min_sample_size ?? 50,
  };

  const { data, error } = await supabase
    .from('ab_experiments')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    console.error('[admin/experiments] POST failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = await getExperimentResults(supabase, data.id);
  return NextResponse.json({ experiment: { ...(data as Experiment), results } }, { status: 201 });
}
