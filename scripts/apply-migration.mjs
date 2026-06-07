#!/usr/bin/env node
/**
 * Apply a SQL migration file to the linked Supabase project.
 *
 * Auth (first match wins):
 *   SUPABASE_ACCESS_TOKEN — Management API (recommended; run `supabase login` once)
 *   SUPABASE_DB_PASSWORD  — direct Postgres via pooler IPv4
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile =
  process.argv[2] ?? path.join(__dirname, '../supabase/migrations/0005_conversation_followup.sql');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
const sql = fs.readFileSync(migrationFile, 'utf8');

async function viaManagementApi(token) {
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

async function viaPostgres(password) {
  const { default: pg } = await import('pg');
  const hosts = [
    `db.${projectRef}.supabase.co`,
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-us-west-1.pooler.supabase.com',
  ];
  let lastErr;
  for (const host of hosts) {
    const client = new pg.Client({
      host,
      port: host.includes('pooler') ? 6543 : 5432,
      database: 'postgres',
      user: host.includes('pooler') ? `postgres.${projectRef}` : 'postgres',
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });
    try {
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log(`Migration applied via Postgres (${host})`);
      return;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

try {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    await viaManagementApi(process.env.SUPABASE_ACCESS_TOKEN);
  } else if (process.env.SUPABASE_DB_PASSWORD) {
    await viaPostgres(process.env.SUPABASE_DB_PASSWORD);
  } else {
    console.error(
      'Set SUPABASE_ACCESS_TOKEN (supabase login) or SUPABASE_DB_PASSWORD to apply migrations.',
    );
    process.exit(2);
  }
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
}
