/**
 * GET /api/delivery/admin/tour-sla-verletzung?location_id=<uuid>&sla_min=45
 *
 * Phase 751 — Tour-SLA-Verletzungs-API
 * Aktive Touren die den SLA (Standard 45 Min von Bestellung bis Lieferung) überschreiten.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const slaMinus = parseInt(url.searchParams.get('sla_min') ?? '45', 10);

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const slaGrenze = new Date(Date.now() - slaMinus * 60_000).toISOString();

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, created_at, orders_count, driver_id, status, employees!inner(vorname, nachname)')
    .eq('location_id', locationId)
    .in('status', ['assigned', 'in_progress', 'picked_up'])
    .lt('created_at', slaGrenze);

  const now = Date.now();
  const verletzungen = (batches ?? []).map((b) => {
    const startMs = new Date(b.created_at as string).getTime();
    const dauerMin = Math.floor((now - startMs) / 60_000);
    const emp = b.employees as { vorname: string; nachname: string } | null;
    return {
      batch_id: b.id,
      driver_name: emp ? `${emp.vorname} ${emp.nachname}` : 'Unbekannt',
      dauer_min: dauerMin,
      ueberzogen_min: dauerMin - slaMinus,
      stops: b.orders_count ?? 1,
      status: b.status,
    };
  }).sort((a, b) => b.ueberzogen_min - a.ueberzogen_min);

  return NextResponse.json({
    verletzungen,
    anzahl: verletzungen.length,
    sla_min: slaMinus,
  });
}
