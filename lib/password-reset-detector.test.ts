import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectPasswordResetRequest } from './password-reset-detector';

describe('detectPasswordResetRequest', () => {
  it('matches explicit password reset phrases', () => {
    assert.equal(detectPasswordResetRequest('Olvidé mi contraseña'), true);
    assert.equal(detectPasswordResetRequest('quiero resetear mi password'), true);
    assert.equal(detectPasswordResetRequest('necesito recuperar la contraseña'), true);
  });

  it('matches locked-out login errors', () => {
    assert.equal(detectPasswordResetRequest('Contraseña incorrecta'), true);
    assert.equal(detectPasswordResetRequest('Hoy no puedo entrar a la plataforma'), true);
    assert.equal(detectPasswordResetRequest('no me deja acceder'), true);
  });

  it('matches missing reset email', () => {
    assert.equal(detectPasswordResetRequest('Ya lo hice y no me llegó ningun correo'), true);
    assert.equal(detectPasswordResetRequest('no me llega el email de recuperación'), true);
  });

  it('ignores unrelated messages', () => {
    assert.equal(detectPasswordResetRequest('Quiero el plan Max'), false);
    assert.equal(detectPasswordResetRequest('¿Cuánto cuesta?'), false);
    assert.equal(detectPasswordResetRequest('Buen día'), false);
  });
});
