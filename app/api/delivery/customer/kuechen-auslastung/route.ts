import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Phase 1207 — Live-Küchen-Auslastungs-API
// GET /api/delivery/customer/kuechen-auslastung?location_id=<uuid>
// Ampel-Status (grün/gelb/rot) + Wartezeit-Schätzung für Storefront

type AuslastungsLevel = 'niedrig' | 'mittel' | 'hoch' | 'peak';

type ApiResponse = {
  level: AuslastungsLevel;
  ampel: 'gruen' | 'gelb' | 'rot';
  aktive_bestellungen: number;
  wartezeit_zusatz_min: number;
  wartezeit_text: string;
  location_id: string | null;
  generiert_am: string;
};

function levelFromCount(count: number): AuslastungsLevel {
  if (count <= 4) return 'niedrig';
  if (count <= 9) return 'mittel';
  if (count <= 15) return 'hoch';
  return 'peak';
}

function ampelFromLevel(level: AuslastungsLevel): ApiResponse['ampel'] {
  if (level === 'niedrig') return 'gruen';
  if (level === 'mittel') return 'gelb';
  return 'rot';
}

function wartezeitZusatz(level: AuslastungsLevel): number {
  const map: Record<AuslastungsLevel, number> = { niedrig: 0, mittel: 5, hoch: 12, peak: 20 };
  return map[level];
}

function wartezeitText(level: AuslastungsLevel, zusatz: number): string {
  if (level === 'niedrig') return 'Küche hat freie Kapazität — schnelle Zubereitung';
  if (level === 'mittel') return `Küche gut ausgelastet — ca. ${zusatz} Min Mehrwartzeit`;
  if (level === 'hoch') return `Küche stark ausgelastet — ca. ${zusatz} Min Mehrwartzeit`;
  return `Küche am Limit — ca. ${zusatz} Min Mehrwartzeit`;
}

function mockData(locationId: string | null): ApiResponse {
  const level: AuslastungsLevel = 'mittel';
  const zusatz = wartezeitZusatz(level);
  return {
    level,
    ampel: ampelFromLevel(level),
    aktive_bestellungen: 7,
    wartezeit_zusatz_min: zusatz,
    wartezeit_text: wartezeitText(level, zusatz),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();

    const { count } = await supabase
      .from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['neu', 'angenommen', 'in_zubereitung', 'preparing', 'in_progress']);

    const aktiv = count ?? 0;
    const level = levelFromCount(aktiv);
    const zusatz = wartezeitZusatz(level);

    return NextResponse.json({
      level,
      ampel: ampelFromLevel(level),
      aktive_bestellungen: aktiv,
      wartezeit_zusatz_min: zusatz,
      wartezeit_text: wartezeitText(level, zusatz),
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } as ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
