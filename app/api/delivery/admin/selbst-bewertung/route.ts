/**
 * GET /api/delivery/admin/selbst-bewertung?location_id=...&date=YYYY-MM-DD
 *     → Alle Fahrer-Selbstbewertungen für einen Tag inkl. Statistik
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('employees')
    .select('id, location_id, role')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return data as { id: string; location_id: string; role: string } | null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const emp = await getEmployee(supabase);
    if (!emp) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('location_id') ?? emp.location_id;
    const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

    const svc = createServiceClient();

    // Fahrer-IDs der Location ermitteln
    const { data: drivers } = await svc
      .from('employees')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    if (!drivers?.length) {
      return NextResponse.json({ ok: true, entries: [], stats: null });
    }

    const driverIds = drivers.map(d => d.id);

    const { data: rows } = await svc
      .from('fahrer_selbst_bewertungen')
      .select('id, driver_id, schicht_datum, sterne, stimmung, kommentar, created_at')
      .in('driver_id', driverIds)
      .eq('schicht_datum', date)
      .order('created_at', { ascending: false });

    if (!rows?.length) {
      return NextResponse.json({ ok: true, entries: [], stats: null });
    }

    const driverMap = new Map(drivers.map(d => [d.id, d.full_name ?? 'Fahrer']));

    const entries = rows.map(r => ({
      id:            r.id,
      driver_id:     r.driver_id,
      driver_name:   driverMap.get(r.driver_id) ?? 'Fahrer',
      schicht_datum: r.schicht_datum,
      sterne:        r.sterne,
      stimmung:      r.stimmung ?? null,
      kommentar:     r.kommentar ?? null,
      created_at:    r.created_at,
    }));

    const avgSterne = entries.reduce((s, e) => s + e.sterne, 0) / entries.length;
    const stimmungen: Record<string, number> = {};
    for (const e of entries) {
      if (e.stimmung) stimmungen[e.stimmung] = (stimmungen[e.stimmung] ?? 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      entries,
      stats: {
        avgSterne: Math.round(avgSterne * 10) / 10,
        total:     entries.length,
        stimmungen,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
