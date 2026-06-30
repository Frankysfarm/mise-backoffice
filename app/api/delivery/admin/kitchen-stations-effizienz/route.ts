/**
 * GET /api/delivery/admin/kitchen-stations-effizienz?location_id=...
 *
 * Phase 524 — Küchen-Stations-Effizienz
 * Analysiert Stationstypen (Grill/Kalt/Getränke) und zeigt Auslastung.
 * Basis: Bestellpositionen → Item-Kategorie → Stations-Typ.
 * Vergleich: geschätzte Zubereitung vs. tatsächliche Zeit (letzte 2h).
 *
 * Response: { ok, stations: StationData[], totalInPrep, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type StationType = 'grill' | 'kalt' | 'getraenke' | 'allgemein';
export type StationLoad = 'idle' | 'normal' | 'busy' | 'overloaded';

export interface StationData {
  stationType: StationType;
  label: string;
  itemsInPrep: number;
  itemsCompleted: number;
  avgEstMinutes: number;
  avgActualMinutes: number | null;
  efficiencyPct: number | null;
  loadLevel: StationLoad;
}

const STATION_KEYWORDS: Record<StationType, string[]> = {
  grill:     ['burger', 'steak', 'grill', 'fleisch', 'kebab', 'döner', 'schnitzel', 'flügel', 'wings', 'ribs', 'bbq'],
  kalt:      ['salat', 'sushi', 'bowl', 'wrap', 'sandwich', 'baguette', 'kalt', 'dessert', 'eis'],
  getraenke: ['cola', 'water', 'wasser', 'juice', 'saft', 'bier', 'wein', 'limo', 'tee', 'kaffee', 'drink', 'getränk'],
  allgemein: [],
};

const STATION_LABELS: Record<StationType, string> = {
  grill:     'Grill / Warm',
  kalt:      'Kalte Küche',
  getraenke: 'Getränke',
  allgemein: 'Allgemein',
};

const EST_MINUTES: Record<StationType, number> = {
  grill:     12,
  kalt:      6,
  getraenke: 2,
  allgemein: 8,
};

const LOAD_THRESHOLDS: Record<StationType, { busy: number; overloaded: number }> = {
  grill:     { busy: 6,  overloaded: 12 },
  kalt:      { busy: 8,  overloaded: 16 },
  getraenke: { busy: 10, overloaded: 20 },
  allgemein: { busy: 5,  overloaded: 10 },
};

function classifyItem(name: string): StationType {
  const lower = name.toLowerCase();
  for (const [stype, keywords] of Object.entries(STATION_KEYWORDS) as [StationType, string[]][]) {
    if (stype === 'allgemein') continue;
    if (keywords.some((kw) => lower.includes(kw))) return stype;
  }
  return 'allgemein';
}

async function resolveLocationId(userId: string): Promise<string | null> {
  const sb = await createClient();
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  return (emp?.location_id as string) ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  let locationId = searchParams.get('location_id');
  if (!locationId) locationId = await resolveLocationId(user.id);
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const ssb = createServiceClient();
  const now = new Date();
  const since2h = new Date(now.getTime() - 2 * 3_600_000);

  // Aktive Bestellungen (in Zubereitung) der letzten 2h
  const { data: inPrepRows } = await ssb
    .from('customer_orders')
    .select('id, bestellt_am, in_zubereitung_seit')
    .eq('location_id', locationId)
    .in('status', ['in_zubereitung', 'preparing', 'bestätigt', 'confirmed', 'in_preparation'])
    .gte('bestellt_am', since2h.toISOString());

  // Abgeschlossene Bestellungen letzte 2h
  const { data: completedRows } = await ssb
    .from('customer_orders')
    .select('id, bestellt_am, fertig_am, in_zubereitung_seit')
    .eq('location_id', locationId)
    .in('status', ['fertig', 'ready', 'bereit', 'geliefert', 'delivered'])
    .gte('fertig_am', since2h.toISOString())
    .not('fertig_am', 'is', null);

  // Positionen für in Zubereitung
  const prepIds = ((inPrepRows ?? []) as { id: string }[]).map((r) => r.id);
  const completedIds = ((completedRows ?? []) as { id: string }[]).map((r) => r.id);

  const allIds = [...prepIds, ...completedIds];
  let itemRows: { order_id: string; name: string; quantity: number }[] = [];
  if (allIds.length > 0) {
    const { data } = await ssb
      .from('customer_order_items')
      .select('order_id, name, quantity')
      .in('order_id', allIds);
    itemRows = (data ?? []) as typeof itemRows;
  }

  // Stationen aggregieren
  const stationMap = new Map<StationType, {
    itemsInPrep: number;
    itemsCompleted: number;
    actualMinutes: number[];
  }>();

  const allTypes: StationType[] = ['grill', 'kalt', 'getraenke', 'allgemein'];
  for (const t of allTypes) {
    stationMap.set(t, { itemsInPrep: 0, itemsCompleted: 0, actualMinutes: [] });
  }

  const prepOrderSet = new Set(prepIds);

  // Items klassifizieren und Menge zuweisen
  for (const item of itemRows) {
    const stype = classifyItem(item.name);
    const qty = item.quantity ?? 1;
    const sd = stationMap.get(stype)!;
    if (prepOrderSet.has(item.order_id)) {
      sd.itemsInPrep += qty;
    } else {
      sd.itemsCompleted += qty;
    }
  }

  // Tatsächliche Zubereitungszeit aus abgeschlossenen Bestellungen
  const completedMap = new Map<string, { bestellt_am: string | null; in_zubereitung_seit: string | null; fertig_am: string | null }>();
  for (const r of (completedRows ?? []) as { id: string; bestellt_am: string | null; in_zubereitung_seit: string | null; fertig_am: string | null }[]) {
    completedMap.set(r.id, r);
  }
  for (const item of itemRows) {
    if (!completedOrderSet(completedIds, item.order_id)) continue;
    const order = completedMap.get(item.order_id);
    if (!order?.fertig_am) continue;
    const startTs = order.in_zubereitung_seit ?? order.bestellt_am;
    if (!startTs) continue;
    const actualMin = (new Date(order.fertig_am).getTime() - new Date(startTs).getTime()) / 60_000;
    if (actualMin > 0 && actualMin < 120) {
      const stype = classifyItem(item.name);
      stationMap.get(stype)!.actualMinutes.push(actualMin);
    }
  }

  const stations: StationData[] = allTypes.map((stype) => {
    const sd = stationMap.get(stype)!;
    const estMin = EST_MINUTES[stype];
    const avgActual = sd.actualMinutes.length > 0
      ? Math.round((sd.actualMinutes.reduce((a, b) => a + b, 0) / sd.actualMinutes.length) * 10) / 10
      : null;
    const efficiencyPct = avgActual !== null
      ? Math.round((estMin / avgActual) * 100)
      : null;

    const thresholds = LOAD_THRESHOLDS[stype];
    let loadLevel: StationLoad = 'idle';
    if (sd.itemsInPrep >= thresholds.overloaded) loadLevel = 'overloaded';
    else if (sd.itemsInPrep >= thresholds.busy) loadLevel = 'busy';
    else if (sd.itemsInPrep > 0) loadLevel = 'normal';

    return {
      stationType: stype,
      label: STATION_LABELS[stype],
      itemsInPrep: sd.itemsInPrep,
      itemsCompleted: sd.itemsCompleted,
      avgEstMinutes: estMin,
      avgActualMinutes: avgActual,
      efficiencyPct,
      loadLevel,
    };
  });

  const totalInPrep = stations.reduce((s, st) => s + st.itemsInPrep, 0);

  return NextResponse.json({ ok: true, stations, totalInPrep, generatedAt: now.toISOString() });
}

function completedOrderSet(ids: string[], id: string): boolean {
  return ids.includes(id);
}
