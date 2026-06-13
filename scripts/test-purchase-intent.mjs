import { detectPurchaseIntent } from '../lib/purchase-intent-detector.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

console.log('Purchase intent detector tests\n');

// Plan Max
assert(detectPurchaseIntent('Me gustaría el plan max').intent === 'plan_max', '"Me gustaría el plan max" → plan_max');
assert(detectPurchaseIntent('Quiero el Max').intent === 'plan_max', '"Quiero el Max" → plan_max');
assert(detectPurchaseIntent('Me gustaría el plan max').plan === 'max', 'plan field = max');
assert(detectPurchaseIntent('quiero el plan max por favor').intent === 'plan_max', '"quiero el plan max por favor" → plan_max');
assert(detectPurchaseIntent('Dame el max').intent === 'plan_max', '"Dame el max" → plan_max');
assert(detectPurchaseIntent('necesito el max').intent === 'plan_max', '"necesito el max" → plan_max');

// Plan Pro
assert(detectPurchaseIntent('Quiero el plan Pro por favor').intent === 'plan_pro', '"Quiero el plan Pro por favor" → plan_pro');
assert(detectPurchaseIntent('El pro').intent === 'plan_pro', '"El pro" → plan_pro');
assert(detectPurchaseIntent('quiero el pro').intent === 'plan_pro', '"quiero el pro" → plan_pro');
assert(detectPurchaseIntent('Quiero el plan Pro por favor').plan === 'pro', 'plan field = pro');

// Pay now (generic)
assert(detectPurchaseIntent('Cómo pago?').intent === 'pay_now', '"Cómo pago?" → pay_now');
assert(detectPurchaseIntent('Dame el link de pago').intent === 'pay_now', '"Dame el link de pago" → pay_now');
assert(detectPurchaseIntent('quiero pagar').intent === 'pay_now', '"quiero pagar" → pay_now');
assert(detectPurchaseIntent('envíame el link').intent === 'pay_now', '"envíame el link" → pay_now');

// No intent (preguntas / info)
assert(detectPurchaseIntent('Hola, info').intent === null, '"Hola, info" → null');
assert(detectPurchaseIntent('Cuánto cuesta el max?').intent === null, '"Cuánto cuesta el max?" → null (pregunta, no intent)');
assert(detectPurchaseIntent('¿Qué diferencia hay entre pro y max?').intent === null, '"¿Qué diferencia...?" → null');
assert(detectPurchaseIntent('Me interesa conocer Kalyo').intent === null, '"Me interesa conocer Kalyo" → null');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
