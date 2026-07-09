/**
 * GET /api/delivery/admin/kunden-wiederkauf-segmente?location_id=<uuid>
 *
 * Phase 918 — Kunden-Wiederkauf-Segmente-API
 * RFM-Cluster (Recency / Frequency / Monetary) + Wiederkauf-Wahrscheinlichkeit.
 * Segmente: Champions / Loyale / Potenzielle / Gefährdete / Verlorene
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Segment {
  name: string;
  kunden_count: number;
  wiederkauf_pct: number;
  avg_bestellungen: number;
  avg_umsatz_eur: number;
  avg_tage_seit_letzter: number;
  empfehlung: string;
}

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
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();
  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - 90);

  // Alle Bestellungen der letzten 90 Tage
  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, customer_phone, total_amount, created_at')
    .eq('location_id', locationId)
    .not('status', 'in', '("storniert","cancelled")')
    .gte('created_at', cutoff90.toISOString())
    .order('created_at', { ascending: false });

  if (!orders || orders.length === 0) {
    return NextResponse.json({
      segmente: [],
      gesamt_kunden: 0,
      generatedAt: now.toISOString(),
    });
  }

  // Kunden-Aggregation
  const customerMap = new Map<string, {
    bestellungen: number;
    umsatz: number;
    letzte_bestellung: Date;
    erste_bestellung: Date;
  }>();

  for (const o of orders) {
    const key = (o.customer_phone as string | null) ?? o.id;
    const ts = new Date(o.created_at as string);
    const existing = customerMap.get(key);
    if (!existing) {
      customerMap.set(key, {
        bestellungen: 1,
        umsatz: (o.total_amount as number) ?? 0,
        letzte_bestellung: ts,
        erste_bestellung: ts,
      });
    } else {
      existing.bestellungen += 1;
      existing.umsatz += (o.total_amount as number) ?? 0;
      if (ts > existing.letzte_bestellung) existing.letzte_bestellung = ts;
      if (ts < existing.erste_bestellung) existing.erste_bestellung = ts;
    }
  }

  // RFM-Scoring
  interface CustomerRFM {
    recencyDays: number;
    frequency: number;
    monetaryEur: number;
  }

  const customers: CustomerRFM[] = [];
  for (const v of customerMap.values()) {
    customers.push({
      recencyDays: Math.round((now.getTime() - v.letzte_bestellung.getTime()) / 86400000),
      frequency: v.bestellungen,
      monetaryEur: Math.round(v.umsatz * 100) / 100,
    });
  }

  // RFM-Segmentierung
  type SegmentKey = 'champions' | 'loyal' | 'potenzielle' | 'gefaehrdet' | 'verloren';

  function classify(c: CustomerRFM): SegmentKey {
    if (c.recencyDays <= 14 && c.frequency >= 4) return 'champions';
    if (c.recencyDays <= 30 && c.frequency >= 2) return 'loyal';
    if (c.recencyDays <= 45 && c.frequency >= 1) return 'potenzielle';
    if (c.recencyDays <= 70) return 'gefaehrdet';
    return 'verloren';
  }

  const groups: Record<SegmentKey, CustomerRFM[]> = {
    champions: [],
    loyal: [],
    potenzielle: [],
    gefaehrdet: [],
    verloren: [],
  };

  for (const c of customers) {
    groups[classify(c)].push(c);
  }

  const segmentConfig: Record<SegmentKey, { name: string; wiederkauf_pct: number; empfehlung: string }> = {
    champions: {
      name: 'Champions',
      wiederkauf_pct: 92,
      empfehlung: 'Loyalty-Punkte verdoppeln, exklusive Vorteile anbieten',
    },
    loyal: {
      name: 'Loyale',
      wiederkauf_pct: 74,
      empfehlung: 'Regelmäßige Angebote senden, Treuekarte aktivieren',
    },
    potenzielle: {
      name: 'Potenzielle',
      wiederkauf_pct: 52,
      empfehlung: 'Willkommens-Rabatt für 2. Bestellung anbieten',
    },
    gefaehrdet: {
      name: 'Gefährdete',
      wiederkauf_pct: 28,
      empfehlung: 'Reaktivierungsaktion starten — "Wir vermissen dich"-Aktion',
    },
    verloren: {
      name: 'Verlorene',
      wiederkauf_pct: 8,
      empfehlung: 'Verlust akzeptieren oder starken Gutschein senden',
    },
  };

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const segmente: Segment[] = (Object.keys(groups) as SegmentKey[])
    .filter((k) => groups[k].length > 0)
    .map((k) => {
      const g = groups[k];
      const cfg = segmentConfig[k];
      return {
        name: cfg.name,
        kunden_count: g.length,
        wiederkauf_pct: cfg.wiederkauf_pct,
        avg_bestellungen: avg(g.map((c) => c.frequency)),
        avg_umsatz_eur: avg(g.map((c) => c.monetaryEur)),
        avg_tage_seit_letzter: avg(g.map((c) => c.recencyDays)),
        empfehlung: cfg.empfehlung,
      };
    });

  return NextResponse.json({
    segmente,
    gesamt_kunden: customers.length,
    generatedAt: now.toISOString(),
  });
}
