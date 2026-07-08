/**
 * GET /api/delivery/admin/batch-rueckkehr-prognose?location_id=<uuid>
 *
 * Phase 666 (Backend) — Tour-Rückkehr-Prognose-API
 * Für jede aktive Tour: geschätzte Rückkehrzeit zur Basis.
 * Berechnung: verbleibende Stopps × Ø Min/Stopp (aus bisheriger Tour).
 *
 * Response: { ok, batches: BatchPrognose[], aktive_touren, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface BatchRow {
  id: string;
  driver_id: string | null;
  started_at: string | null;
  status: string;
  stop_count: number | null;
  completed_stops: number | null;
}

interface DriverRow {
  id: string;
  vorname: string | null;
  nachname: string | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: batches, error: batchErr } = await supabase
      .from('mise_delivery_batches')
      .select('id, driver_id, started_at, status, stop_count, completed_stops')
      .eq('location_id', locationId)
      .in('status', ['active', 'in_progress', 'gestartet'])
      .order('started_at', { ascending: false });

    if (batchErr) throw batchErr;

    if (!batches || batches.length === 0) {
      return NextResponse.json({ ok: true, batches: [], aktive_touren: 0, generatedAt: new Date().toISOString() });
    }

    const driverIds = [...new Set(batches.map((b) => b.driver_id as string).filter(Boolean))];

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, vorname, nachname')
      .in('id', driverIds);

    const driverMap = new Map<string, DriverRow>();
    for (const d of drivers ?? []) {
      driverMap.set(d.id, d as DriverRow);
    }

    const now = Date.now();
    const DEFAULT_MIN_PRO_STOPP = 7;

    const result = (batches as BatchRow[]).map((b) => {
      const d = driverMap.get(b.driver_id ?? '');
      const driverName = d
        ? `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer'
        : 'Fahrer';

      const gestartetVorMin = b.started_at
        ? Math.round((now - new Date(b.started_at).getTime()) / 60_000)
        : 0;

      const gesamtStopps = b.stop_count ?? 1;
      const erledigteStopps = Math.min(b.completed_stops ?? 0, gesamtStopps);
      const verbleibendeStopps = Math.max(0, gesamtStopps - erledigteStopps);

      const minProStoppAvg =
        erledigteStopps > 0 && gestartetVorMin > 0
          ? Math.round(gestartetVorMin / erledigteStopps)
          : DEFAULT_MIN_PRO_STOPP;

      const rueckkehrPrognoseMin = Math.round(verbleibendeStopps * Math.min(minProStoppAvg, 20) + 5);

      const status: 'unterwegs' | 'fast_fertig' | 'zurueck' =
        verbleibendeStopps === 0 ? 'zurueck' :
        verbleibendeStopps <= 1 ? 'fast_fertig' :
        'unterwegs';

      return {
        batch_id: b.id,
        driver_name: driverName,
        aktuelle_stopps_gesamt: gesamtStopps,
        erledigte_stopps: erledigteStopps,
        verbleibende_stopps: verbleibendeStopps,
        gestartet_vor_min: gestartetVorMin,
        min_pro_stopp_avg: minProStoppAvg,
        rueckkehr_prognose_min: rueckkehrPrognoseMin,
        status,
      };
    });

    result.sort((a, b) => a.rueckkehr_prognose_min - b.rueckkehr_prognose_min);

    return NextResponse.json({
      ok: true,
      batches: result,
      aktive_touren: result.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('batch-rueckkehr-prognose error:', err);
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 });
  }
}
