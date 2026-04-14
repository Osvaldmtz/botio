'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdmin, setAdminCookie, clearAdminCookie } from '@/lib/admin-auth';

export async function loginAction(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const ok = setAdminCookie(password);
  if (!ok) {
    return { error: 'Invalid password' };
  }
  redirect('/admin');
}

export async function logoutAction() {
  clearAdminCookie();
  redirect('/admin');
}

export type CreateBotState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  botId?: string;
  webhookUrl?: string;
};

export async function createBotAction(
  _prev: CreateBotState,
  formData: FormData,
): Promise<CreateBotState> {
  if (!isAdmin()) {
    return { status: 'error', message: 'Unauthorized' };
  }

  const businessName = String(formData.get('business_name') ?? '').trim();
  const botName = String(formData.get('bot_name') ?? '').trim();
  const systemPrompt = String(formData.get('system_prompt') ?? '').trim();
  const twilioAccountSid = String(formData.get('twilio_account_sid') ?? '').trim();
  const twilioAuthToken = String(formData.get('twilio_auth_token') ?? '').trim();
  const twilioWhatsappNumber = String(formData.get('twilio_whatsapp_number') ?? '').trim();

  if (!businessName || !botName) {
    return {
      status: 'error',
      message: 'Business name and bot name are required',
    };
  }

  const supabase = createAdminClient();

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({ name: businessName, owner_id: null })
    .select('id')
    .single();

  if (businessError || !business) {
    console.error('[createBotAction] failed to insert business', businessError);
    return {
      status: 'error',
      message: `Failed to create business: ${businessError?.message ?? 'unknown error'}`,
    };
  }

  const { data: bot, error: botError } = await supabase
    .from('bots')
    .insert({
      business_id: business.id,
      name: botName,
      system_prompt: systemPrompt,
      twilio_account_sid: twilioAccountSid || null,
      twilio_auth_token: twilioAuthToken || null,
      twilio_whatsapp_number: twilioWhatsappNumber || null,
      is_active: true,
    })
    .select('id')
    .single();

  if (botError || !bot) {
    console.error('[createBotAction] failed to insert bot', botError);
    return {
      status: 'error',
      message: `Failed to create bot: ${botError?.message ?? 'unknown error'}`,
    };
  }

  const h = headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const webhookUrl = `${proto}://${host}/api/webhook/${bot.id}`;

  revalidatePath('/admin');

  return {
    status: 'success',
    message: `Bot "${botName}" created successfully`,
    botId: bot.id,
    webhookUrl,
  };
}
