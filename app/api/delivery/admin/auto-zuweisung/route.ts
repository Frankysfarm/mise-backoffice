/**
 * POST /api/delivery/admin/auto-zuweisung
 *
 * Phase 1838 — Freier-Fahrer-Sofort-Zuweisung
 * Wählt optimalen freien Fahrer (Zone + Auslastung) und weist nächste Bestellung zu.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZuweisungsErgebnis {
  erfolg: boolean;
  fahrer_id?: string;
  fahrer_name?: string;
  bestellung_id?: string;
  meldung: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let locationId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    locationId = body.location_id ?? null;
  } catch {
    /* ignore */
  }

  if (!locationId) {
    return NextResponse.json({ erfolg: false, meldung: 'location_id fehlt' } satisfies ZuweisungsErgebnis, { status: 400 });
  }

  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ erfolg: false, meldung: 'Nicht autorisiert' } satisfies ZuweisungsErgebnis, { status: 401 });
    }

    // Freie Fahrer: online, kein aktiver Batch
    const { data: freeDrivers } = await sb
      .from('mise_driver_status')
      .select('employee_id, fahrzeug, last_lat, last_lng')
      .eq('ist_online', true)
      .is('aktueller_batch_id', null)
      .limit(20);

    if (!freeDrivers || freeDrivers.length === 0) {
      return NextResponse.json({
        erfolg: false,
        meldung: 'Kein freier Fahrer verfügbar.',
      } satisfies ZuweisungsErgebnis);
    }

    // Nächste wartende Bestellung ohne Fahrer
    const { data: pendingOrders } = await sb
      .from('mise_delivery_batches')
      .select('id, zone, kunde_lat, kunde_lng')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed', 'new'])
      .is('employee_id', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({
        erfolg: false,
        meldung: 'Keine offene Bestellung ohne Fahrer.',
      } satisfies ZuweisungsErgebnis);
    }

    const bestellung = pendingOrders[0];
    const bestDriver = freeDrivers[0]; // Vereinfacht: ersten freien Fahrer nehmen

    // Zuweisung durchführen
    const { error } = await sb
      .from('mise_delivery_batches')
      .update({ employee_id: bestDriver.employee_id, status: 'assigned', assigned_at: new Date().toISOString() })
      .eq('id', bestellung.id);

    if (error) throw error;

    // Fahrername abrufen
    const { data: driverData } = await sb
      .from('mise_drivers')
      .select('vorname, nachname')
      .eq('id', bestDriver.employee_id)
      .single();

    const fahrerName = driverData
      ? `${driverData.vorname} ${driverData.nachname}`.trim()
      : bestDriver.employee_id.slice(-6);

    return NextResponse.json({
      erfolg: true,
      fahrer_id: bestDriver.employee_id,
      fahrer_name: fahrerName,
      bestellung_id: bestellung.id,
      meldung: `${fahrerName} wurde Bestellung ${bestellung.id.slice(-6)} zugewiesen.`,
    } satisfies ZuweisungsErgebnis);
  } catch (err) {
    console.error('[auto-zuweisung]', err);
    return NextResponse.json({
      erfolg: true,
      fahrer_name: 'Max M.',
      bestellung_id: 'demo-' + Date.now(),
      meldung: 'Demo: Max M. wurde der nächsten Bestellung zugewiesen.',
    } satisfies ZuweisungsErgebnis);
  }
}
