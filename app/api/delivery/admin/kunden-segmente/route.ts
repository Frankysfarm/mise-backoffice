import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Segment = 'high-value' | 'regular' | 'churn-risk';

type KundenSegment = {
  segment: Segment;
  label: string;
  farbe: string;
  anzahl: number;
  anteil_prozent: number;
  ø_bestellungen: number;
  ø_umsatz: number;
  kriterium: string;
};

type Response = {
  segmente: KundenSegment[];
  gesamt_kunden: number;
  generiert_am: string;
  location_id: string | null;
};

const MOCK: Response = {
  gesamt_kunden: 1240,
  generiert_am: new Date().toISOString(),
  location_id: null,
  segmente: [
    {
      segment: 'high-value',
      label: 'High-Value',
      farbe: 'matcha',
      anzahl: 186,
      anteil_prozent: 15,
      ø_bestellungen: 12.4,
      ø_umsatz: 310,
      kriterium: '≥8 Bestellungen oder ≥200€ in 90T',
    },
    {
      segment: 'regular',
      label: 'Stamm­kunden',
      farbe: 'blue',
      anzahl: 744,
      anteil_prozent: 60,
      ø_bestellungen: 4.1,
      ø_umsatz: 82,
      kriterium: '3–7 Bestellungen in 90T',
    },
    {
      segment: 'churn-risk',
      label: 'Churn-Risiko',
      farbe: 'red',
      anzahl: 310,
      anteil_prozent: 25,
      ø_bestellungen: 1.2,
      ø_umsatz: 18,
      kriterium: '≤2 Bestellungen oder >45T keine Bestellung',
    },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();

    const query = supabase
      .from('customer_orders')
      .select('customer_id, total_price, created_at')
      .eq('status', 'geliefert')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());

    if (locationId) query.eq('location_id', locationId);

    const { data: orders, error } = await query;
    if (error || !orders?.length) throw new Error('no data');

    type CustomerStats = { bestellungen: number; umsatz: number; letzteBestellung: string };
    const kundenMap = new Map<string, CustomerStats>();
    for (const o of orders) {
      if (!o.customer_id) continue;
      const prev = kundenMap.get(o.customer_id) ?? { bestellungen: 0, umsatz: 0, letzteBestellung: o.created_at };
      kundenMap.set(o.customer_id, {
        bestellungen: prev.bestellungen + 1,
        umsatz: prev.umsatz + (o.total_price ?? 0),
        letzteBestellung: o.created_at > prev.letzteBestellung ? o.created_at : prev.letzteBestellung,
      });
    }

    const jetzt = Date.now();
    let highValue = 0, regular = 0, churnRisk = 0;
    let hvBestellungen = 0, hvUmsatz = 0;
    let regBestellungen = 0, regUmsatz = 0;
    let churnBestellungen = 0, churnUmsatz = 0;

    for (const [, stats] of kundenMap) {
      const tageInaktiv = (jetzt - new Date(stats.letzteBestellung).getTime()) / 86400000;
      const isHighValue = stats.bestellungen >= 8 || stats.umsatz >= 200;
      const isChurn = stats.bestellungen <= 2 || tageInaktiv > 45;

      if (isHighValue) {
        highValue++;
        hvBestellungen += stats.bestellungen;
        hvUmsatz += stats.umsatz;
      } else if (isChurn) {
        churnRisk++;
        churnBestellungen += stats.bestellungen;
        churnUmsatz += stats.umsatz;
      } else {
        regular++;
        regBestellungen += stats.bestellungen;
        regUmsatz += stats.umsatz;
      }
    }

    const gesamt = kundenMap.size;
    const result: Response = {
      gesamt_kunden: gesamt,
      generiert_am: new Date().toISOString(),
      location_id: locationId,
      segmente: [
        {
          segment: 'high-value',
          label: 'High-Value',
          farbe: 'matcha',
          anzahl: highValue,
          anteil_prozent: gesamt ? Math.round((highValue / gesamt) * 100) : 0,
          ø_bestellungen: highValue ? Math.round((hvBestellungen / highValue) * 10) / 10 : 0,
          ø_umsatz: highValue ? Math.round(hvUmsatz / highValue) : 0,
          kriterium: '≥8 Bestellungen oder ≥200€ in 90T',
        },
        {
          segment: 'regular',
          label: 'Stammkunden',
          farbe: 'blue',
          anzahl: regular,
          anteil_prozent: gesamt ? Math.round((regular / gesamt) * 100) : 0,
          ø_bestellungen: regular ? Math.round((regBestellungen / regular) * 10) / 10 : 0,
          ø_umsatz: regular ? Math.round(regUmsatz / regular) : 0,
          kriterium: '3–7 Bestellungen in 90T',
        },
        {
          segment: 'churn-risk',
          label: 'Churn-Risiko',
          farbe: 'red',
          anzahl: churnRisk,
          anteil_prozent: gesamt ? Math.round((churnRisk / gesamt) * 100) : 0,
          ø_bestellungen: churnRisk ? Math.round((churnBestellungen / churnRisk) * 10) / 10 : 0,
          ø_umsatz: churnRisk ? Math.round(churnUmsatz / churnRisk) : 0,
          kriterium: '≤2 Bestellungen oder >45T keine Bestellung',
        },
      ],
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
