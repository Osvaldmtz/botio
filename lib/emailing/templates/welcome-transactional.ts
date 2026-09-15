/**
 * Transactional welcome — purple Kalyo hero + pill CTA.
 */

export const WELCOME_TRANSACTIONAL_SUBJECT =
  'Tu cuenta de Kalyo ya está activa';

export const WELCOME_TRANSACTIONAL_FROM =
  'Sofía de Kalyo <hola@kalyo.io>';

/** Colored logo for light footer */
export const KALYO_LOGO_FOOTER_URL = 'https://app.kalyo.io/logo.png';

/** Hero — Drive export (centered, 480px) */
export const WELCOME_HERO_IMAGE_URL =
  'https://drive.google.com/uc?export=view&id=1RtqVNZl84sRfp-8sFX3OUsSLW__vpmTz';

export const WELCOME_LOGIN_URL = 'https://app.kalyo.io/login';

/** Resend List-Unsubscribe headers (RFC 2369 + one-click RFC 8058). */
export const WELCOME_UNSUBSCRIBE_HEADERS = {
  'List-Unsubscribe':
    '<mailto:hola@kalyo.io?subject=Unsubscribe>, <https://app.kalyo.io/settings>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
} as const;

/**
 * HTML body. Uses {{name}} — personalizeTemplate prepends a space when set
 * so "Bienvenido a Kalyo,{{name}}" → "Bienvenido a Kalyo, Osvaldo".
 */
export const WELCOME_TRANSACTIONAL_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="color-scheme" content="light only">
  <title>Tu cuenta de Kalyo ya está activa</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;width:100%;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">

          <!-- Purple brand hero -->
          <tr>
            <td align="center" style="background-color:#7B2FFF;padding:36px 28px 40px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 28px 0;">
                    <img src="${WELCOME_HERO_IMAGE_URL}" width="480" alt="Bienvenido a Kalyo" style="display:block;width:100%;max-width:480px;height:auto;border:0;border-radius:12px;">
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial, Helvetica, sans-serif;padding:0 0 14px 0;">
                    <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:700;color:#ffffff;">
                      Bienvenido a Kalyo,{{name}}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial, Helvetica, sans-serif;padding:0 8px 28px 8px;">
                    <p style="margin:0;font-size:15px;line-height:1.55;color:#e8d9ff;">
                      Estamos aquí para ayudarte a simplificar tu consulta y enfocarte en lo más importante: tus pacientes.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${WELCOME_LOGIN_URL}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" fillcolor="#c9a8ff">
                      <w:anchorlock/>
                      <center style="color:#3a006f;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Crear mi primer paciente &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${WELCOME_LOGIN_URL}" target="_blank" rel="noopener" style="display:inline-block;background-color:#c9a8ff;color:#3a006f;font-family:Arial, Helvetica, sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:50px;line-height:1.2;">
                      Crear mi primer paciente →
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Minimal white footer -->
          <tr>
            <td align="center" style="padding:28px 24px 32px 24px;background-color:#ffffff;font-family:Arial, Helvetica, sans-serif;">
              <img src="${KALYO_LOGO_FOOTER_URL}" width="88" alt="kalyo.io" style="display:block;width:88px;max-width:88px;height:auto;border:0;margin:0 auto 12px auto;">
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#5C6380;">
                <a href="mailto:hola@kalyo.io" style="color:#5C6380;text-decoration:none;">hola@kalyo.io</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9299B0;">
                © Kalyo
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
