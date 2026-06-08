import { formatObjectionResponse } from '../lib/objection-responses';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertNotIncludes(text: string, fragment: string, label: string): void {
  assert(!text.includes(fragment), `${label}: should not include "${fragment}"`);
}

function runTests(): void {
  console.log('Objection name template tests\n');

  const noNameInitial = formatObjectionResponse('price', { name: null, isRepeat: false });
  assert(noNameInitial.startsWith('Entiendo, $29'), `no-name initial: got "${noNameInitial.slice(0, 30)}..."`);
  assertNotIncludes(noNameInitial, 'ahí', 'no-name initial');

  const withNameInitial = formatObjectionResponse('price', { name: 'Roberto', isRepeat: false });
  assert(
    withNameInitial.startsWith('Entiendo Roberto, $29'),
    `with-name initial: got "${withNameInitial.slice(0, 35)}..."`,
  );

  const noNameRepeat = formatObjectionResponse('price', { name: undefined, isRepeat: true });
  assert(
    noNameRepeat.startsWith('Entiendo. Te pongo'),
    `no-name repeat: got "${noNameRepeat.slice(0, 35)}..."`,
  );
  assertNotIncludes(noNameRepeat, 'ahí', 'no-name repeat');

  const withNameRepeat = formatObjectionResponse('price', { name: 'Roberto', isRepeat: true });
  assert(
    withNameRepeat.startsWith('Roberto, entiendo. Te pongo'),
    `with-name repeat: got "${withNameRepeat.slice(0, 40)}..."`,
  );

  const types = [
    'thinking',
    'competition',
    'no_time',
    'not_useful',
    'few_patients',
  ] as const;

  for (const type of types) {
    const initial = formatObjectionResponse(type, { name: null, isRepeat: false });
    const repeat = formatObjectionResponse(type, { name: null, isRepeat: true });
    assertNotIncludes(initial, 'ahí', `${type} initial`);
    assertNotIncludes(repeat, 'ahí', `${type} repeat`);
  }

  console.log('✓ All objection name template tests passed');
}

runTests();
