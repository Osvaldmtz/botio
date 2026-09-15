import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

register('server-only', pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'mock-server-only.mjs')));

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function main() {
  const { createDemoBookingCalendarEvent } = await import('../lib/demo-booking-calendar');
  const { createAdminClient } = await import('../lib/supabase/admin');

  const supabase = createAdminClient();
  const { data: booking, error } = await supabase
    .from('demo_bookings')
    .select('id, name, email, whatsapp, country, interest, scheduled_at, google_event_id')
    .is('google_event_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!booking) {
    console.log('No bookings without google_event_id');
    return;
  }

  console.log('Testing calendar for booking:', booking.id, booking.name, booking.scheduled_at);

  const result = await createDemoBookingCalendarEvent({
    bookingId: booking.id,
    name: booking.name,
    email: booking.email,
    whatsapp: booking.whatsapp,
    country: booking.country,
    interest: booking.interest,
    scheduledAt: booking.scheduled_at,
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
