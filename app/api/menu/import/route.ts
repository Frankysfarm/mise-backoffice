import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  extractFromPhoto, extractFromText, extractFromVoice,
  type ExtractionResult,
} from '@/lib/menu/ai-extract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/menu/import
 *
 * Multipart/form-data:
 *   - mode: 'photo' | 'voice' | 'text'
 *   - file: image (photo) | audio (voice)
 *   - text: für mode='text'
 *
 * Returns: { items, detectedRestaurantName?, notes?, source }
 *
 * Schreibt NICHT in die DB. UI zeigt Preview, User klickt
 * „Übernehmen" → POST /api/menu/import/commit.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauth' }, { status: 401 });

  const { data: emp } = await sb
    .from('employees').select('tenant_id, location_id, rolle').eq('id', user.id).maybeSingle();
  if (!emp?.location_id) return NextResponse.json({ error: 'no location' }, { status: 403 });
  if (!['manager', 'backoffice', 'admin'].includes(emp.rolle ?? '')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const form = await req.formData();
  const mode = String(form.get('mode') ?? '');

  try {
    let result: ExtractionResult;

    if (mode === 'photo') {
      const file = form.get('file');
      if (!(file instanceof Blob)) return NextResponse.json({ error: 'no file' }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      const mediaType = inferMediaType((file as File).type, (file as File).name);
      result = await extractFromPhoto(buf.toString('base64'), mediaType);
    } else if (mode === 'voice') {
      const file = form.get('file');
      if (!(file instanceof Blob)) return NextResponse.json({ error: 'no file' }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      result = await extractFromVoice(buf);
    } else if (mode === 'text') {
      const text = String(form.get('text') ?? '');
      if (text.trim().length < 10) {
        return NextResponse.json({ error: 'Text zu kurz.' }, { status: 400 });
      }
      result = await extractFromText(text);
    } else {
      return NextResponse.json({ error: 'mode fehlt' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Extraction failed', detail: String(err) },
      { status: 502 },
    );
  }
}

function inferMediaType(
  mime: string,
  name: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  if (mime?.startsWith('image/jpeg') || /\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (mime?.startsWith('image/png') || /\.png$/i.test(name)) return 'image/png';
  if (mime?.startsWith('image/webp') || /\.webp$/i.test(name)) return 'image/webp';
  if (mime?.startsWith('image/gif') || /\.gif$/i.test(name)) return 'image/gif';
  return 'image/jpeg';
}
