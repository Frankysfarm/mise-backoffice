import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1213 — Schichtende-Übernahme-Alert API
// Welche Fahrer haben in <60 Min Schichtende aber noch offene Touren?

type Kritikalitaet = 'niedrig' | 'warnung' | 'kritisch';

interface FahrerAlert {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  schichtende_in_min: number;
  offene_stopps: number;
  on_tour: boolean;
  kritikalitaet: Kritikalitaet;
  empfehlung: string;
}

function calcKrit(schichtendeInMin: number, offeneStopps: number, onTour: boolean): Kritikalitaet {
  if (!onTour || offeneStopps === 0) return 'niedrig';
  if (schichtendeInMin <= 30) return 'kritisch';
  if (schichtendeInMin <= 50) return 'warnung';
  return 'niedrig';
}

function buildEmpfehlung(schichtendeInMin: number, offeneStopps: number, onTour: boolean): string {
  if (!onTour || offeneStopps === 0) return 'Schichtende OK — kein aktiver Auftrag';
  if (schichtendeInMin <= 30) return `Sofort Ablösung einplanen — ${offeneStopps} Stopp${offeneStopps > 1 ? 's' : ''} verbleiben`;
  if (schichtendeInMin <= 50) return `Ablösung vorbereiten — ${offeneStopps} Stopp${offeneStopps > 1 ? 's' : ''} noch offen`;
  return `Schichtende in ${schichtendeInMin} Min — Beobachten`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const now = new Date();

  try {
    const supabase = await createClient();

    let driversQuery = supabase
      .from('mise_drivers')
      .select('id, employee:employees(vorname, nachname), online, on_tour, delivery_zone, shift_started_at')
      .eq('online', true);
    if (locationId) driversQuery = driversQuery.eq('location_id', locationId);
    const { data: drivers } = await driversQuery;

    if (!drivers || drivers.length === 0) {
      return NextResponse.json({ fahrer: [], gesamt_kritisch: 0, location_id: locationId, generiert_am: now.toISOString() });
    }

    const fahrerAlerts: FahrerAlert[] = [];

    for (const d of drivers) {
      // Schichtende-Schätzung: Annahme 8h Schicht
      if (!d.shift_started_at) continue;
      const shiftStart = new Date(d.shift_started_at);
      const shiftEnd = new Date(shiftStart.getTime() + 8 * 60 * 60_000);
      const schichtendeInMin = Math.round((shiftEnd.getTime() - now.getTime()) / 60_000);

      // Nur Fahrer die in <60 Min Schichtende haben
      if (schichtendeInMin > 60 || schichtendeInMin < 0) continue;

      // Offene Stopps zählen
      let offeneStopps = 0;
      if (d.on_tour) {
        const { count } = await supabase
          .from('mise_delivery_stops')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', d.id)
          .is('geliefert_am', null);
        offeneStopps = count ?? 0;
      }

      const emp = Array.isArray(d.employee) ? d.employee[0] : d.employee;
      const fahrerName = emp ? `${emp.vorname} ${emp.nachname}` : `Fahrer ${d.id.slice(-4)}`;
      const krit = calcKrit(schichtendeInMin, offeneStopps, d.on_tour ?? false);

      fahrerAlerts.push({
        fahrer_id: d.id,
        fahrer_name: fahrerName,
        zone: d.delivery_zone ?? null,
        schichtende_in_min: schichtendeInMin,
        offene_stopps: offeneStopps,
        on_tour: d.on_tour ?? false,
        kritikalitaet: krit,
        empfehlung: buildEmpfehlung(schichtendeInMin, offeneStopps, d.on_tour ?? false),
      });
    }

    // Sortiere: kritisch zuerst
    fahrerAlerts.sort((a, b) => {
      const order = { kritisch: 0, warnung: 1, niedrig: 2 };
      return order[a.kritikalitaet] - order[b.kritikalitaet];
    });

    return NextResponse.json({
      fahrer: fahrerAlerts,
      gesamt_kritisch: fahrerAlerts.filter(f => f.kritikalitaet === 'kritisch').length,
      location_id: locationId,
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json({ fahrer: [], gesamt_kritisch: 0, location_id: locationId, generiert_am: now.toISOString() });
  }
}
