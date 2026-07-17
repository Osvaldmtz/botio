import {
  parseAdminTrialPlanFromText,
  parseAdminTrialRequestFromMessages,
  parseAdminTrialRequestFromText,
  shouldInterceptAdminTrialActivation,
} from '../lib/admin-trial-parsing';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testCommaFormat(): void {
  const parsed = parseAdminTrialRequestFromText(
    'Activar trial: Paola Garcia, zapapinga24@gmail.com, +525532397848',
  );
  assert(parsed.fullName === 'Paola Garcia', 'name from comma format');
  assert(parsed.email === 'zapapinga24@gmail.com', 'email from comma format');
  assert(parsed.phone === '+525532397848', 'phone from comma format');
}

function testLabeledFormat(): void {
  const parsed = parseAdminTrialRequestFromText(
    'Activar trial para\nNombre: Psic. Clinica\nCorreo: zapapinga24@gmail.com\nWhatsapp: +525532397848',
  );
  assert(parsed.email === 'zapapinga24@gmail.com', 'labeled email');
  assert(parsed.phone === '+525532397848', 'labeled phone');
  assert(parsed.fullName === 'Psic. Clinica', 'labeled name');
}

function testPaolaFollowUp(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content:
        'Activar trial para\nNombre: Psic. Clinica\nCorreo: zapapinga24@gmail.com\nWhatsapp: +525532397848',
    },
    { role: 'assistant', content: '¿Nombre completo real?' },
    { role: 'user', content: 'Paola Garcia' },
  ]);
  assert(parsed !== null, 'follow-up should parse');
  assert(parsed!.fullName === 'Paola Garcia', 'follow-up name');
  assert(parsed!.email === 'zapapinga24@gmail.com', 'follow-up email');
  assert(parsed!.phone === '+525532397848', 'follow-up phone');
}

function testPlaceholderBlocksSingleTurn(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content:
        'Activar trial para\nNombre: Psic. Clinica\nCorreo: zapapinga24@gmail.com\nWhatsapp: +525532397848',
    },
  ]);
  assert(parsed === null, 'placeholder name alone should not activate');
}

function testCompleteNameSingleTurn(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content: 'Activar trial: Paola Garcia, zapapinga24@gmail.com, +525532397848',
    },
  ]);
  assert(parsed !== null, 'complete single turn');
  assert(parsed!.fullName === 'Paola Garcia', 'single turn name');
  assert(parsed!.trialPlan === 'max', 'default plan is max');
}

function testTrialMaxInCommand(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content: 'Activar trial Max: Paola Garcia, zapapinga24@gmail.com, +525532397848',
    },
  ]);
  assert(parsed !== null, 'max command parses');
  assert(parsed!.trialPlan === 'max', 'explicit max');
}

function testTrialProInCommand(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content: 'Activar trial Pro: Juan Pérez, juan@test.com, +5255512345678',
    },
  ]);
  assert(parsed !== null, 'pro command parses');
  assert(parsed!.trialPlan === 'pro', 'explicit pro');
}

function testTrialProLabeledFormat(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content:
        'Activar trial para\nPlan: Pro\nNombre: Juan Pérez\nCorreo: juan@test.com\nWhatsapp: +5255512345678',
    },
  ]);
  assert(parsed !== null, 'labeled pro parses');
  assert(parsed!.trialPlan === 'pro', 'labeled pro plan');
}

function testPlanParser(): void {
  assert(parseAdminTrialPlanFromText('Activar trial Pro: foo') === 'pro', 'pro prefix');
  assert(parseAdminTrialPlanFromText('Activar trial Max: foo') === 'max', 'max prefix');
  assert(parseAdminTrialPlanFromText('Activar trial: foo') === null, 'no plan');
}

function testMultilineFormat(): void {
  const parsed = parseAdminTrialRequestFromMessages([
    {
      role: 'user',
      content:
        'Activar trial Max para :\nyubiaestefany@gmail.com\nYubia Barragán López\n‪+52\u00a0492\u00a0161\u00a08527',
    },
  ]);
  assert(parsed !== null, 'multiline format should parse');
  assert(parsed!.email === 'yubiaestefany@gmail.com', 'multiline email');
  assert(parsed!.fullName === 'Yubia Barragán López', 'multiline name');
  assert(parsed!.phone === '+524921618527', 'multiline phone with nbsp');
  assert(parsed!.trialPlan === 'max', 'multiline max plan');
}

function testStaleHistoryDoesNotOverrideCompleteRequest(): void {
  const carlosMsg =
    'Activar trial Max para :\npsic.carlosfranco@gmail.com\nCarlos Franco\n+523511119898';
  const history = [
    {
      role: 'user',
      content:
        'Activar trial para\nNombre: Psic. Clinica\nCorreo: zapapinga24@gmail.com\nWhatsapp: +525532397848',
    },
    { role: 'assistant', content: '¿Nombre completo real?' },
    { role: 'user', content: 'Paola Garcia' },
    { role: 'assistant', content: 'ok' },
    {
      role: 'user',
      content:
        'Activar Plan PRO para \nNombre :Paola Garcia\n📧 zapapinga24@gmail.com\nWhatsapp +525532397848',
    },
    { role: 'assistant', content: 'ok' },
    {
      role: 'user',
      content:
        'Activar trial Max para :\nyubiaestefany@gmail.com\nYubia Barragán López\n‪+52\u00a0492\u00a0161\u00a08527',
    },
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: carlosMsg },
    { role: 'user', content: carlosMsg },
  ];
  const parsed = parseAdminTrialRequestFromMessages(history);
  assert(parsed !== null, 'Carlos request should parse');
  assert(parsed!.email === 'psic.carlosfranco@gmail.com', 'uses latest email, not stale Paola');
  assert(parsed!.fullName === 'Carlos Franco', 'uses latest name');
  assert(parsed!.phone === '+523511119898', 'uses latest phone');
}

function testFollowUpQuestionDoesNotIntercept(): void {
  const history = [
    {
      role: 'user',
      content:
        'Activar trial Max para :\npsic.carlosfranco@gmail.com\nCarlos Franco\n+523511119898',
    },
    { role: 'assistant', content: 'error' },
  ];
  assert(
    !shouldInterceptAdminTrialActivation('seguro que ya lo tuvo , cuando ?', history),
    'follow-up question should not re-trigger activation',
  );
}

console.log('Admin trial interceptor tests\n');
testCommaFormat();
console.log('  ✓ comma format');
testLabeledFormat();
console.log('  ✓ labeled format');
testPaolaFollowUp();
console.log('  ✓ Paola follow-up');
testPlaceholderBlocksSingleTurn();
console.log('  ✓ placeholder blocks single turn');
testCompleteNameSingleTurn();
console.log('  ✓ complete name single turn');
testTrialMaxInCommand();
console.log('  ✓ trial max in command');
testTrialProInCommand();
console.log('  ✓ trial pro in command');
testTrialProLabeledFormat();
console.log('  ✓ trial pro labeled format');
testMultilineFormat();
console.log('  ✓ multiline format');
testStaleHistoryDoesNotOverrideCompleteRequest();
console.log('  ✓ stale history does not override complete request');
testFollowUpQuestionDoesNotIntercept();
console.log('  ✓ follow-up question does not intercept');
testPlanParser();
console.log('  ✓ plan parser');
console.log('\nAll admin trial interceptor tests passed.');
