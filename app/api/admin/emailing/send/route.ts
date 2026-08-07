import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendSequenceEmail } from '@/lib/emailing/send';
import type { EmailSequenceRow } from '@/lib/emailing/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      to?: string;
      sequenceId?: string;
      psychologistName?: string;
    };

    const to = body.to?.trim().toLowerCase();
    const sequenceId = body.sequenceId?.trim();
    if (!to || !sequenceId) {
      return NextResponse.json(
        { error: 'to and sequenceId are required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: sequence, error } = await supabase
      .from('email_sequences')
      .select('*')
      .eq('id', sequenceId)
      .maybeSingle();

    if (error) throw error;
    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 });
    }

    const result = await sendSequenceEmail({
      supabase,
      sequence: sequence as EmailSequenceRow,
      to,
      psychologistName: body.psychologistName,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
