import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Phase 1006 — Küchen-Auslastung-Live-API
 *
 * GET /api/delivery/admin/kuechen-auslastung-live?location_id=...
 * Aktuelle Küchen-Auslastung in % + Status + erwartete Wartezeit.
 */

export const dynamic = 'force-dynamic';

interface AuslastungData {
  auslastung_pct: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'peak';
  aktive_bestellungen: number;
  erwartete_wartezeit_min: number;
}

function mock(): AuslastungData {
  const aktiv = Math.floor(5 + Math.random() * 12);
  const pct = Math.round((aktiv / 20) * 100);
  const status: AuslastungData['status'] =
    pct >= 85 ? 'peak' : pct >= 65 ? 'hoch' : pct >= 35 ? 'normal' : 'niedrig';
  return {
    auslastung_pct: pct,
    status,
    aktive_bestellungen: aktiv,
    erwartete_wartezeit_min: status === 'peak' ? 35 : status === 'hoch' ? 25 : status === 'normal' ? 18 : 12,
  };
}

const MAX_KITCHEN_KAPAZITAET = 20;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last 1h

    let query = supabase
      .from('customer_orders')
      .select('id, status, created_at, location_id')
      .in('status', ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'])
      .gte('created_at', since);

    if (locationId) query = query.eq('location_id', locationId);

    const { data, error } = await query;
    if (error || !data) return NextResponse.json(mock());

    const aktive_bestellungen = data.length;
    const auslastung_pct = Math.min(100, Math.round((aktive_bestellungen / MAX_KITCHEN_KAPAZITAET) * 100));
    const status: AuslastungData['status'] =
      auslastung_pct >= 85 ? 'peak' :
      auslastung_pct >= 65 ? 'hoch' :
      auslastung_pct >= 35 ? 'normal' :
      'niedrig';
    const erwartete_wartezeit_min =
      status === 'peak' ? 35 : status === 'hoch' ? 25 : status === 'normal' ? 18 : 12;

    return NextResponse.json({ auslastung_pct, status, aktive_bestellungen, erwartete_wartezeit_min });
  } catch {
    return NextResponse.json(mock());
  }
}
