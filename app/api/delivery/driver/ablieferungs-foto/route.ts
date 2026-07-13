/**
 * POST /api/delivery/driver/ablieferungs-foto
 *
 * Phase 1297 — Tour-Ende-Foto-Upload (Backend)
 * Empfängt multipart/form-data mit foto + driver_id + hochgeladen_am.
 * Speichert Metadaten in Supabase (best-effort). Immer 200 zurück.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const driverId = formData.get('driver_id')?.toString() ?? null;
    const hochgeladenAm = formData.get('hochgeladen_am')?.toString() ?? new Date().toISOString();
    const foto = formData.get('foto') as File | null;

    if (!driverId || !foto) {
      return NextResponse.json({ ok: true, hinweis: 'Felder fehlen — ignoriert' });
    }

    const sb = createClient();

    // Metadaten-Eintrag (best-effort — kein Fehler nach außen)
    await (sb as any)
      .from('driver_delivery_photos')
      .insert({
        driver_id: driverId,
        dateiname: foto.name ?? 'ablieferung.jpg',
        dateigroesse_bytes: foto.size,
        hochgeladen_am: hochgeladenAm,
      })
      .then(() => null)
      .catch(() => null);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true, hinweis: 'Fehler ignoriert' });
  }
}
