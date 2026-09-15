/**
 * One-off: export congreso_trials to formatted Excel.
 * Usage: npx tsx scripts/generate-congreso-xlsx.ts [outputPath]
 */
import 'dotenv/config';
import { config } from 'dotenv';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

config({ path: path.join(process.cwd(), '.env.local') });

const DRIP_DAYS = [1, 3, 7, 12, 17, 25, 29, 30] as const;

type TrialRow = {
  name: string;
  email: string;
  customer_phone: string;
  activated_at: string;
  day_1_sent_at: string | null;
  day_3_sent_at: string | null;
  day_7_sent_at: string | null;
  day_12_sent_at: string | null;
  day_17_sent_at: string | null;
  day_25_sent_at: string | null;
  day_29_sent_at: string | null;
  day_30_sent_at: string | null;
};

function inferCountry(phone: string): { country: string; isColombia: boolean } {
  const p = phone.trim().toUpperCase();
  if (p.startsWith('+57') || p.startsWith('CO.')) {
    return { country: 'Colombia', isColombia: true };
  }
  if (p.startsWith('+51') || p.startsWith('PE.')) return { country: 'Perú', isColombia: false };
  if (p.startsWith('+591')) return { country: 'Bolivia', isColombia: false };
  if (p.startsWith('+58')) return { country: 'Venezuela', isColombia: false };
  if (p.startsWith('DO.')) return { country: 'República Dominicana', isColombia: false };
  if (p.startsWith('+1829') || p.startsWith('+1849') || p.startsWith('+1809')) {
    return { country: 'República Dominicana', isColombia: false };
  }
  if (p.startsWith('+1')) return { country: 'Estados Unidos / Canadá', isColombia: false };
  return { country: 'Desconocido', isColombia: false };
}

function formatPhoneE164(phone: string): string {
  const trimmed = phone.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function buildOnboardingStatus(row: TrialRow): string {
  const sent: number[] = [];
  const pending: number[] = [];
  for (const day of DRIP_DAYS) {
    const col = `day_${day}_sent_at` as keyof TrialRow;
    if (row[col]) sent.push(day);
    else pending.push(day);
  }
  const sentLabel = sent.length ? `Enviados: día ${sent.join(', ')}` : 'Sin envíos';
  const pendingLabel = pending.length ? `Pendientes: día ${pending.join(', ')}` : 'Drip completo';
  return `${sentLabel}. ${pendingLabel}.`;
}

function buildNotes(row: TrialRow, phone: string): string {
  const notes: string[] = [];
  if (/\.cc$/i.test(row.email)) {
    notes.push('Posible typo en email (.cc en lugar de .com)');
  }
  if (/^CO\.|^DO\.|^PE\./i.test(phone.trim())) {
    notes.push('Teléfono es ID de WhatsApp Click-to-WA; E.164 real no disponible en Botio');
  }
  if (row.email.endsWith('.ucp.edu.co')) {
    notes.push('Email institucional Colombia');
  }
  return notes.join('; ') || '';
}

function sortRows(rows: Array<TrialRow & { country: string; isColombia: boolean }>) {
  const countryOrder = [
    'Perú',
    'Bolivia',
    'Venezuela',
    'República Dominicana',
    'Estados Unidos / Canadá',
    'Desconocido',
  ];
  return rows.sort((a, b) => {
    if (a.isColombia !== b.isColombia) return a.isColombia ? -1 : 1;
    if (!a.isColombia && !b.isColombia) {
      const ai = countryOrder.indexOf(a.country);
      const bi = countryOrder.indexOf(b.country);
      if (ai !== bi) return ai - bi;
    }
    return a.name.localeCompare(b.name, 'es');
  });
}

async function main() {
  const outputPath =
    process.argv[2] || '/tmp/congreso_inscripciones_2026-07-31.xlsx';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from('congreso_trials')
    .select(
      'name, email, customer_phone, activated_at, day_1_sent_at, day_3_sent_at, day_7_sent_at, day_12_sent_at, day_17_sent_at, day_25_sent_at, day_29_sent_at, day_30_sent_at',
    )
    .neq('email', 'uncorreo@gmail.com')
    .order('activated_at');

  if (error) throw error;
  if (!data?.length) throw new Error('No congreso_trials rows found');

  const enriched = data.map((row) => {
    const { country, isColombia } = inferCountry(row.customer_phone);
    return { ...row, country, isColombia };
  });

  const sorted = sortRows(enriched);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Botio';
  wb.created = new Date();
  const ws = wb.addWorksheet('Inscripciones Congreso', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headers = [
    'Nombre completo',
    'Email',
    'Teléfono (E.164)',
    'País',
    'Fecha inscripción',
    'Estado onboarding',
    'Notas',
  ];

  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', wrapText: true };

  const colombiaFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };

  for (const row of sorted) {
    const phone = formatPhoneE164(row.customer_phone);
    const fecha = new Date(row.activated_at).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const excelRow = ws.addRow([
      row.name,
      row.email,
      phone,
      row.country,
      fecha,
      buildOnboardingStatus(row),
      buildNotes(row, phone),
    ]);
    if (row.isColombia) {
      excelRow.eachCell((cell) => {
        cell.fill = colombiaFill;
      });
    }
    excelRow.alignment = { vertical: 'top', wrapText: true };
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sorted.length + 1, column: headers.length },
  };

  ws.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = Math.min(len + 2, 60);
    });
    col.width = max;
  });

  await wb.xlsx.writeFile(outputPath);
  console.log(`Written ${sorted.length} rows → ${outputPath}`);
  console.log(
    `Colombia: ${sorted.filter((r) => r.isColombia).length} | Otros: ${sorted.filter((r) => !r.isColombia).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
