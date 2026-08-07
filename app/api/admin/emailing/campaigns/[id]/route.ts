import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  executeCampaignSend,
  getCampaign,
  updateCampaign,
} from '@/lib/emailing/campaigns';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const campaign = await getCampaign(supabase, id);
    if (!campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: 'schedule' | 'send_now' | 'save';
      name?: string;
      subject?: string;
      htmlBody?: string;
      segment?: string;
      scheduledAt?: string | null;
    };

    const supabase = createAdminClient();
    const existing = await getCampaign(supabase, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (body.action === 'send_now') {
      if (body.name || body.subject || body.htmlBody || body.segment) {
        await updateCampaign(supabase, id, {
          name: body.name,
          subject: body.subject,
          htmlBody: body.htmlBody,
          segment: body.segment,
        });
      }
      const result = await executeCampaignSend(supabase, id);
      const campaign = await getCampaign(supabase, id);
      return NextResponse.json({ campaign, ...result });
    }

    if (body.action === 'schedule') {
      if (!body.scheduledAt) {
        return NextResponse.json(
          { error: 'scheduledAt is required' },
          { status: 400 },
        );
      }
      const when = new Date(body.scheduledAt);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        return NextResponse.json(
          { error: 'scheduledAt must be a future datetime' },
          { status: 400 },
        );
      }
      const campaign = await updateCampaign(supabase, id, {
        name: body.name,
        subject: body.subject,
        htmlBody: body.htmlBody,
        segment: body.segment,
        scheduledAt: when.toISOString(),
        status: 'scheduled',
      });
      return NextResponse.json({ campaign });
    }

    const campaign = await updateCampaign(supabase, id, {
      name: body.name,
      subject: body.subject,
      htmlBody: body.htmlBody,
      segment: body.segment,
      scheduledAt: body.scheduledAt,
    });
    return NextResponse.json({ campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
