import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';

/**
 * POST /api/inventory/auto-reorder
 * Erstellt automatisch Bestelllisten für alle Produkte unter Mindestbestand,
 * gruppiert nach Lieferant. Gibt IDs der erstellten order_lists zurück.
 */
export async function POST(req: NextRequest) {
  const me = await requireManagerPlus();
  const supabase = await createClient();

  // Alle Items unter Minimum laden
  const { data: items } = await supabase.from('inventory_items')
    .select('id,name,artikelnummer,einheit,soll_bestand,min_bestand,letzte_inventur,preis_pro_einheit,nachbestell_menge,lieferant,supplier_id,area:inventory_areas(location_id)')
    .eq('aktiv', true);

  const underMin = (items ?? []).filter((i: any) =>
    i.letzte_inventur === null || (i.min_bestand !== null && i.letzte_inventur < i.min_bestand)
  );

  if (underMin.length === 0) {
    return NextResponse.json({ ok: true, message: 'Alles auf Lager — nichts zu bestellen.', orders: [] });
  }

  // Gruppiere nach supplier_id oder lieferant-Text
  const groups = new Map<string, { supplier_id: string | null; lieferant: string; location_id: string | null; items: any[] }>();
  for (const item of underMin) {
    const key = (item as any).supplier_id ?? (item as any).lieferant ?? 'Unbekannt';
    if (!groups.has(key)) {
      groups.set(key, {
        supplier_id: (item as any).supplier_id,
        lieferant: (item as any).lieferant ?? 'Unbekannt',
        location_id: (item as any).area?.location_id ?? null,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  const createdOrders: string[] = [];

  for (const [, group] of groups) {
    const positionen = group.items.map((i: any) => {
      const menge = i.nachbestell_menge
        ?? (i.soll_bestand != null ? Math.max(0, i.soll_bestand - (i.letzte_inventur ?? 0)) : i.min_bestand ?? 1);
      return {
        item_id: i.id,
        name: i.name,
        artikelnummer: i.artikelnummer,
        menge,
        einheit: i.einheit,
        preis_pro_einheit: i.preis_pro_einheit,
      };
    });

    const gesamtbetrag = positionen.reduce((s, p) => s + (p.menge * (p.preis_pro_einheit ?? 0)), 0);

    const { data: order, error } = await supabase.from('order_lists').insert({
      location_id: group.location_id,
      lieferant: group.lieferant,
      supplier_id: group.supplier_id,
      erstellt_von: me.id,
      positionen,
      gesamtbetrag: Math.round(gesamtbetrag * 100) / 100,
      status: 'entwurf',
    }).select('id').single();

    if (!error && order) createdOrders.push(order.id);
  }

  return NextResponse.json({
    ok: true,
    message: `${createdOrders.length} Bestellung(en) erstellt für ${underMin.length} Produkte.`,
    orders: createdOrders,
  });
}
