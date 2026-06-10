#!/usr/bin/env node
/**
 * Verify (and optionally apply) ambassador columns on Botio Supabase.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const migrationPath = path.join(__dirname, '../supabase/migrations/0023_ambassador_webinar_tracking.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

async function applyViaManagementApi(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  console.log('Migration applied via Management API');
}

async function verifyViaManagementApi(token) {
  const verifySql = `SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
AND column_name IN ('is_ambassador', 'webinar_link_sent_at', 'webinar_registered')
ORDER BY column_name;`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: verifySql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Verify query ${res.status}: ${body}`);
  return JSON.parse(body);
}

async function verifyViaRest() {
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb
    .from('conversations')
    .select('is_ambassador, webinar_link_sent_at, webinar_registered')
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

try {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) {
    await applyViaManagementApi(token);
    const rows = await verifyViaManagementApi(token);
    console.log('\ninformation_schema.columns:');
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log('SUPABASE_ACCESS_TOKEN not set — skipping DDL apply');
    const sample = await verifyViaRest();
    console.log('\nREST probe (columns readable):');
    console.log(JSON.stringify(sample, null, 2));
    if (!sample || !('is_ambassador' in sample)) {
      throw new Error('is_ambassador column not accessible');
    }
    console.log('\n✓ All 3 ambassador columns exist and are queryable via REST');
  }
} catch (err) {
  console.error('Migration verify failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
