import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

register('server-only', pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'mock-server-only.mjs')));

dotenv.config({ path: join(process.cwd(), '.env.local') });

async function main() {
  const {
    cancelDemoEvent,
    createDemoEvent,
    formatSlotsForBot,
    getAvailableSlots,
    getCalendarConnectionStatus,
  } = await import('../lib/google-calendar');

  console.log('\n=== 1. Verificar credenciales ===');
  const status = await getCalendarConnectionStatus();
  console.log(status);

  if (!status.connected) {
    console.error('\n❌ Calendar no conectado. Visita /admin/calendar-settings primero.');
    process.exit(1);
  }

  console.log('\n=== 2. Consultar disponibilidad (próximos 3 días) ===');
  const start = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
  const slots = await getAvailableSlots({ startDate: start, endDate: end });
  console.log(formatSlotsForBot(slots));

  if (slots.length === 0) {
    console.warn('\n⚠️ Sin slots — saltando creación de evento de prueba.');
    process.exit(0);
  }

  console.log('\n=== 3. Crear evento de prueba ===');
  const testSlot = slots[0];
  const created = await createDemoEvent({
    customerEmail: 'test@example.com',
    customerName: 'Botio Calendar Test',
    customerPhone: '+529990000000',
    scheduledAt: new Date(testSlot.start),
    botContext: {
      conversationId: '00000000-0000-0000-0000-000000000000',
      leadScore: 0,
      leadIntent: 'test',
      signals: ['calendar_flow_test'],
    },
  });
  console.log('Created:', created);

  console.log('\n=== 4. Cancelar evento de prueba ===');
  await cancelDemoEvent(created.demoId, 'test-calendar-flow cleanup');
  console.log('✅ Demo cancelada y evento eliminado');

  console.log('\n✅ Flujo completo OK');
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
