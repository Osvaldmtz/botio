import { HAIKU_MODEL, SONNET_MODEL, selectModel } from '../lib/model-router';
import type { ChatMessage } from '../lib/claude';

type Scenario = {
  name: string;
  message: string;
  history: ChatMessage[];
  expectModel: string;
};

const shortHistory: ChatMessage[] = [{ role: 'user', content: 'placeholder' }];

const scenarios: Scenario[] = [
  {
    name: 'saludo → Haiku',
    message: 'hola',
    history: [{ role: 'user', content: 'hola' }],
    expectModel: HAIKU_MODEL,
  },
  {
    name: 'price objection → Sonnet',
    message: 'es muy caro para mí',
    history: shortHistory,
    expectModel: SONNET_MODEL,
  },
  {
    name: 'technical → Sonnet',
    message: '¿tienen API?',
    history: shortHistory,
    expectModel: SONNET_MODEL,
  },
  {
    name: 'short simple → Haiku',
    message: 'ok',
    history: shortHistory,
    expectModel: HAIKU_MODEL,
  },
  {
    name: 'competitor → Sonnet',
    message: 'estaba viendo heiko, ¿cuál es mejor?',
    history: shortHistory,
    expectModel: SONNET_MODEL,
  },
  {
    name: 'long message → Sonnet',
    message:
      'necesito un mensaje muy largo de más de 200 caracteres para validar que efectivamente se rutea a sonnet cuando la complejidad lo amerita por longitud y además quiero entender bien las diferencias entre planes',
    history: shortHistory,
    expectModel: SONNET_MODEL,
  },
];

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
  const { model, reason, complexity } = selectModel(scenario.message, scenario.history);
  const ok = model === scenario.expectModel;

  if (ok) {
    passed += 1;
    console.log(`✓ ${scenario.name}: ${model} (${complexity}) — ${reason}`);
  } else {
    failed += 1;
    console.error(
      `✗ ${scenario.name}: expected ${scenario.expectModel}, got ${model} (${reason})`,
    );
  }
}

console.log(`\n${passed}/${scenarios.length} passed`);
if (failed > 0) process.exit(1);
