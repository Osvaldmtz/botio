'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
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

export async function createBotAction(formData: FormData) {
  if (!isAdmin()) {
    return { error: 'Unauthorized' };
  }

  const businessName = String(formData.get('business_name') ?? '').trim();
  const botName = String(formData.get('bot_name') ?? '').trim();
  const systemPrompt = String(formData.get('system_prompt') ?? '').trim();
  const twilioAccountSid = String(formData.get('twilio_account_sid') ?? '').trim();
  const twilioAuthToken = String(formData.get('twilio_auth_token') ?? '').trim();
  const twilioWhatsappNumber = String(
    formData.get('twilio_whatsapp_number') ?? '',
  ).trim();

  if (!businessName || !botName) {
    return { error: 'Business name and bot name are required' };
  }

  const supabase = createAdminClient();

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .insert({ name: businessName, owner_id: null })
    .select('id')
    .single();

  if (businessError || !business) {
    return { error: `Failed to create business: ${businessError?.message}` };
  }

  const { error: botError } = await supabase.from('bots').insert({
    business_id: business.id,
    name: botName,
    system_prompt: systemPrompt,
    twilio_account_sid: twilioAccountSid || null,
    twilio_auth_token: twilioAuthToken || null,
    twilio_whatsapp_number: twilioWhatsappNumber || null,
    is_active: true,
  });

  if (botError) {
    return { error: `Failed to create bot: ${botError.message}` };
  }

  revalidatePath('/admin');
  return { success: true };
}
