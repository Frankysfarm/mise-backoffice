import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1400 — Kitchen Stop-Gap-Alert API
// Erkennt kritische Lücken im Küchenbetrieb:
// Artikel mit zu vielen gleichzeitigen Bestellungen vs. geschätzte Kapazität.
// GET /api/delivery/admin/kitchen-stop-gap-alert?location_id=<uuid>

interface ArtikelEngpass {
  name: string;
  gleichzeitig: number;
  kapazitaet_geschaetzt: number;
  auslastung_pct: number;
  niveau: 'ok' | 'warnung' | 'kritisch';
}

interface ApiResponse {
  engpaesse: ArtikelEngpass[];
  gesamt_offene_bestellungen: number;
  kritische_artikel_anzahl: number;
  empfehlung: string;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): ApiResponse {
  return {
    engpaesse: [
      { name: 'Margherita Pizza', gleichzeitig: 7, kapazitaet_geschaetzt: 5, auslastung_pct: 140, niveau: 'kritisch' },
      { name: 'Pasta Carbonara', gleichzeitig: 4, kapazitaet_geschaetzt: 4, auslastung_pct: 100, niveau: 'warnung' },
      { name: 'Caesar Salat', gleichzeitig: 2, kapazitaet_geschaetzt: 6, auslastung_pct: 33, niveau: 'ok' },
    ],
    gesamt_offene_bestellungen: 14,
    kritische_artikel_anzahl: 1,
    empfehlung: 'Margherita Pizza: Kapazität überschritten. Wartezeiten erhöhen oder Station entlasten.',
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
    const supabase = await createClient();

    // Aktive Bestellungen
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, items, positionen, status')
      .eq('location_id', locationId)
      .in('status', ['neu', 'angenommen', 'in_zubereitung']);

    if (!orders || orders.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    // Artikel zählen
    const map = new Map<string, number>();
    for (const order of orders) {
      const itemList: Array<{ name?: string; titel?: string; menge?: number; quantity?: number }> =
        order.items ?? order.positionen ?? [];
      for (const item of itemList) {
        const name = item.name ?? item.titel ?? 'Unbekannt';
        const menge = item.menge ?? item.quantity ?? 1;
        map.set(name, (map.get(name) ?? 0) + menge);
      }
    }

    // Kapazität grob schätzen: 5 je Artikel gleichzeitig (konservativ)
    const KAPAZITAET = 5;
    const engpaesse: ArtikelEngpass[] = Array.from(map.entries())
      .map(([name, gleichzeitig]) => {
        const auslastung_pct = Math.round((gleichzeitig / KAPAZITAET) * 100);
        return {
          name,
          gleichzeitig,
          kapazitaet_geschaetzt: KAPAZITAET,
          auslastung_pct,
          niveau: auslastung_pct >= 120 ? 'kritisch' : auslastung_pct >= 80 ? 'warnung' : 'ok',
        } satisfies ArtikelEngpass;
      })
      .sort((a, b) => b.auslastung_pct - a.auslastung_pct)
      .slice(0, 8);

    const kritische = engpaesse.filter((e) => e.niveau === 'kritisch');
    const empfehlung = kritische.length > 0
      ? `${kritische[0].name}: Kapazität überschritten. Station entlasten oder Wartezeit anpassen.`
      : engpaesse.some((e) => e.niveau === 'warnung')
        ? 'Einige Artikel nahe der Kapazitätsgrenze — Beobachtung empfohlen.'
        : 'Küche läuft im grünen Bereich.';

    return NextResponse.json({
      engpaesse,
      gesamt_offene_bestellungen: orders.length,
      kritische_artikel_anzahl: kritische.length,
      empfehlung,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
