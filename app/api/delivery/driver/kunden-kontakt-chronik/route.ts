import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KontaktTyp = 'Anruf' | 'Nachricht' | 'Klingelton' | 'Nicht-Erreicht';

type KontaktEintrag = {
  id: string;
  typ: KontaktTyp;
  bestell_nr: string | null;
  kunden_name: string | null;
  adresse: string | null;
  zeitstempel: string;
  zeit_label: string;
};

type ApiResponse = {
  eintraege: KontaktEintrag[];
  gesamt_kontakte: number;
  nicht_erreicht_anzahl: number;
  driver_id: string;
  generiert_am: string;
};

const TYPEN: KontaktTyp[] = ['Anruf', 'Klingelton', 'Nachricht', 'Anruf', 'Nicht-Erreicht', 'Klingelton', 'Anruf', 'Nicht-Erreicht'];
const MOCK_NAMEN = ['Müller, A.', 'Schmidt, J.', 'Weber, K.', 'Fischer, T.', 'Bauer, L.', 'Hoffmann, M.', 'Klein, S.', 'Wolf, P.'];
const MOCK_ADRESSEN = ['Hauptstr. 12', 'Bahnhofstr. 5', 'Gartenweg 3', 'Lindenallee 8', 'Schulstr. 21', 'Kirchplatz 1', 'Rosenweg 7', 'Bergstr. 14'];

function zeitLabel(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m} Uhr`;
}

function mockData(driverId: string): ApiResponse {
  const now = Date.now();
  const eintraege: KontaktEintrag[] = TYPEN.map((typ, i) => {
    const ts = new Date(now - (i + 1) * 18 * 60000).toISOString();
    return {
      id: `mock-${i}`,
      typ,
      bestell_nr: `B-${String(1000 + i * 7).padStart(4, '0')}`,
      kunden_name: MOCK_NAMEN[i],
      adresse: MOCK_ADRESSEN[i],
      zeitstempel: ts,
      zeit_label: zeitLabel(ts),
    };
  });
  const nicht_erreicht = eintraege.filter(e => e.typ === 'Nicht-Erreicht').length;
  return { eintraege, gesamt_kontakte: eintraege.length, nicht_erreicht_anzahl: nicht_erreicht, driver_id: driverId, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const tagsBeginn = new Date();
    tagsBeginn.setUTCHours(0, 0, 0, 0);

    const { data: logs } = await supabase
      .from('driver_contact_log')
      .select('id, contact_type, order_id, customer_name, address, created_at')
      .eq('driver_id', driverId)
      .gte('created_at', tagsBeginn.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);

    if (!logs?.length) throw new Error('no logs');

    const eintraege: KontaktEintrag[] = logs.map(l => ({
      id: l.id as string,
      typ: (l.contact_type as KontaktTyp) ?? 'Anruf',
      bestell_nr: l.order_id as string | null,
      kunden_name: l.customer_name as string | null,
      adresse: l.address as string | null,
      zeitstempel: l.created_at as string,
      zeit_label: zeitLabel(l.created_at as string),
    }));

    const nicht_erreicht = eintraege.filter(e => e.typ === 'Nicht-Erreicht').length;

    return NextResponse.json({
      eintraege,
      gesamt_kontakte: eintraege.length,
      nicht_erreicht_anzahl: nicht_erreicht,
      driver_id: driverId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
