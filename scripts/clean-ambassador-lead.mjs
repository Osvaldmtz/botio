#!/usr/bin/env node
/**
 * Marca retroactivamente leads embajador contaminados (Ninja Mode + mensajes de campaña).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: join(root, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CUTOFF = '2026-06-10T14:00:00Z';

// "Ninja Mode" is a WhatsApp display name — not stored as customer_name on conversations.
// Match by embajador campaign messages after the bug window.
const { data: msgRows, error: msgError } = await supabase
  .from('messages')
  .select('conversation_id, content, created_at')
  .ilike('content', '%programa de embajadores%')
  .gt('created_at', CUTOFF);

if (msgError) {
  console.error('Messages query failed:', msgError.message);
  process.exit(1);
}

const ids = new Set((msgRows ?? []).map((r) => r.conversation_id));

console.log(`Found ${ids.size} conversation(s) to fix`);
for (const id of ids) {
  const msg = (msgRows ?? []).find((r) => r.conversation_id === id);
  console.log(`  - ${id} | msg=${msg?.content?.slice(0, 60) ?? '—'}`);
}

if (ids.size === 0) {
  console.log('No rows to update');
  process.exit(0);
}

let updated = 0;
for (const id of ids) {
  const { data: row } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', id)
    .maybeSingle();

  const metadata = {
    ...(row?.metadata ?? {}),
    is_ambassador_lead: true,
  };

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      is_ambassador: true,
      lead_score: null,
      lead_temperature: null,
      metadata,
    })
    .eq('id', id);

  if (updateError) {
    console.error(`Update failed for ${id}:`, updateError.message);
    process.exit(1);
  }
  updated += 1;
}

console.log(`\n✓ Updated ${updated} row(s)`);
