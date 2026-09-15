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
  const { data: bookings, error } = await supabase
    .from('demo_bookings')
    .select('id, name, email, whatsapp, country, interest, scheduled_at')
    .is('google_event_id', null)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  if (!bookings?.length) {
    console.log('No upcoming bookings without google_event_id');
    return;
  }

  console.log(`Backfilling ${bookings.length} booking(s)...`);

  for (const booking of bookings) {
    const result = await createDemoBookingCalendarEvent({
      bookingId: booking.id,
      name: booking.name,
      email: booking.email,
      whatsapp: booking.whatsapp,
      country: booking.country,
      interest: booking.interest,
      scheduledAt: booking.scheduled_at,
    });
    console.log(`${booking.name} @ ${booking.scheduled_at}:`, result.ok ? result.eventId : result.error);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
