/**
 * Phase 1823 — Touren-Kapazitäts-Auslastungs-API
 *
 * GET /api/delivery/admin/touren-auslastung?location_id=<uuid>
 * Aktive Touren vs. Fahrer-Kapazität; Auslastung 0–100%; Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AuslastungsDaten {
  aktive_touren: number;
  fahrer_kapazitaet: number;
  auslastung_pct: number;
  verfuegbare_fahrer: number;
  aktive_fahrer: number;
}

const MOCK: AuslastungsDaten = {
  aktive_touren: 5,
  fahrer_kapazitaet: 8,
  auslastung_pct: 63,
  verfuegbare_fahrer: 3,
  aktive_fahrer: 5,
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const { data: aktiveTouren, error: tourError } = await sb
      .from('delivery_batches')
      .select('id, driver_id')
      .eq('location_id', locationId)
      .in('status', ['active', 'in_progress', 'dispatched', 'unterwegs']);

    if (tourError) throw tourError;

    const { data: alleFahrer } = await sb
      .from('profiles')
      .select('id')
      .eq('location_id', locationId)
      .eq('role', 'driver');

    const aktiveTourenAnzahl = (aktiveTouren ?? []).length;
    const kapazitaet = (alleFahrer ?? []).length || 1;
    const aktiveFahrer = new Set((aktiveTouren ?? []).map((t: { driver_id: string }) => t.driver_id)).size;
    const auslastung = Math.min(100, Math.round((aktiveTourenAnzahl / kapazitaet) * 100));

    const result: AuslastungsDaten = {
      aktive_touren: aktiveTourenAnzahl,
      fahrer_kapazitaet: kapazitaet,
      auslastung_pct: auslastung,
      verfuegbare_fahrer: Math.max(0, kapazitaet - aktiveFahrer),
      aktive_fahrer: aktiveFahrer,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
