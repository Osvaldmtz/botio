import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAskConfirmMessage,
  buildResendWelcomeMessage,
  handlePasswordResetWhatsApp,
  isFreshNeverSignedInAccount,
  type PasswordResetWhatsAppDeps,
} from './password-reset-whatsapp';
import { detectPasswordResetConfirm } from './password-reset-detector';

const PSYCH = {
  id: 'psych-1',
  auth_id: 'auth-1',
  email: 'jenny@example.com',
  full_name: 'Jenny Panfilo',
  phone: '+5217221022961',
};

function makeDeps(overrides: Partial<PasswordResetWhatsAppDeps> = {}) {
  const calls = {
    updatePassword: 0,
    updateMeta: [] as Record<string, unknown>[],
  };

  const deps: PasswordResetWhatsAppDeps = {
    findPsychologistByPhone: async () => PSYCH,
    findPsychologistByEmail: async () => PSYCH,
    getAuthSignInInfo: async () => ({
      created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      last_sign_in_at: null,
    }),
    findStoredWelcomeMessage: async () =>
      '¡Hola Jenny! Tu prueba gratis...\n🔑 Contraseña...\nKalyo2026ABCD',
    updatePassword: async () => {
      calls.updatePassword += 1;
      return { error: null };
    },
    updateConversationMetadata: async (_id, metadata) => {
      calls.updateMeta.push(metadata);
    },
    now: () => Date.now(),
    ...overrides,
  };

  return { deps, calls };
}

describe('isFreshNeverSignedInAccount', () => {
  it('is true when created <24h ago and never signed in', () => {
    const now = Date.parse('2026-11-23T02:00:00Z');
    assert.equal(
      isFreshNeverSignedInAccount(
        { created_at: '2026-11-23T01:00:00Z', last_sign_in_at: null },
        now,
      ),
      true,
    );
  });

  it('is false when last_sign_in_at is set', () => {
    const now = Date.parse('2026-11-23T02:00:00Z');
    assert.equal(
      isFreshNeverSignedInAccount(
        {
          created_at: '2026-11-23T01:00:00Z',
          last_sign_in_at: '2026-11-23T01:30:00Z',
        },
        now,
      ),
      false,
    );
  });

  it('is false when account is older than 24h', () => {
    const now = Date.parse('2026-11-24T03:00:00Z');
    assert.equal(
      isFreshNeverSignedInAccount(
        { created_at: '2026-11-23T01:00:00Z', last_sign_in_at: null },
        now,
      ),
      false,
    );
  });
});

describe('detectPasswordResetConfirm', () => {
  it('matches short affirmatives', () => {
    assert.equal(detectPasswordResetConfirm('sí'), true);
    assert.equal(detectPasswordResetConfirm('Si'), true);
    assert.equal(detectPasswordResetConfirm('manda nueva'), true);
    assert.equal(detectPasswordResetConfirm('envíame una nueva'), true);
  });

  it('ignores unrelated short messages', () => {
    assert.equal(detectPasswordResetConfirm('no gracias'), false);
    assert.equal(detectPasswordResetConfirm('¿cuánto cuesta?'), false);
  });
});

describe('handlePasswordResetWhatsApp', () => {
  const supabase = {} as never;

  it('fresh never-signed-in account: does not rotate and resends welcome', async () => {
    const { deps, calls } = makeDeps();
    const result = await handlePasswordResetWhatsApp({
      supabase,
      conversationId: 'conv-1',
      customerPhone: '+5217221022961',
      messageBody: 'No puedo entrar',
      metadata: {},
      deps,
    });

    assert.ok(result);
    assert.equal(result.reset, false);
    assert.equal(result.resentWelcome, true);
    assert.equal(calls.updatePassword, 0);
    assert.match(result.replyText, /no generé otra clave/i);
    assert.match(result.replyText, /Kalyo2026ABCD/);
    assert.match(result.replyText, /mode=forgot/);
  });

  it('account with prior login: asks confirm and does not rotate yet', async () => {
    const { deps, calls } = makeDeps({
      getAuthSignInInfo: async () => ({
        created_at: '2026-10-01T00:00:00Z',
        last_sign_in_at: '2026-11-20T00:00:00Z',
      }),
    });

    const result = await handlePasswordResetWhatsApp({
      supabase,
      conversationId: 'conv-1',
      customerPhone: '+5217221022961',
      messageBody: 'Olvidé mi contraseña',
      metadata: {},
      deps,
    });

    assert.ok(result);
    assert.equal(result.reset, false);
    assert.equal(result.pendingConfirm, true);
    assert.equal(calls.updatePassword, 0);
    assert.equal(calls.updateMeta[0]?.password_reset_pending_confirm, true);
    assert.match(result.replyText, /contraseña nueva/i);
  });

  it('rotates only after confirm when pending', async () => {
    const { deps, calls } = makeDeps({
      getAuthSignInInfo: async () => ({
        created_at: '2026-10-01T00:00:00Z',
        last_sign_in_at: '2026-11-20T00:00:00Z',
      }),
    });

    const result = await handlePasswordResetWhatsApp({
      supabase,
      conversationId: 'conv-1',
      customerPhone: '+5217221022961',
      messageBody: 'sí',
      metadata: {
        password_reset_pending_confirm: true,
        password_reset_pending_email: PSYCH.email,
      },
      deps,
    });

    assert.ok(result);
    assert.equal(result.reset, true);
    assert.equal(calls.updatePassword, 1);
    assert.equal(calls.updateMeta[0]?.password_reset_pending_confirm, false);
    assert.match(result.replyText, /Te reseté el acceso/);
  });

  it('ignores bare "sí" without pending confirm', async () => {
    const { deps, calls } = makeDeps();
    const result = await handlePasswordResetWhatsApp({
      supabase,
      conversationId: 'conv-1',
      customerPhone: '+5217221022961',
      messageBody: 'sí',
      metadata: {},
      deps,
    });
    assert.equal(result, null);
    assert.equal(calls.updatePassword, 0);
  });
});

describe('message builders', () => {
  it('ask confirm includes forgot link', () => {
    assert.match(buildAskConfirmMessage('a@b.com', 'Ana'), /mode=forgot/);
  });

  it('resend welcome falls back when body missing', () => {
    assert.match(buildResendWelcomeMessage(null, 'a@b.com'), /No encontré el mensaje/);
  });
});
