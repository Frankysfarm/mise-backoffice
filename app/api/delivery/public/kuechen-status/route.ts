/**
 * GET /api/delivery/public/kuechen-status?location_id=<uuid>
 *
 * Phase 1621 (Support) — Öffentlicher Küchenstatus-Ticker
 * Anzahl Bestellungen in Zubereitung + Auslastungsstufe (ruhig/normal/hochtouren/ueberlastet).
 * Kein Auth erforderlich (öffentlich). Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Auslastung = 'ruhig' | 'normal' | 'hochtouren' | 'ueberlastet';

function stufe(count: number): Auslastung {
  if (count === 0) return 'ruhig';
  if (count <= 3) return 'normal';
  if (count <= 7) return 'hochtouren';
  return 'ueberlastet';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const { data, error } = await (sb as any)
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['bestätigt', 'in_zubereitung', 'neu']);

    if (error) throw error;

    const count: number = (data as any)?.count ?? 0;
    return NextResponse.json({ in_zubereitung: count, auslastung: stufe(count) });
  } catch {
    const mock = Math.floor(Math.random() * 10);
    return NextResponse.json({ in_zubereitung: mock, auslastung: stufe(mock) });
  }
}
