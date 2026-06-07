import { checkCache } from '../lib/response-cache';
import type { ChatMessage } from '../lib/claude';

type Scenario = {
  name: string;
  message: string;
  history: ChatMessage[];
  expectHit: boolean;
  expectPattern?: string;
};

const scenarios: Scenario[] = [
  {
    name: 'saludo',
    message: 'hola',
    history: [{ role: 'user', content: 'hola' }],
    expectHit: true,
    expectPattern: 'saludo',
  },
  {
    name: 'precio_simple',
    message: 'cuanto cuesta?',
    history: [{ role: 'user', content: 'cuanto cuesta?' }],
    expectHit: true,
    expectPattern: 'precio_simple',
  },
  {
    name: 'complex miss',
    message:
      '¿cuál es la diferencia entre Plan Pro y Max para psicólogos que trabajan con adolescentes?',
    history: [
      {
        role: 'user',
        content:
          '¿cuál es la diferencia entre Plan Pro y Max para psicólogos que trabajan con adolescentes?',
      },
    ],
    expectHit: false,
  },
  {
    name: 'quick_3',
    message: '3',
    history: [
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: '¡Hola!' },
      { role: 'user', content: '3' },
    ],
    expectHit: true,
    expectPattern: 'quick_3',
  },
  {
    name: 'objection miss (routes to Sonnet separately)',
    message:
      'Tengo una objeción importante: el precio me parece muy caro comparado con la competencia',
    history: [
      {
        role: 'user',
        content:
          'Tengo una objeción importante: el precio me parece muy caro comparado con la competencia',
      },
    ],
    expectHit: false,
  },
];

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
  const result = checkCache(scenario.message, scenario.history);
  const hit = result !== null;
  const patternOk = scenario.expectPattern ? result?.pattern === scenario.expectPattern : true;
  const ok = hit === scenario.expectHit && patternOk;

  if (ok) {
    passed += 1;
    console.log(`✓ ${scenario.name}: ${hit ? `hit (${result?.pattern})` : 'miss'}`);
  } else {
    failed += 1;
    console.error(
      `✗ ${scenario.name}: expected ${scenario.expectHit ? `hit ${scenario.expectPattern ?? ''}` : 'miss'}, got ${hit ? result?.pattern : 'miss'}`,
    );
  }
}

console.log(`\n${passed}/${scenarios.length} passed`);
if (failed > 0) process.exit(1);
