import 'server-only';
import { getKalyoClient } from '@/lib/kalyo-supabase';
import { normalizePhone } from '@/lib/phone';
import {
  buildPhoneLookupSuffixes,
  displayPatientName,
  formatPatientAck,
  formatPsychologistNotification,
  phonesEquivalent,
} from '@/lib/patient-inbound-utils';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/twilio';

type BotCredentials = {
  id?: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_whatsapp_number: string | null;
};

type PatientRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  psychologist_id: string | null;
};

export async function findPatientByPhone(senderPhone: string): Promise<PatientRow | null> {
  const suffixes = buildPhoneLookupSuffixes(senderPhone);
  if (suffixes.length === 0) return null;

  let kalyo;
  try {
    kalyo = getKalyoClient();
  } catch (error) {
    console.warn('[patient-inbound] Kalyo client unavailable', error);
    return null;
  }

  const orFilter = suffixes.map((suffix) => `phone.ilike.%${suffix}`).join(',');
  const { data, error } = await kalyo
    .from('patients')
    .select('id, full_name, phone, psychologist_id')
    .not('phone', 'is', null)
    .is('deleted_at', null)
    .or(orFilter)
    .limit(50);

  if (error) {
    console.error('[patient-inbound] patient lookup failed', error);
    return null;
  }

  const matches = (data ?? []).filter(
    (row): row is PatientRow =>
      typeof row.phone === 'string' && phonesEquivalent(senderPhone, row.phone),
  );

  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(
      `[patient-inbound] multiple patients matched phone suffixes | count=${matches.length}`,
    );
  }

  return matches[0];
}

async function logPatientInboundEvent(params: {
  botId?: string;
  patient: PatientRow;
  senderPhone: string;
  messageBody: string;
  psychologistNotified: boolean;
  psychologistPhone: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const preview =
      params.messageBody.length > 500
        ? `${params.messageBody.slice(0, 500)}…`
        : params.messageBody;

    await supabase.from('patient_inbound_events').insert({
      bot_id: params.botId ?? null,
      patient_phone: normalizePhone(params.senderPhone) ?? params.senderPhone,
      patient_id: params.patient.id,
      patient_name: displayPatientName(params.patient.full_name),
      psychologist_id: params.patient.psychologist_id,
      psychologist_phone: params.psychologistPhone,
      message_preview: preview,
      psychologist_notified: params.psychologistNotified,
    });
  } catch (error) {
    console.error('[patient-inbound] failed to log event', error);
  }
}

export async function tryHandlePatientInbound(params: {
  senderPhone: string;
  messageBody: string;
  bot: BotCredentials;
}): Promise<boolean> {
  const patient = await findPatientByPhone(params.senderPhone);
  if (!patient?.psychologist_id) return false;

  const patientName = displayPatientName(patient.full_name);
  const patientPhone = normalizePhone(params.senderPhone) ?? params.senderPhone;
  const patientReply = formatPatientAck(patientName);

  let psychologistPhone: string | null = null;
  try {
    const kalyo = getKalyoClient();
    const { data: psychologist, error } = await kalyo
      .from('psychologists')
      .select('phone')
      .eq('id', patient.psychologist_id)
      .maybeSingle();

    if (error) {
      console.error('[patient-inbound] psychologist lookup failed', error);
    } else if (typeof psychologist?.phone === 'string' && psychologist.phone.trim()) {
      psychologistPhone = psychologist.phone.trim();
    }
  } catch (error) {
    console.error('[patient-inbound] psychologist lookup error', error);
  }

  const {
    twilio_account_sid: accountSid,
    twilio_auth_token: authToken,
    twilio_whatsapp_number: from,
  } = params.bot;

  if (!accountSid || !authToken || !from) {
    console.error('[patient-inbound] bot missing Twilio credentials');
    return true;
  }

  if (psychologistPhone) {
    const psychologistReply = formatPsychologistNotification(
      patientName,
      params.messageBody,
      patientPhone,
    );

    try {
      await sendWhatsApp({
        accountSid,
        authToken,
        from,
        to: psychologistPhone,
        body: psychologistReply,
      });
    } catch (error) {
      console.error('[patient-inbound] failed to notify psychologist', error);
    }
  } else {
    console.warn(
      `[patient-inbound] psychologist ${patient.psychologist_id} has no phone; skipping notify`,
    );
  }

  try {
    await sendWhatsApp({
      accountSid,
      authToken,
      from,
      to: params.senderPhone,
      body: patientReply,
    });
  } catch (error) {
    console.error('[patient-inbound] failed to reply to patient', error);
  }

  console.log(
    `[patient-inbound] handled | patient=${patient.id} | psych=${patient.psychologist_id} | notified=${Boolean(psychologistPhone)}`,
  );

  void logPatientInboundEvent({
    botId: params.bot.id,
    patient,
    senderPhone: params.senderPhone,
    messageBody: params.messageBody,
    psychologistNotified: Boolean(psychologistPhone),
    psychologistPhone,
  });

  return true;
}
