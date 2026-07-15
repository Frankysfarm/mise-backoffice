/**
 * GET /api/delivery/public/kuechen-status?location_id=<uuid>
 *
 * Phase 1756 (Backend) — Echtzeit-Küchen-Status
 * Öffentliche API: Aktive Bestelllast → Status frei/normal/beschaeftigt/sehr_beschaeftigt.
 * Supabase orders + Mock-Fallback. No auth required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KuechenStatus = 'frei' | 'normal' | 'beschaeftigt' | 'sehr_beschaeftigt';

interface KuechenStatusResponse {
  status: KuechenStatus;
  aktive_bestellungen: number;
  eta_aufschlag_min: number;
}

function statusFromCount(count: number): KuechenStatus {
  if (count <= 2) return 'frei';
  if (count <= 6) return 'normal';
  if (count <= 10) return 'beschaeftigt';
  return 'sehr_beschaeftigt';
}

function etaAufschlag(status: KuechenStatus): number {
  if (status === 'beschaeftigt') return 5;
  if (status === 'sehr_beschaeftigt') return 12;
  return 0;
}

function buildMock(locationId: string): KuechenStatusResponse {
  const seed = locationId?.charCodeAt(0) ?? 77;
  const count = 3 + (seed % 6);
  const status = statusFromCount(count);
  return { status, aktive_bestellungen: count, eta_aufschlag_min: etaAufschlag(status) };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    let q = (sb as any)
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['accepted', 'preparing', 'in_progress']);

    if (locationId !== 'all') q = q.eq('location_id', locationId);

    const { count, error } = await q;
    if (error) return NextResponse.json(buildMock(locationId));

    const aktiv = count ?? 0;
    const status = statusFromCount(aktiv);
    return NextResponse.json({
      status,
      aktive_bestellungen: aktiv,
      eta_aufschlag_min: etaAufschlag(status),
    } satisfies KuechenStatusResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
