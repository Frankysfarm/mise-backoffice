import { NextRequest, NextResponse } from 'next/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

function optionalText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > maxLength) throw new Error('Text ist zu lang');
  return text;
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Origin nicht erlaubt' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const employee = await requireManagerPlus();
  if (!employee.tenant_id) {
    return NextResponse.json({ error: 'Restaurant fehlt' }, { status: 403, headers: PRIVATE_HEADERS });
  }

  const body = await req.json().catch(() => null);
  try {
    const primary = optionalText(body?.primary, 7);
    const accent = optionalText(body?.accent, 7);
    const welcomeText = optionalText(body?.welcomeText, 160);
    const ctaLabel = optionalText(body?.ctaLabel, 48);
    if ((primary && !HEX_COLOR.test(primary)) || (accent && !HEX_COLOR.test(accent))) {
      return NextResponse.json({ error: 'Ungültige Farbe' }, { status: 400, headers: PRIVATE_HEADERS });
    }

    const svc = createServiceClient();
    const { data, error } = await svc
      .from('tenants')
      .update({
        qr_theme_primary: primary,
        qr_theme_accent: accent,
        qr_welcome_text: welcomeText,
        qr_cta_label: ctaLabel,
      })
      .eq('id', employee.tenant_id)
      .select('qr_theme_primary,qr_theme_accent,qr_welcome_text,qr_cta_label')
      .single();

    if (error || !data) {
      console.error('qr branding update failed', { code: error?.code ?? 'missing_result' });
      return NextResponse.json(
        { error: 'QR-Branding konnte nicht gespeichert werden' },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }

    return NextResponse.json({ ok: true, config: data }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ungültige Eingabe' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}
