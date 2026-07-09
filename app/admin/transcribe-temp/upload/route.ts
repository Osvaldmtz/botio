import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/mp4',
          'audio/m4a',
          'audio/aac',
          'audio/ogg',
          'audio/webm',
          'audio/*',
          'application/octet-stream',
        ],
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ purpose: 'transcribe-temp' }),
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[transcribe-temp/upload] completed', blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[transcribe-temp/upload] failed', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
