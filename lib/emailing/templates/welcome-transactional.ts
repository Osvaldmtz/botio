/**
 * Transactional welcome — Zylker-inspired solid brand hero.
 * Purple header, one dark CTA, one warm therapy image, minimal footer.
 */

export const WELCOME_TRANSACTIONAL_SUBJECT =
  'Tu cuenta de Kalyo ya está activa';

export const WELCOME_TRANSACTIONAL_FROM =
  'Sofía de Kalyo <hola@kalyo.io>';

/** Light logo for purple header */
export const KALYO_LOGO_URL = 'https://app.kalyo.io/logo-blanco.png';

/** Colored logo for light footer */
export const KALYO_LOGO_FOOTER_URL = 'https://app.kalyo.io/logo.png';

/** 3D smiley speech bubbles — Unsplash Premium (S-KyWiDHbH4) */
export const WELCOME_HERO_IMAGE_URL =
  'https://plus.unsplash.com/premium_photo-1682309676673-392c56015c5c?w=600&q=80&auto=format&fit=crop';

export const WELCOME_LOGIN_URL = 'https://app.kalyo.io/login';

/** Resend List-Unsubscribe headers (RFC 2369 + one-click RFC 8058). */
export const WELCOME_UNSUBSCRIBE_HEADERS = {
  'List-Unsubscribe':
    '<mailto:hola@kalyo.io?subject=Unsubscribe>, <https://app.kalyo.io/settings>',
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
} as const;

/**
 * HTML body. Uses {{name}} — personalizeTemplate prepends a space when set
 * so "…listo,{{name}}." → "…listo, Osvaldo."
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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">

          <!-- Purple brand hero -->
          <tr>
            <td align="center" style="background-color:#8C52FF;padding:40px 28px 36px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:0 0 28px 0;">
                    <img src="${KALYO_LOGO_URL}" width="112" alt="Kalyo" style="display:block;width:112px;max-width:112px;height:auto;border:0;">
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial, Helvetica, sans-serif;padding:0 0 12px 0;">
                    <h1 style="margin:0;font-size:36px;line-height:1.15;font-weight:700;color:#ffffff;letter-spacing:0.02em;text-transform:uppercase;">
                      ¡BIENVENIDO/A!
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial, Helvetica, sans-serif;padding:0 0 28px 0;">
                    <p style="margin:0;font-size:16px;line-height:1.5;color:#ffffff;">
                      Tu consultorio digital ya está listo,{{name}}.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${WELCOME_LOGIN_URL}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="12%" fillcolor="#1A1B2E">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;">IR A MI CONSULTORIO</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${WELCOME_LOGIN_URL}" target="_blank" rel="noopener" style="display:inline-block;background-color:#1A1B2E;color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:8px;line-height:1.2;letter-spacing:0.04em;text-transform:uppercase;">
                      IR A MI CONSULTORIO
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Therapy image below CTA -->
          <tr>
            <td align="center" style="padding:28px 24px 8px 24px;background-color:#ffffff;">
              <img src="${WELCOME_HERO_IMAGE_URL}" width="512" alt="Caritas felices compartiendo buenas palabras" style="display:block;width:100%;max-width:512px;height:auto;border:0;border-radius:10px;">
            </td>
          </tr>

          <!-- Minimal footer -->
          <tr>
            <td align="center" style="padding:28px 24px 32px 24px;background-color:#ffffff;font-family:Arial, Helvetica, sans-serif;">
              <img src="${KALYO_LOGO_FOOTER_URL}" width="72" alt="Kalyo" style="display:block;width:72px;max-width:72px;height:auto;border:0;margin:0 auto 12px auto;">
              <p style="margin:0 0 6px 0;font-size:13px;line-height:1.5;color:#5C6380;">
                <a href="mailto:hola@kalyo.io" style="color:#5C6380;text-decoration:underline;">hola@kalyo.io</a>
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
