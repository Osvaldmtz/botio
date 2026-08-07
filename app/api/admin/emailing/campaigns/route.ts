import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createCampaign,
  listCampaigns,
  sendCampaignTest,
} from '@/lib/emailing/campaigns';
import { isEmailSegmentId } from '@/lib/emailing/segments';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const campaigns = await listCampaigns(supabase);
    return NextResponse.json({ campaigns });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      subject?: string;
      htmlBody?: string;
      segment?: string;
      scheduledAt?: string | null;
      testEmail?: string;
    };

    if (body.action === 'test') {
      if (!body.testEmail?.includes('@') || !body.subject || !body.htmlBody) {
        return NextResponse.json(
          { error: 'testEmail, subject and htmlBody are required' },
          { status: 400 },
        );
      }
      const result = await sendCampaignTest({
        to: body.testEmail,
        subject: body.subject,
        htmlBody: body.htmlBody,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (
      !body.name?.trim() ||
      !body.subject?.trim() ||
      !body.htmlBody?.trim() ||
      !body.segment ||
      !isEmailSegmentId(body.segment)
    ) {
      return NextResponse.json(
        { error: 'name, subject, htmlBody and valid segment are required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const campaign = await createCampaign(supabase, {
      name: body.name,
      subject: body.subject,
      htmlBody: body.htmlBody,
      segment: body.segment,
      scheduledAt: body.scheduledAt ?? null,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
