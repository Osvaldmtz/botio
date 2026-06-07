import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  PIPELINE_STAGES,
  movePipelineStage,
  type PipelineStage,
} from '@/lib/pipeline-utils';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

type Body = {
  to_stage: PipelineStage;
  moved_by?: string;
};

export async function POST(request: Request, { params }: Params) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!PIPELINE_STAGES.includes(body.to_stage)) {
    return NextResponse.json({ error: 'Invalid pipeline stage' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: conv, error: fetchError } = await supabase
    .from('conversations')
    .select('id, pipeline_stage')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!conv) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const movedBy = body.moved_by?.trim() || 'Admin';

  try {
    const changed = await movePipelineStage(
      supabase,
      conv.id,
      conv.pipeline_stage,
      body.to_stage,
      movedBy,
      'manual',
    );

    return NextResponse.json({
      ok: true,
      changed,
      pipeline_stage: body.to_stage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
