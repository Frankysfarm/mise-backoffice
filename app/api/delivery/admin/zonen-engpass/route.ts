/**
 * GET /api/delivery/admin/zonen-engpass?location_id=<uuid>
 *
 * Phase 843 — Zonen-Engpass-Monitor
 * Zeigt offene Bestellungen ohne freien Fahrer je Zone (A/B/C/D).
 * Ampel: gruen = ausreichend Fahrer, amber = knapp, rot = Engpass.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();

  const [ordersRes, driversRes] = await Promise.all([
    sb
      .from('orders')
      .select('id, delivery_zone, status')
      .eq('location_id', locationId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .eq('lieferung', true),
    sb
      .from('employees')
      .select('id, delivery_zone')
      .eq('location_id', locationId)
      .eq('role', 'fahrer')
      .eq('ist_online', true),
  ]);

  const orders = ordersRes.data ?? [];
  const drivers = driversRes.data ?? [];

  const zones = ['A', 'B', 'C', 'D'];

  const zonen = zones.map(zone => {
    const offene_bestellungen = orders.filter(
      (o: any) => (o.delivery_zone ?? 'A') === zone
    ).length;
    const verfuegbare_fahrer = drivers.filter(
      (d: any) => (d.delivery_zone ?? 'A') === zone
    ).length;

    const ratio = verfuegbare_fahrer === 0 ? Infinity : offene_bestellungen / verfuegbare_fahrer;
    const ampel: 'gruen' | 'amber' | 'rot' =
      ratio <= 1 ? 'gruen' : ratio <= 2.5 ? 'amber' : 'rot';
    const engpass = ratio > 2.5 && offene_bestellungen > 0;

    return { zone, offene_bestellungen, verfuegbare_fahrer, ampel, engpass };
  });

  const gesamt_engpass = zonen.some(z => z.engpass);

  return NextResponse.json({ zonen, gesamt_engpass, generatedAt: new Date().toISOString() });
}
