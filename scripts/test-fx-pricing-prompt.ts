#!/usr/bin/env tsx
/**
 * FX pricing prompt — regression tests
 * Run: npx tsx scripts/test-fx-pricing-prompt.ts
 */

import {
  buildLocalCurrencyFxPrompt,
  detectLocalCurrencyFocus,
  isLocalCurrencyQuestion,
} from '../lib/fx-pricing-prompt';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`);
}

const fx = {
  mxn_per_usd: 16.8991,
  cop_per_usd: 3126.08,
  source: 'live' as const,
  fetched_at: '2026-09-06T06:00:06.390Z',
};

assert(isLocalCurrencyQuestion('En pesos mexicanos'), 'detect MX pesos');
assert(isLocalCurrencyQuestion('es. en pesos colombianos'), 'detect CO pesos');
assert(isLocalCurrencyQuestion('a cuanto equivale en pesos'), 'detect equivale');
assert(isLocalCurrencyQuestion('tipo de cambio del dolar'), 'detect tipo de cambio');
assert(!isLocalCurrencyQuestion('cuanto cuesta'), 'generic price is not FX');
assert(!isLocalCurrencyQuestion('quiero la prueba gratis'), 'trial is not FX');

assert(detectLocalCurrencyFocus('En pesos mexicanos') === 'mxn', 'focus mxn from msg');
assert(detectLocalCurrencyFocus('en pesos colombianos') === 'cop', 'focus cop from msg');
assert(detectLocalCurrencyFocus('en pesos', 'México') === 'mxn', 'focus mxn from country');
assert(detectLocalCurrencyFocus('en pesos', 'Colombia') === 'cop', 'focus cop from country');
assert(detectLocalCurrencyFocus('en pesos') === 'both', 'focus both default');

const mxPrompt = buildLocalCurrencyFxPrompt(fx, {
  messageBody: 'En pesos mexicanos',
  country: 'México',
});
assert(mxPrompt.includes('16.90'), 'prompt has MXN rate');
assert(mxPrompt.includes('PRIORIZA MXN'), 'prompt prioritizes MXN');
assert(mxPrompt.includes('NUNCA inventes'), 'prompt forbids inventing');
assert(/\$659 MXN/.test(mxPrompt) || mxPrompt.includes('659'), 'Max ~659 MXN');

const copPrompt = buildLocalCurrencyFxPrompt(fx, {
  messageBody: 'en pesos colombianos',
  country: 'Colombia',
});
assert(copPrompt.includes('3126.08'), 'prompt has TRM');
assert(copPrompt.includes('PRIORIZA COP'), 'prompt prioritizes COP');
assert(copPrompt.includes('122') || copPrompt.includes('121'), 'Max ~122k COP');
assert(!copPrompt.includes('~4000'), 'no stale 4000 COP rate');

console.log('All fx-pricing-prompt tests passed.');
