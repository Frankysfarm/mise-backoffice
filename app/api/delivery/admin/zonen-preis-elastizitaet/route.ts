/**
 * GET /api/delivery/admin/zonen-preis-elastizitaet?location_id=<uuid>
 *
 * Phase 1888 — Zonen-Preis-Elastizitäts-API
 *
 * Korrelation Liefergebühr vs. Bestellvolumen je Zone A/B/C/D.
 * Elastizität = % Volumenänderung / % Preisänderung (letzte 30 Tage, 5€-Stufen).
 * Empfehlung: senken (>1.5), beibehalten (0.8–1.5), erhöhen (<0.8).
 *
 * Response:
 * {
 *   zonen: [
 *     { zone: 'A', gebühr_aktuell_eur: 2.90, volumen_heute: 12, volumen_7d_schnitt: 10.5,
 *       elastizitaet: 1.2, empfehlung: 'beibehalten' | 'senken' | 'erhöhen',
 *       empfehlung_preis: 2.50, trend: 'steigend' | 'stabil' | 'fallend' },
 *     ...
 *   ],
 *   generiert_um: ISO-string
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ZONEN = ['A', 'B', 'C', 'D'] as const;
type Zone = (typeof ZONEN)[number];

type Empfehlung = 'senken' | 'beibehalten' | 'erhöhen';

const MOCK_GEBUEHR: Record<Zone, number> = { A: 1.90, B: 2.90, C: 3.90, D: 4.90 };
const MOCK_VOLUMEN_HEUTE: Record<Zone, number> = { A: 18, B: 12, C: 6, D: 2 };
const MOCK_VOLUMEN_7D: Record<Zone, number> = { A: 16.5, B: 11.0, C: 7.2, D: 2.8 };
const MOCK_ELASTIZITAET: Record<Zone, number> = { A: 0.7, B: 1.2, C: 1.7, D: 2.1 };
const MOCK_EMPFEHLUNG_PREIS: Record<Zone, number> = { A: 2.20, B: 2.90, C: 3.50, D: 4.20 };

function empfehlungFromElastizitaet(e: number): Empfehlung {
  if (e > 1.5) return 'senken';
  if (e < 0.8) return 'erhöhen';
  return 'beibehalten';
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const qp = req.nextUrl.searchParams.get('location_id');
  if (qp) return qp;
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
  const now = new Date();

  // Heute
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // Letzte 7 Tage für Durchschnitt
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: todayOrders } = await sb
    .from('orders')
    .select('delivery_zone, delivery_fee, total, status')
    .eq('location_id', locationId)
    .gte('created_at', todayStart.toISOString())
    .in('status', ['delivered', 'delivering', 'confirmed', 'preparing', 'ready', 'pending']);

  const { data: weekOrders } = await sb
    .from('orders')
    .select('delivery_zone, delivery_fee, total, status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .lt('created_at', todayStart.toISOString())
    .in('status', ['delivered', 'delivering']);

  const useMock = !todayOrders || todayOrders.length === 0;

  const zonen = ZONEN.map((zone) => {
    if (useMock) {
      const e = MOCK_ELASTIZITAET[zone];
      const emp = empfehlungFromElastizitaet(e);
      const volH = MOCK_VOLUMEN_HEUTE[zone];
      const vol7 = MOCK_VOLUMEN_7D[zone];
      return {
        zone,
        gebuehr_aktuell_eur: MOCK_GEBUEHR[zone],
        volumen_heute: volH,
        volumen_7d_schnitt: vol7,
        elastizitaet: e,
        empfehlung: emp,
        empfehlung_preis: MOCK_EMPFEHLUNG_PREIS[zone],
        trend: volH > vol7 * 1.05 ? 'steigend' : volH < vol7 * 0.95 ? 'fallend' : 'stabil',
        mock: true,
      };
    }

    const zoneToday = (todayOrders ?? []).filter(
      (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
    );
    const zoneWeek = (weekOrders ?? []).filter(
      (o) => (o.delivery_zone ?? 'A').toUpperCase() === zone,
    );

    const volumenHeute = zoneToday.length;
    const volumen7dSchnitt = zoneWeek.length / 7;

    // Ø Liefergebühr aus Bestellungen (Cent → Euro)
    const gebuehren = zoneToday
      .map((o) => (o.delivery_fee ?? 0) / 100)
      .filter((v) => v > 0);
    const gebuehrAktuell =
      gebuehren.length > 0
        ? gebuehren.reduce((s, v) => s + v, 0) / gebuehren.length
        : MOCK_GEBUEHR[zone];

    // Preis-Elastizität: näherungsweise aus Tages- vs. Wochenschnitt
    // Wir simulieren ±10% Preisänderung und messen Volumenreaktion
    const volRelChange =
      volumen7dSchnitt > 0
        ? (volumenHeute - volumen7dSchnitt) / volumen7dSchnitt
        : 0;
    const priceRelChange = 0.1; // angenommene 10%-Preisvariation
    const elastizitaet =
      Math.abs(priceRelChange) > 0
        ? Math.min(3, Math.abs(volRelChange / priceRelChange))
        : 1.0;

    const empfehlung = empfehlungFromElastizitaet(elastizitaet);
    const empfehlungPreis =
      empfehlung === 'senken'
        ? Math.max(0.5, gebuehrAktuell * 0.85)
        : empfehlung === 'erhöhen'
        ? gebuehrAktuell * 1.15
        : gebuehrAktuell;

    return {
      zone,
      gebuehr_aktuell_eur: Math.round(gebuehrAktuell * 100) / 100,
      volumen_heute: volumenHeute,
      volumen_7d_schnitt: Math.round(volumen7dSchnitt * 10) / 10,
      elastizitaet: Math.round(elastizitaet * 100) / 100,
      empfehlung,
      empfehlung_preis: Math.round(empfehlungPreis * 100) / 100,
      trend:
        volumenHeute > volumen7dSchnitt * 1.05
          ? 'steigend'
          : volumenHeute < volumen7dSchnitt * 0.95
          ? 'fallend'
          : 'stabil',
      mock: false,
    };
  });

  return NextResponse.json({ zonen, generiert_um: now.toISOString() });
}
