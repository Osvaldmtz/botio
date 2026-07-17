import { applyAdminTrialActivationGuard } from '../lib/trial-activation-guard';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testUsesToolBotMessageVerbatim(): void {
  const botMessage =
    '✅ Trial Max activado para Ana\n\n📧 Email: ana@test.com\n🔑 Contraseña temporal: Kalyo-2026-ABCD';

  const result = applyAdminTrialActivationGuard({
    replyText: 'Listo, trial activado para Ana sin más detalles.',
    toolsCalled: ['admin_activate_trial_for_lead'],
    toolResults: {
      admin_activate_trial_for_lead: {
        status: 'success',
        bot_message: botMessage,
      },
    },
    conversationId: 'conv-1',
  });

  assert(result.guarded === true, 'guard should apply');
  assert(result.replyText === botMessage, 'must use bot_message verbatim');
}

function testBlocksHallucinatedActivation(): void {
  const result = applyAdminTrialActivationGuard({
    replyText:
      '✅ Trial Max activado para Claudia González\n\nEl mensaje de bienvenida ya fue enviado.',
    toolsCalled: [],
    toolResults: {},
    conversationId: 'conv-2',
  });

  assert(result.guarded === true, 'hallucination should be blocked');
  assert(
    result.replyText.includes('no se ejecutó la herramienta'),
    'blocked message explains missing tool',
  );
}

function testAllowsNormalReply(): void {
  const result = applyAdminTrialActivationGuard({
    replyText: 'Claro, ¿me pasas el email del psicólogo?',
    toolsCalled: [],
    toolResults: {},
    conversationId: 'conv-3',
  });

  assert(result.guarded === false, 'normal reply unchanged');
}

function testBlocksHallucinatedActivationWithPassword(): void {
  const result = applyAdminTrialActivationGuard({
    replyText:
      '✅ **Trial Max activado para Yubia**\n\n📧 Email: y@test.com\n🔑 Contraseña temporal: Kalyo-2026-KPQX',
    toolsCalled: [],
    toolResults: {},
    conversationId: 'conv-5',
  });

  assert(result.guarded === true, 'hallucination with fake password should be blocked');
  assert(
    result.replyText.includes('no se ejecutó la herramienta'),
    'blocked message explains missing tool',
  );
}

function testCreateAccountToolMessage(): void {
  const botMessage = '¡Listo! Tu cuenta está activa con contraseña Kalyo-2026-XYZ';
  const result = applyAdminTrialActivationGuard({
    replyText: 'paraphrased',
    toolsCalled: ['create_account_and_activate_trial'],
    toolResults: {
      create_account_and_activate_trial: { status: 'success', bot_message: botMessage },
    },
    conversationId: 'conv-4',
  });

  assert(result.replyText === botMessage, 'create_account tool bot_message used');
}

console.log('Trial activation guard tests\n');
testUsesToolBotMessageVerbatim();
console.log('  ✓ uses admin tool bot_message verbatim');
testBlocksHallucinatedActivation();
console.log('  ✓ blocks hallucinated activation');
testAllowsNormalReply();
console.log('  ✓ allows normal replies');
testBlocksHallucinatedActivationWithPassword();
console.log('  ✓ blocks hallucinated activation with fake password');
testCreateAccountToolMessage();
console.log('  ✓ uses create_account bot_message');

console.log('\nAll trial activation guard tests passed.');
