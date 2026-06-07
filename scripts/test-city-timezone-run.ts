import { cityToTimezone } from '../lib/city-to-timezone';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

type Case = {
  input: string;
  timezone: string | null;
  label?: string;
};

const cases: Case[] = [
  { input: 'Culiacan', timezone: 'America/Mazatlan' },
  { input: 'Culiacán', timezone: 'America/Mazatlan' },
  { input: 'Cancun', timezone: 'America/Cancun' },
  { input: 'Hermosillo', timezone: 'America/Hermosillo' },
  { input: 'Tijuana', timezone: 'America/Tijuana', label: 'hora Pacífico' },
  { input: 'Chihuahua', timezone: 'America/Chihuahua' },
  { input: 'Mérida', timezone: 'America/Mexico_City', label: 'hora CDMX' },
  { input: 'Monterrey', timezone: 'America/Monterrey' },
  { input: 'Matamoros', timezone: 'America/Monterrey' },
  { input: 'Reynosa', timezone: 'America/Monterrey' },
  { input: 'ciudad_inexistente_xyz', timezone: null },
  { input: 'Limaa', timezone: null },
  { input: 'Limaaaa', timezone: 'America/Lima' },
  { input: 'CDMX', timezone: 'America/Mexico_City' },
  { input: 'bogotá', timezone: 'America/Bogota' },
  { input: 'Madrid', timezone: 'Europe/Madrid', label: 'hora España' },
];

console.log('City timezone lookup tests\n');
console.log('input → timezone | label | confidence');
console.log('─'.repeat(60));

for (const c of cases) {
  const result = cityToTimezone(c.input);
  const tz = result?.timezone ?? null;
  const line = `${c.input} → ${tz ?? 'null'} | ${result?.label ?? '—'} | ${result?.confidence ?? '—'}`;
  console.log(line);

  assert(tz === c.timezone, `Expected ${c.input} → ${c.timezone}, got ${tz}`);
  if (c.label && result) {
    assert(result.label === c.label, `Expected label ${c.label}, got ${result.label}`);
  }
}

// Culiacan must NOT match Lima (regression)
const culiacan = cityToTimezone('Culiacan');
assert(culiacan?.timezone === 'America/Mazatlan', 'Culiacan must not match Lima');
console.log('✓ Culiacan does not false-match Lima');

console.log('─'.repeat(60));
console.log(`✓ All ${cases.length} city timezone tests passed`);
