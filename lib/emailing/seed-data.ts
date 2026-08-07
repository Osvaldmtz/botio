/** Stable seed rows — keep in sync with supabase/migrations/0054_emailing.sql */

function wrap(bodyTitle: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#10B981;padding:24px 32px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;">Kalyo</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 12px;font-size:24px;color:#18181B;">${bodyTitle}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="https://kalyo.io" style="display:inline-block;background:#10B981;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;">Ir a Kalyo</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const EMAIL_SEQUENCE_SEEDS = [
  {
    id: 'a0000001-0000-4000-8000-000000000001',
    name: 'Welcome',
    trigger_tag: 'trial-activo',
    cancel_on_tag: null as string | null,
    delay_days: 0,
    subject: 'Bienvenido a Kalyo',
    html_template: wrap(
      '¡Hola{{name}}!',
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3F3F46;">Bienvenido a tu trial de Kalyo. Estamos aquí para ayudarte a gestionar tu consulta clínica con menos fricción.</p>
       <p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">Empieza completando tu perfil — te guiaremos paso a paso.</p>`,
    ),
    active: true,
    sort_order: 1,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000002',
    name: 'Completa tu perfil',
    trigger_tag: 'trial-activo',
    cancel_on_tag: 'onboarding-paso-1',
    delay_days: 2,
    subject: 'Completa tu perfil en Kalyo',
    html_template: wrap(
      '{{name}}, completa tu perfil',
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">Tu perfil es la base de tu consulta en Kalyo. Toma 2 minutos y desbloquea el resto del onboarding.</p>`,
    ),
    active: true,
    sort_order: 2,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000003',
    name: 'Agrega un paciente',
    trigger_tag: 'trial-activo',
    cancel_on_tag: 'onboarding-paso-2',
    delay_days: 5,
    subject: 'Agrega tu primer paciente',
    html_template: wrap(
      'Siguiente paso: tu primer paciente',
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">{{name}}, agrega un paciente de prueba o real para ver cómo Kalyo organiza tu práctica clínica.</p>`,
    ),
    active: true,
    sort_order: 3,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000004',
    name: 'Agenda tu primera cita',
    trigger_tag: 'trial-activo',
    cancel_on_tag: 'onboarding-paso-3',
    delay_days: 7,
    subject: 'Agenda tu primera cita en Kalyo',
    html_template: wrap(
      'Agenda tu primera cita',
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">{{name}}, el calendario es el corazón de tu día a día. Agenda una cita y prueba el flujo completo.</p>`,
    ),
    active: true,
    sort_order: 4,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000005',
    name: '¡Conoce nuestros planes!',
    trigger_tag: 'onboarding-completo',
    cancel_on_tag: null,
    delay_days: 7,
    subject: 'Conoce los planes de Kalyo',
    html_template: wrap(
      'Ya completaste el onboarding',
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">{{name}}, exploraste lo esencial de Kalyo. Mira nuestros planes y elige el que mejor se adapte a tu consulta.</p>`,
    ),
    active: true,
    sort_order: 5,
  },
  {
    id: 'a0000001-0000-4000-8000-000000000006',
    name: 'Oferta especial 30%',
    trigger_tag: 'trial-expirado',
    cancel_on_tag: null,
    delay_days: 0,
    subject: 'Oferta especial: 30% en tu plan Kalyo',
    html_template: wrap(
      'Tu trial terminó — 30% de descuento',
      `<p style="margin:0;font-size:16px;line-height:1.6;color:#3F3F46;">{{name}}, no pierdas el impulso. Activa un plan con 30% de descuento por tiempo limitado.</p>`,
    ),
    active: true,
    sort_order: 6,
  },
] as const;
