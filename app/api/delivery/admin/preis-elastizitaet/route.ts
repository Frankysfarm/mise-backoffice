/**
 * GET /api/delivery/admin/preis-elastizitaet?location_id=<uuid>
 *
 * Phase 654 — Preis-Elastizitäts-Analyse-API
 * Analysiert welche Zonen/Tageszeiten sensitiv auf Liefergebühr-Änderungen reagieren.
 *
 * Response: { zonen: ZonenElastizitaet[], generiert_am: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface ZonenElastizitaet {
  zone: string;
  zeitfenster: string;
  bestellungen: number;
  avg_liefergebuehr: number;
  elastizitaet: 'niedrig' | 'mittel' | 'hoch';
  konversionsrate: number;
  empfehlung: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, created_at, delivery_fee, status, delivery_zone')
      .eq('location_id', locationId)
      .eq('order_type', 'delivery')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ zonen: [], generiert_am: new Date().toISOString() });
    }

    type BucketKey = string;
    const buckets = new Map<BucketKey, { bestellungen: number; gebuehren: number[]; stornos: number }>();

    for (const o of orders) {
      const zone = (o.delivery_zone as string | null) ?? 'Unbekannt';
      const stunde = new Date(o.created_at as string).getHours();
      const zeitfenster =
        stunde < 12 ? 'Vormittag (10–12)' :
        stunde < 15 ? 'Mittagszeit (12–15)' :
        stunde < 18 ? 'Nachmittag (15–18)' :
        'Abend (18–22)';

      const key = `${zone}::${zeitfenster}`;
      if (!buckets.has(key)) {
        buckets.set(key, { bestellungen: 0, gebuehren: [], stornos: 0 });
      }
      const b = buckets.get(key)!;
      b.bestellungen += 1;
      if (o.delivery_fee != null) b.gebuehren.push(o.delivery_fee as number);
      if (o.status === 'cancelled') b.stornos += 1;
    }

    const zonen: ZonenElastizitaet[] = [];

    for (const [key, b] of buckets.entries()) {
      const [zone, zeitfenster] = key.split('::');
      if (b.bestellungen < 3) continue;

      const avgGebuehr =
        b.gebuehren.length > 0
          ? b.gebuehren.reduce((s, v) => s + v, 0) / b.gebuehren.length
          : 0;

      const stornoPct = b.stornos / b.bestellungen;
      const konversionsrate = Math.round((1 - stornoPct) * 100);

      // Elastizität: hoch = teuer + viele Stornos, niedrig = günstig + wenig Stornos
      const elastizitaet: ZonenElastizitaet['elastizitaet'] =
        avgGebuehr > 3.5 && stornoPct > 0.15 ? 'hoch' :
        avgGebuehr > 2.0 || stornoPct > 0.08 ? 'mittel' : 'niedrig';

      const empfehlung =
        elastizitaet === 'hoch'
          ? 'Gebühr senken oder Gratisaktion prüfen'
          : elastizitaet === 'mittel'
          ? 'Gebühr beobachten, A/B-Test empfohlen'
          : 'Gebühr kann stabil bleiben';

      zonen.push({
        zone,
        zeitfenster,
        bestellungen: b.bestellungen,
        avg_liefergebuehr: Math.round(avgGebuehr * 100) / 100,
        elastizitaet,
        konversionsrate,
        empfehlung,
      });
    }

    zonen.sort((a, b) =>
      b.bestellungen - a.bestellungen ||
      (a.elastizitaet === 'hoch' ? -1 : a.elastizitaet === 'mittel' ? 0 : 1),
    );

    return NextResponse.json({ zonen, generiert_am: new Date().toISOString() });
  } catch (err) {
    console.error('[preis-elastizitaet]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
