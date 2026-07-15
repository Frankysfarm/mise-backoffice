/**
 * GET /api/delivery/admin/schicht-uebergabe-cockpit?location_id=<uuid>
 *
 * Phase 1641 — Schicht-Übergabe-Daten-API mit Küchen-Auslastung
 * Offene Bestellungen + aktive Touren + letzter Fahrer-Status + Küchen-Auslastung.
 * Kombiniert schicht-uebergabe (Phase 1319) + kuechen-auslastung (Phase 1636).
 * Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  erstellt_um: string;
  zone: string | null;
}

interface AktiveTour {
  batch_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  gestartet_um: string;
}

interface FahrerStatus {
  id: string;
  name: string;
  ist_online: boolean;
  aktuelle_stopps: number;
  letzter_kontakt: string | null;
}

interface KuecheAuslastung {
  location_id: string;
  location_name: string;
  aktive_bestellungen: number;
  kapazitaetsgrenze: number;
  auslastungsgrad: number;
  eta_anpassungsfaktor: number;
  status: 'niedrig' | 'normal' | 'hoch' | 'kritisch';
}

interface SchichtUebergabeCockpit {
  offene_bestellungen: OffeneBestellung[];
  aktive_touren: AktiveTour[];
  fahrer_status: FahrerStatus[];
  kuechen_auslastung: KuecheAuslastung[];
  gesamt_offen: number;
  gesamt_touren: number;
  gesamt_fahrer_online: number;
  gesamt_auslastung: number;
  location_id: string;
  generiert_am: string;
}

function calcStatus(a: number): KuecheAuslastung['status'] {
  if (a >= 0.9) return 'kritisch';
  if (a >= 0.7) return 'hoch';
  if (a >= 0.4) return 'normal';
  return 'niedrig';
}

function calcEtaFaktor(a: number): number {
  if (a >= 0.9) return 1.5;
  if (a >= 0.7) return 1.25;
  if (a >= 0.4) return 1.0;
  return 0.9;
}

function buildMock(locationId: string): SchichtUebergabeCockpit {
  const kueche: KuecheAuslastung = {
    location_id: locationId,
    location_name: 'Küche Hauptstandort',
    aktive_bestellungen: 6,
    kapazitaetsgrenze: 10,
    auslastungsgrad: 0.6,
    eta_anpassungsfaktor: 1.0,
    status: 'normal',
  };

  return {
    offene_bestellungen: [
      { id: 'ord-1', bestellnummer: '#1042', status: 'in_zubereitung', erstellt_um: new Date(Date.now() - 18 * 60_000).toISOString(), zone: 'A' },
      { id: 'ord-2', bestellnummer: '#1043', status: 'bestätigt',      erstellt_um: new Date(Date.now() -  7 * 60_000).toISOString(), zone: 'B' },
      { id: 'ord-3', bestellnummer: '#1044', status: 'fertig',         erstellt_um: new Date(Date.now() - 25 * 60_000).toISOString(), zone: 'A' },
    ],
    aktive_touren: [
      { batch_id: 'bat-1', fahrer_name: 'Max M.',  stopps_gesamt: 4, stopps_abgeschlossen: 2, gestartet_um: new Date(Date.now() - 32 * 60_000).toISOString() },
      { batch_id: 'bat-2', fahrer_name: 'Lisa K.', stopps_gesamt: 3, stopps_abgeschlossen: 1, gestartet_um: new Date(Date.now() - 15 * 60_000).toISOString() },
    ],
    fahrer_status: [
      { id: 'drv-1', name: 'Max M.',  ist_online: true,  aktuelle_stopps: 2, letzter_kontakt: new Date(Date.now() - 2 * 60_000).toISOString() },
      { id: 'drv-2', name: 'Lisa K.', ist_online: true,  aktuelle_stopps: 1, letzter_kontakt: new Date(Date.now() - 1 * 60_000).toISOString() },
      { id: 'drv-3', name: 'Tom R.',  ist_online: false, aktuelle_stopps: 0, letzter_kontakt: new Date(Date.now() - 45 * 60_000).toISOString() },
    ],
    kuechen_auslastung: [kueche],
    gesamt_offen: 3,
    gesamt_touren: 2,
    gesamt_fahrer_online: 2,
    gesamt_auslastung: kueche.auslastungsgrad,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const [ordersRes, batchesRes, driversRes] = await Promise.all([
      (sb as any)
        .from('customer_orders')
        .select('id, bestellnummer, status, erstellt_um:bestellt_am, zone')
        .eq('location_id', locationId)
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
        .order('bestellt_am', { ascending: false })
        .limit(20),
      (sb as any)
        .from('delivery_batches')
        .select('id, gestartet_am, delivery_stops(id, geliefert_am, employees(vorname, nachname))')
        .eq('location_id', locationId)
        .is('abgeschlossen_am', null)
        .limit(10),
      (sb as any)
        .from('driver_status')
        .select('employee_id, ist_online, last_update, aktueller_batch_id, employees(vorname, nachname)')
        .eq('location_id', locationId)
        .limit(20),
    ]);

    if (ordersRes.error || batchesRes.error || driversRes.error) {
      return NextResponse.json(buildMock(locationId));
    }

    const offeneBestellungen: OffeneBestellung[] = (ordersRes.data ?? []).map((o: any) => ({
      id: o.id,
      bestellnummer: o.bestellnummer ?? `#${o.id.slice(0, 4)}`,
      status: o.status,
      erstellt_um: o.erstellt_um ?? new Date().toISOString(),
      zone: o.zone ?? null,
    }));

    const aktiveTouren: AktiveTour[] = (batchesRes.data ?? []).map((b: any) => {
      const stops = b.delivery_stops ?? [];
      const abg   = stops.filter((s: any) => !!s.geliefert_am).length;
      const emp   = stops[0]?.employees;
      const name  = emp ? `${emp.vorname ?? ''} ${emp.nachname ?? ''}`.trim() : 'Fahrer';
      return {
        batch_id: b.id,
        fahrer_name: name,
        stopps_gesamt: stops.length,
        stopps_abgeschlossen: abg,
        gestartet_um: b.gestartet_am ?? new Date().toISOString(),
      };
    });

    const fahrerStatus: FahrerStatus[] = (driversRes.data ?? []).map((d: any) => {
      const emp = d.employees;
      return {
        id: d.employee_id,
        name: emp ? `${emp.vorname ?? ''} ${emp.nachname ?? ''}`.trim() : 'Fahrer',
        ist_online: d.ist_online ?? false,
        aktuelle_stopps: 0,
        letzter_kontakt: d.last_update ?? null,
      };
    });

    const auslastung = offeneBestellungen.length / Math.max(10, offeneBestellungen.length + 4);
    const kuechenAuslastung: KuecheAuslastung[] = [{
      location_id: locationId,
      location_name: 'Aktuelle Küche',
      aktive_bestellungen: offeneBestellungen.length,
      kapazitaetsgrenze: 10,
      auslastungsgrad: auslastung,
      eta_anpassungsfaktor: calcEtaFaktor(auslastung),
      status: calcStatus(auslastung),
    }];

    const result: SchichtUebergabeCockpit = {
      offene_bestellungen: offeneBestellungen,
      aktive_touren: aktiveTouren,
      fahrer_status: fahrerStatus,
      kuechen_auslastung: kuechenAuslastung,
      gesamt_offen: offeneBestellungen.length,
      gesamt_touren: aktiveTouren.length,
      gesamt_fahrer_online: fahrerStatus.filter((f) => f.ist_online).length,
      gesamt_auslastung: auslastung,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
