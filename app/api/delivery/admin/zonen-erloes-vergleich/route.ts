import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface ZonenErloes {
  zone: string;
  lieferungen: number;
  liefergebuehr_gesamt: number;
  trinkgeld_gesamt: number;
  erloes_gesamt: number;
  erloes_pro_lieferung: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    const { data: batches, error } = await supabase
      .from('mise_delivery_batches')
      .select('id, zone, delivery_fee, tip_amount, stops_count')
      .eq('location_id', locationId)
      .eq('state', 'delivered')
      .gte('created_at', heute.toISOString());

    if (error) throw error;

    const zonenMap: Record<string, ZonenErloes> = {};

    for (const b of batches ?? []) {
      const zone = (b.zone as string | null) ?? 'Unbekannt';
      if (!zonenMap[zone]) {
        zonenMap[zone] = {
          zone,
          lieferungen: 0,
          liefergebuehr_gesamt: 0,
          trinkgeld_gesamt: 0,
          erloes_gesamt: 0,
          erloes_pro_lieferung: 0,
        };
      }
      const liefGebuehr = Number(b.delivery_fee ?? 0);
      const trinkgeld = Number(b.tip_amount ?? 0);
      zonenMap[zone].lieferungen += Number(b.stops_count ?? 1);
      zonenMap[zone].liefergebuehr_gesamt += liefGebuehr;
      zonenMap[zone].trinkgeld_gesamt += trinkgeld;
      zonenMap[zone].erloes_gesamt += liefGebuehr + trinkgeld;
    }

    const zonen = Object.values(zonenMap).map((z) => ({
      ...z,
      erloes_pro_lieferung: z.lieferungen > 0 ? +(z.erloes_gesamt / z.lieferungen).toFixed(2) : 0,
    })).sort((a, b) => b.erloes_pro_lieferung - a.erloes_pro_lieferung);

    return NextResponse.json({ zonen, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('[zonen-erloes-vergleich]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
