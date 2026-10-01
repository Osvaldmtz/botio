import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale';
import {
  demoTimeZonePhrase,
  formatDemoTime12h,
  type DemoDisplayTimezone,
} from '@/lib/demo-reminder-messages';
import { DEMO_URL } from '@/lib/demo-booking-messages';

export const DEMO_EMAIL_FROM = 'Kalyo <hola@kalyo.io>';
export const KALYO_PRIMARY = '#7B2FFF';
export const KALYO_LOGO_URL = 'https://app.kalyo.io/logo.png';
export const DEMO_CANCEL_URL =
  'https://wa.me/15559374917?text=Quiero%20cancelar%20mi%20demo%20de%20Kalyo';

export type DemoEmailKind = 'confirmation' | 'reminder_24h' | 'reminder_1h';

export type DemoEmailContent = {
  kind: DemoEmailKind;
  name: string;
  scheduledAt: Date | string;
  meetLink: string;
  timezone: string;
  timezoneLabel: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clock(content: DemoEmailContent): { dateLabel: string; timeLabel: string } {
  const iso =
    content.scheduledAt instanceof Date ? content.scheduledAt.toISOString() : content.scheduledAt;
  const display: DemoDisplayTimezone = {
    timezone: content.timezone,
    label: content.timezoneLabel,
  };
  const rawDate = formatInTimeZone(new Date(iso), content.timezone, "EEEE d 'de' MMMM", {
    locale: es,
  });
  return {
    dateLabel: rawDate.charAt(0).toUpperCase() + rawDate.slice(1),
    timeLabel: `${formatDemoTime12h(iso, content.timezone)} (${demoTimeZonePhrase(display)})`,
  };
}

export function demoEmailSubject(content: DemoEmailContent): string {
  const { timeLabel } = clock(content);
  if (content.kind === 'reminder_24h') return `Recordatorio: demo mañana a las ${timeLabel}`;
  if (content.kind === 'reminder_1h') return 'Tu demo empieza en 1 hora';
  return 'Tu demo de Kalyo está agendada ✅';
}

function button(href: string, label: string, filled: boolean): string {
  const background = filled ? KALYO_PRIMARY : '#ffffff';
  const color = filled ? '#ffffff' : KALYO_PRIMARY;
  const border = filled ? KALYO_PRIMARY : KALYO_PRIMARY;
  return (
    `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" ` +
    `style="display:inline-block;background:${background};color:${color};border:2px solid ${border};` +
    `font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;` +
    `padding:14px 22px;border-radius:999px;margin:6px;">${escapeHtml(label)}</a>`
  );
}

export function renderDemoEmailHtml(content: DemoEmailContent): string {
  const { dateLabel, timeLabel } = clock(content);
  const name = escapeHtml(content.name.trim() || 'hola');
  const meet = content.meetLink.trim();
  const intro =
    content.kind === 'reminder_1h'
      ? 'Tu demo empieza en 1 hora. Da clic aquí para entrar.'
      : content.kind === 'reminder_24h'
        ? 'Nos vemos mañana. Aquí están los datos de tu demo.'
        : 'Tu demo con el equipo de Kalyo ya quedó agendada.';

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#F5F5F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
        <tr><td align="center" style="background:${KALYO_PRIMARY};padding:28px 24px;">
          <img src="${KALYO_LOGO_URL}" alt="Kalyo" width="120" style="display:block;border:0;height:auto;">
        </td></tr>
        <tr><td style="padding:28px 24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
          <p style="margin:0 0 12px;font-size:16px;">Hola ${name},</p>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">${intro}</p>
          <p style="margin:0 0 6px;font-size:16px;"><strong>${escapeHtml(dateLabel)}</strong></p>
          <p style="margin:0 0 18px;font-size:16px;">${escapeHtml(timeLabel)}</p>
          <p style="margin:0 0 20px;text-align:center;">${button(meet, 'Entrar a la demo', true)}</p>
          <p style="margin:0 0 8px;text-align:center;">
            ${button(DEMO_URL, 'Reagendar', false)}
            ${content.kind === 'reminder_1h' ? '' : button(DEMO_CANCEL_URL, 'Cancelar', false)}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type ChannelStatus = 'sent' | 'skipped' | 'failed';

export type DemoChannelDelivery = {
  email: ChannelStatus;
  whatsapp: ChannelStatus;
  emailError: string | null;
  whatsappError: string | null;
  alert: boolean;
};

export async function deliverDemoChannels(params: {
  email?: string | null;
  phone?: string | null;
  sendEmail?: () => Promise<void>;
  sendWhatsApp?: () => Promise<void>;
}): Promise<DemoChannelDelivery> {
  const hasEmail = Boolean(params.email?.trim()) && Boolean(params.sendEmail);
  const hasPhone = Boolean(params.phone?.trim()) && Boolean(params.sendWhatsApp);

  const emailResult = hasEmail
    ? params.sendEmail!().then(
        () => ({ status: 'sent' as const, error: null }),
        (err: unknown) => ({
          status: 'failed' as const,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    : Promise.resolve({ status: 'skipped' as const, error: null });

  const whatsappResult = hasPhone
    ? params.sendWhatsApp!().then(
        () => ({ status: 'sent' as const, error: null }),
        (err: unknown) => ({
          status: 'failed' as const,
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    : Promise.resolve({ status: 'skipped' as const, error: null });

  const [email, whatsapp] = await Promise.all([emailResult, whatsappResult]);
  const bothFailed = email.status === 'failed' && whatsapp.status === 'failed';
  const onlyChannelFailed =
    (email.status === 'failed' && whatsapp.status === 'skipped') ||
    (whatsapp.status === 'failed' && email.status === 'skipped');
  const whatsappFailed = whatsapp.status === 'failed';

  return {
    email: email.status,
    whatsapp: whatsapp.status,
    emailError: email.error,
    whatsappError: whatsapp.error,
    alert: whatsappFailed || bothFailed || onlyChannelFailed,
  };
}

export async function sendDemoEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('missing_resend');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DEMO_EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status}: ${body.slice(0, 240)}`);
  }
}
