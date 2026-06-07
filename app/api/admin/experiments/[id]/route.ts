import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getExperimentOutcomeBreakdown,
  getExperimentResults,
} from '@/lib/ab-testing';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: experiment, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) throw error;
    if (!experiment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [results, outcomes] = await Promise.all([
      getExperimentResults(supabase, params.id),
      getExperimentOutcomeBreakdown(supabase, params.id),
    ]);

    return NextResponse.json({ experiment, results, outcomes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/experiments/id] GET failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  action?: 'pause' | 'resume' | 'promote_winner' | 'stop';
  winner_variant?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  try {
    if (body.action === 'pause') {
      const { data, error } = await supabase
        .from('ab_experiments')
        .update({ status: 'paused' })
        .eq('id', params.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ experiment: data });
    }

    if (body.action === 'resume') {
      const { data, error } = await supabase
        .from('ab_experiments')
        .update({ status: 'active', ended_at: null })
        .eq('id', params.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ experiment: data });
    }

    if (body.action === 'promote_winner') {
      let winner = body.winner_variant;
      if (!winner) {
        const results = await getExperimentResults(supabase, params.id);
        winner = results.winner;
      }
      if (!winner) {
        return NextResponse.json({ error: 'No winner to promote' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('ab_experiments')
        .update({
          winner_variant: winner,
          status: 'completed',
          ended_at: now,
        })
        .eq('id', params.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ experiment: data });
    }

    if (body.action === 'stop') {
      const { data, error } = await supabase
        .from('ab_experiments')
        .update({ status: 'completed', ended_at: now })
        .eq('id', params.id)
        .select('*')
        .single();
      if (error) throw error;
      return NextResponse.json({ experiment: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/experiments/id] PATCH failed', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('ab_experiments')
    .update({ status: 'archived', ended_at: now })
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    console.error('[admin/experiments/id] DELETE failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ experiment: data });
}
