import 'server-only';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import {
  EMAIL_SEGMENTS,
  fetchSegmentContacts,
  isEmailSegmentId,
  listSegmentSummaries,
} from '@/lib/emailing/segments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const segment = searchParams.get('segment');
    const includeContacts = searchParams.get('contacts') === '1';

    if (segment) {
      if (!isEmailSegmentId(segment)) {
        return NextResponse.json({ error: 'Invalid segment' }, { status: 400 });
      }
      const contacts = await fetchSegmentContacts(segment);
      return NextResponse.json({
        segment,
        count: contacts.length,
        contacts: includeContacts ? contacts : undefined,
      });
    }

    const segments = await listSegmentSummaries();
    return NextResponse.json({
      segments,
      definitions: EMAIL_SEGMENTS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
