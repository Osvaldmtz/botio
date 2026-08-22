export const CONGRESO_MESSAGES = {
  welcome:
    '¡Qué gusto tenerte aquí! 🎉 Voy a activar tu Plan MAX gratis por 30 días. Solo necesito un par de datos rápidos.',
  askName: '¿Cuál es tu nombre completo?',
  askEmail: '¿Y tu correo electrónico?',
  invalidEmail: 'Ese correo no parece válido, ¿puedes revisarlo?',
  confirmed: (params: { name: string; email: string; password: string; url: string }) =>
    `Perfecto, ${params.name}. Tu Plan MAX de Kalyo está activo por 30 días 🚀

Estos son tus datos de acceso:
📧 Usuario: ${params.email}
🔑 Contraseña: ${params.password}
🔗 Ingresa aquí: ${params.url}

¡Bienvenido/a!`,
  alreadyActive: "Ya tienes tu Plan MAX activo. Si tienes dudas escribe 'ayuda'.",
};

/**
 * Onboarding drip (8 days). Day 1 credentials are sent free-form from the
 * handler at activation — cron skips day 1 and sends days 3–30 via HSM.
 *
 * HSM template (Twilio Content Template Builder → Spanish MX → UTILITY):
 *   Name: kalyo_congreso_onboarding
 *   Body: {{1}}, {{2}} Ingresa aquí: {{3}}
 *   {{1}} = name | {{2}} = message below | {{3}} = KALYO_APP_URL
 * Copy ContentSid → TWILIO_CONGRESO_ONBOARDING_CONTENT_SID after Meta approval.
 */
export const CONGRESO_ONBOARDING: Array<{ day: number; message: string }> = [
  {
    day: 1,
    message:
      'Bienvenido/a al Plan MAX. Configura tu perfil y empieza a aprovechar tu mes gratis.',
  },
  {
    day: 3,
    message:
      'es tu día 3 en Kalyo MAX 🚀 Hoy te compartimos la primera función clave que debes conocer.',
  },
  {
    day: 7,
    message:
      'llevas una semana en Kalyo MAX ✅ ¿Cómo vas? ¿Tienes alguna duda? Respóndeme aquí.',
  },
  {
    day: 12,
    message:
      '💡 Así es como otros usuarios están usando Kalyo MAX para crecer. ¿Ya lo intentaste?',
  },
  {
    day: 17,
    message:
      'ya vas por la mitad de tu Plan MAX ⚙️ Hoy: una función avanzada que pocos conocen.',
  },
  {
    day: 25,
    message:
      'te quedan 5 días de tu Plan MAX gratuito ⏳ Aprovecha todo antes de que termine.',
  },
  {
    day: 29,
    message:
      'mañana termina tu mes gratis en Kalyo MAX 🎯 Para no perder el acceso, renueva tu plan.',
  },
  {
    day: 30,
    message:
      'hoy termina tu Plan MAX gratuito 🙌 Fue un placer acompañarte. Gracias por ser parte del Congreso Kalyo.',
  },
];

export function getKalyoAppUrl(): string {
  return (process.env.KALYO_APP_URL ?? 'https://app.kalyo.io').replace(/\/$/, '');
}
