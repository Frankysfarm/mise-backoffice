/**
 * GET /api/driver-app/tours?driver_id=...&batch_id=...
 *
 * Fahrer-facing Tour-Zusammenfassung nach Abschluss.
 * Liefert: Stopps, Km, Dauer, Pünktlichkeit, Trinkgeld, Score, Bonus-Vorschau.
 * Authentifizierung über driver_id + active-Check (kein Auth-Session benötigt).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDriverTourSummary } from '@/lib/delivery/tour-completion-analysis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  const batchId = searchParams.get('batch_id');

  if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });
  if (!batchId) return NextResponse.json({ error: 'batch_id fehlt' }, { status: 400 });

  // Fahrer-Existenz + aktiv prüfen
  const svc = createServiceClient();
  const { data: driver } = await svc
    .from('mise_drivers')
    .select('id, active')
    .eq('id', driverId)
    .eq('active', true)
    .maybeSingle();

  if (!driver) return NextResponse.json({ error: 'Fahrer nicht gefunden' }, { status: 404 });

  const summary = await getDriverTourSummary(batchId, driverId);
  if (!summary) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 });

  return NextResponse.json({ ok: true, summary });
}
