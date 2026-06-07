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
  { input: 'CDMX', timezone: 'America/Mexico_City' },
  { input: 'Mexicali', timezone: 'America/Tijuana', label: 'hora Pacífico' },
  { input: 'Cancún', timezone: 'America/Cancun' },
  { input: 'bogota', timezone: 'America/Bogota' },
  { input: 'Madrid', timezone: 'Europe/Madrid', label: 'hora España' },
  { input: 'mexicalli', timezone: 'America/Tijuana' },
  { input: 'ciudad inexistente xyz', timezone: null },
  { input: 'bogotá', timezone: 'America/Bogota' },
  { input: 'Tijuana', timezone: 'America/Tijuana' },
  { input: 'Monterrey', timezone: 'America/Monterrey' },
  { input: 'Hermosillo', timezone: 'America/Hermosillo' },
  { input: 'Cali', timezone: 'America/Bogota' },
  { input: 'Lima', timezone: 'America/Lima' },
  { input: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires' },
  { input: 'Santiago', timezone: 'America/Santiago' },
  { input: 'New York', timezone: 'America/New_York' },
  { input: 'Los Angeles', timezone: 'America/Los_Angeles' },
  { input: 'São Paulo', timezone: 'America/Sao_Paulo' },
  { input: 'Londres', timezone: 'Europe/London' },
  { input: 'Tokio', timezone: 'Asia/Tokyo' },
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

console.log('─'.repeat(60));
console.log(`✓ All ${cases.length} city timezone tests passed`);
