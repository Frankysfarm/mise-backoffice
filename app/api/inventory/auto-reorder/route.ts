import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { groupReorderProposals } from '@/lib/inventory/warehouse-plan';

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
    .select('id,name,artikelnummer,einheit,soll_bestand,min_bestand,letzte_inventur,preis_pro_einheit,nachbestell_menge,lieferant,supplier_id,shelf:inventory_shelves(name),area:inventory_areas(location_id)')
    .eq('aktiv', true);

  const allUnderMin = (items ?? []).filter((i: any) =>
    i.letzte_inventur === null || (i.min_bestand !== null && i.letzte_inventur < i.min_bestand)
  );
  // Artikel-Guard wie im Auto-Cron: Artikel, die schon in einem offenen Entwurf stecken, nicht doppelt vorschlagen
  const graceCutoff = Date.now() - 7 * 86_400_000;
  const { data: openOrders, error: openOrdersError } = await supabase.from('order_lists').select('positionen,status,geliefert_am,updated_at').in('status', ['entwurf', 'bestellt', 'geliefert']);
  if (openOrdersError) {
    return NextResponse.json({ error: 'Offene Bestellungen konnten nicht geprüft werden. Bitte erneut versuchen.' }, { status: 502 });
  }
  const relevantOrders = (openOrders ?? []).filter((o: any) =>
    o.status !== 'geliefert' || Date.parse(o.geliefert_am ?? o.updated_at ?? '') > graceCutoff, // geliefert: 7 Tage Schonfrist bis Einbuchen/Zählung
  );
  const inOpenDraft = new Set(relevantOrders.flatMap((o: any) => (Array.isArray(o.positionen) ? o.positionen : []).map((p: any) => String(p?.item_id ?? ''))));
  const underMin = allUnderMin.filter((i: any) => !inOpenDraft.has(String(i.id)));
  if (underMin.length === 0) {
    return NextResponse.json({ ok: true, message: allUnderMin.length === 0 ? 'Alles auf Lager — nichts zu bestellen.' : 'Alles Fehlende steckt bereits in offenen Bestellungen.', orders: [] });
  }

  if (underMin.length === 0) {
    return NextResponse.json({ ok: true, message: 'Alles auf Lager — nichts zu bestellen.', orders: [] });
  }

  const proposals = groupReorderProposals(underMin.map((item: any) => ({
    id: item.id,
    supplierId: item.supplier_id ?? null,
    supplierName: item.lieferant ?? null,
    locationId: item.area?.location_id ?? null,
    target: item.nachbestell_menge != null
      ? (item.letzte_inventur ?? 0) + item.nachbestell_menge
      : (item.soll_bestand ?? item.min_bestand ?? 1),
    current: item.letzte_inventur ?? 0,
  })));

  const createdOrders: string[] = [];

  for (const proposal of proposals) {
    const proposalItems = underMin.filter((item: any) => proposal.itemIds.includes(item.id));
    const positionen = proposalItems.map((i: any) => {
      const menge = i.nachbestell_menge
        ?? (i.soll_bestand != null ? Math.max(0, i.soll_bestand - (i.letzte_inventur ?? 0)) : i.min_bestand ?? 1);
      return {
        item_id: i.id,
        name: i.name,
        artikelnummer: i.artikelnummer,
        menge,
        einheit: i.einheit,
        preis_pro_einheit: i.preis_pro_einheit,
        lagerplatz: i.shelf?.name ?? null,
      };
    });

    const gesamtbetrag = positionen.reduce((s, p) => s + (p.menge * (p.preis_pro_einheit ?? 0)), 0);

    const { data: order, error } = await supabase.from('order_lists').insert({
      location_id: proposal.locationId,
      lieferant: proposal.supplierName,
      supplier_id: proposal.supplierId,
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
