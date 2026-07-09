/**
 * GET /api/delivery/admin/bestellwert-optimierung?location_id=<uuid>&cart_total=<number>
 *
 * Phase 1043 — Bestellwert-Optimierungs-API
 * Empfiehlt Zusatzartikel (Getränk/Dessert) wenn Warenkorb < Mindestbestellwert × 1.2.
 * Basiert auf Bestseller-Analyse der letzten 30 Tage.
 *
 * Response: { empfehlungen: Empfehlung[], min_order_eur, ziel_eur, fehlend_eur, location_id }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_ORDER_DEFAULT = 12;
const UPSELL_FAKTOR = 1.2;

interface Empfehlung {
  name: string;
  preis: number;
  kategorie: 'getraenk' | 'dessert' | 'snack';
  beliebtheit_rang: number;
  bild_url: string | null;
}

const MOCK_EMPFEHLUNGEN: Empfehlung[] = [
  { name: 'Cola 0,5L',         preis: 2.90, kategorie: 'getraenk', beliebtheit_rang: 1, bild_url: null },
  { name: 'Wasser 0,5L',       preis: 1.90, kategorie: 'getraenk', beliebtheit_rang: 2, bild_url: null },
  { name: 'Tiramisu',          preis: 4.50, kategorie: 'dessert',  beliebtheit_rang: 3, bild_url: null },
  { name: 'Brownie',           preis: 3.50, kategorie: 'dessert',  beliebtheit_rang: 4, bild_url: null },
  { name: 'Pommes Frites',     preis: 3.90, kategorie: 'snack',   beliebtheit_rang: 5, bild_url: null },
  { name: 'Onion Rings',       preis: 4.20, kategorie: 'snack',   beliebtheit_rang: 6, bild_url: null },
  { name: 'Eistee 0,5L',       preis: 2.50, kategorie: 'getraenk', beliebtheit_rang: 7, bild_url: null },
  { name: 'Schokomousse',      preis: 3.90, kategorie: 'dessert',  beliebtheit_rang: 8, bild_url: null },
];

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
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
  const url = new URL(req.url);
  const locationId = await resolveLocationId(req);
  const cartTotal = parseFloat(url.searchParams.get('cart_total') ?? '0') || 0;

  const minOrder = MIN_ORDER_DEFAULT;
  const zielEur = Math.round(minOrder * UPSELL_FAKTOR * 100) / 100;
  const fehlendEur = Math.max(0, Math.round((zielEur - cartTotal) * 100) / 100);

  if (fehlendEur <= 0) {
    return NextResponse.json({
      empfehlungen: [],
      min_order_eur: minOrder,
      ziel_eur: zielEur,
      fehlend_eur: 0,
      location_id: locationId,
    });
  }

  let empfehlungen: Empfehlung[] = [...MOCK_EMPFEHLUNGEN];

  if (locationId) {
    try {
      const sb = await createClient();
      const seit30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

      const { data: items } = await sb
        .from('order_items')
        .select('name, preis, menge')
        .eq('location_id', locationId)
        .gte('created_at', seit30d)
        .not('name', 'is', null);

      if (items && items.length > 0) {
        const counts: Record<string, { name: string; preis: number; count: number }> = {};
        for (const it of items) {
          const key = (it.name ?? '').toLowerCase();
          if (!counts[key]) counts[key] = { name: it.name ?? '', preis: Number(it.preis ?? 0), count: 0 };
          counts[key].count += Number(it.menge ?? 1);
        }
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
        const getränkeKw = /cola|wasser|saft|limonade|fanta|sprite|tee|kaffee|milch|shake|smoothie|juice|bier/i;
        const dessertKw = /kuchen|torte|eis|schokolad|mousse|brownie|tiramisu|muffin|dessert|nachtisch|pudding|panna/i;
        const snackKw = /pommes|fries|ring|nugget|stick|chip|cracke|zwiebelring/i;

        function kategorie(name: string): Empfehlung['kategorie'] {
          if (getränkeKw.test(name)) return 'getraenk';
          if (dessertKw.test(name)) return 'dessert';
          return 'snack';
        }

        const withKat = sorted
          .filter(i => getränkeKw.test(i.name) || dessertKw.test(i.name) || snackKw.test(i.name))
          .slice(0, 8)
          .map((i, idx) => ({
            name: i.name,
            preis: Math.round(i.preis * 100) / 100,
            kategorie: kategorie(i.name),
            beliebtheit_rang: idx + 1,
            bild_url: null,
          }));

        if (withKat.length >= 3) empfehlungen = withKat;
      }
    } catch {
      // Fall through to mock
    }
  }

  const filtered = empfehlungen.filter(e => e.preis <= fehlendEur + 5);
  const result = filtered.length >= 2 ? filtered : empfehlungen;

  return NextResponse.json({
    empfehlungen: result.slice(0, 4),
    min_order_eur: minOrder,
    ziel_eur: zielEur,
    fehlend_eur: fehlendEur,
    location_id: locationId,
  });
}
