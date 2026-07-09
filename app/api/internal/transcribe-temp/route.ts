// Endpoint TEMPORAL de transcripción — Botio
//
// Uso: transcribir audios puntuales usando la OPENAI_API_KEY que ya existe
// en las env vars de Vercel para Botio. Protegido con un secreto compartido
// para que no quede abierto al público.
//
// BORRAR ESTE ARCHIVO cuando termines de usarlo — es temporal, no es parte
// del producto.
//
// Deploy: agregar este archivo al repo de Botio, agregar la env var
// TRANSCRIBE_TEMP_SECRET en Vercel (cualquier string largo aleatorio),
// y hacer git push a main como siempre.

import 'server-only';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro permite hasta 300s

export async function POST(request: Request) {
  const secret = request.headers.get('x-transcribe-secret');
  if (!secret || secret !== process.env.TRANSCRIBE_TEMP_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });
  }

  const incomingForm = await request.formData();
  const file = incomingForm.get('file');
  const language = (incomingForm.get('language') as string) || 'es';

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'falta el campo "file"' }, { status: 400 });
  }

  const openaiForm = new FormData();
  openaiForm.append('file', file, (file as File).name || 'audio.mp3');
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', language);
  openaiForm.append('response_format', 'text');

  const openaiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: openaiForm,
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text();
    return NextResponse.json({ error: 'openai_error', detail: errText }, { status: 502 });
  }

  const text = await openaiRes.text();
  return NextResponse.json({ text });
}
