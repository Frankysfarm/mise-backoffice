/**
 * GET /api/delivery/admin/tages-kosten?location_id=<uuid>
 *
 * Phase 1656 — Tages-Kosten-Hochrechnung-API
 * Materialkosten-Summe + Budget-Limit + Auslastungsgrad + Stunden-Breakdown.
 * Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StundeBreakdown {
  stunde: number;
  kosten_eur: number;
  bestellungen: number;
}

interface TagesKostenResponse {
  materialkosten_summe_eur: number;
  budget_limit_eur: number;
  auslastungsgrad_pct: number;
  ampel: 'normal' | 'achtung' | 'kritisch';
  stunden_breakdown: StundeBreakdown[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

const MATERIAL_RATIO = 0.30;
const DEFAULT_BUDGET = 500;

function calcAmpel(pct: number): TagesKostenResponse['ampel'] {
  if (pct < 70) return 'normal';
  if (pct < 90) return 'achtung';
  return 'kritisch';
}

function buildMock(locationId: string): TagesKostenResponse {
  const now = new Date();
  const currentH = now.getUTCHours();
  const stunden_breakdown: StundeBreakdown[] = Array.from({ length: 24 }, (_, h) => {
    const active = h >= 10 && h <= 22 && h <= currentH;
    const bestellungen = active ? Math.floor(Math.random() * 8 + 2) : 0;
    return { stunde: h, kosten_eur: parseFloat((bestellungen * 15 * MATERIAL_RATIO).toFixed(2)), bestellungen };
  });
  const materialkosten_summe_eur = parseFloat(stunden_breakdown.reduce((a, s) => a + s.kosten_eur, 0).toFixed(2));
  const auslastungsgrad_pct = parseFloat(((materialkosten_summe_eur / DEFAULT_BUDGET) * 100).toFixed(1));
  return {
    materialkosten_summe_eur,
    budget_limit_eur: DEFAULT_BUDGET,
    auslastungsgrad_pct,
    ampel: calcAmpel(auslastungsgrad_pct),
    stunden_breakdown,
    location_id: locationId,
    datum: now.toISOString().slice(0, 10),
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Budget-Limit aus delivery_config
    const { data: budgetCfg } = await (sb as any)
      .from('delivery_config')
      .select('config_value')
      .eq('location_id', locationId)
      .eq('config_key', 'tages_budget_eur')
      .maybeSingle();

    const budget_limit_eur = budgetCfg?.config_value ? Number(budgetCfg.config_value) : DEFAULT_BUDGET;

    // Bestellungen heute
    const { data: orders, error: oErr } = await (sb as any)
      .from('customer_orders')
      .select('id, gesamtbetrag, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .not('status', 'eq', 'storniert');

    if (oErr || !orders) return NextResponse.json(buildMock(locationId));

    // Stunden-Aggregation
    const buckets: Record<number, { kosten: number; bestellungen: number }> = {};
    for (const o of orders) {
      const h = new Date(o.created_at).getUTCHours();
      if (!buckets[h]) buckets[h] = { kosten: 0, bestellungen: 0 };
      buckets[h].kosten += (o.gesamtbetrag ?? 15) * MATERIAL_RATIO;
      buckets[h].bestellungen += 1;
    }

    const stunden_breakdown: StundeBreakdown[] = Array.from({ length: 24 }, (_, h) => ({
      stunde: h,
      kosten_eur: parseFloat((buckets[h]?.kosten ?? 0).toFixed(2)),
      bestellungen: buckets[h]?.bestellungen ?? 0,
    }));

    const materialkosten_summe_eur = parseFloat(stunden_breakdown.reduce((a, s) => a + s.kosten_eur, 0).toFixed(2));
    const auslastungsgrad_pct = parseFloat(((materialkosten_summe_eur / budget_limit_eur) * 100).toFixed(1));

    const now = new Date();
    return NextResponse.json({
      materialkosten_summe_eur,
      budget_limit_eur,
      auslastungsgrad_pct,
      ampel: calcAmpel(auslastungsgrad_pct),
      stunden_breakdown,
      location_id: locationId,
      datum: now.toISOString().slice(0, 10),
      generiert_am: now.toISOString(),
    } satisfies TagesKostenResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
