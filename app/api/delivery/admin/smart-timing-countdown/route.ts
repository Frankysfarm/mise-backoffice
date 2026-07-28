import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KOCHZEIT_ZIEL_MIN = 15;

type BestellStatus = 'kocht' | 'wartend' | 'bereit' | 'ueberfallig';
type Komplexitaet = 'niedrig' | 'mittel' | 'hoch';

interface Bestellung {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  prep_start_iso: string | null;
  target_min: number;
  status: BestellStatus;
  fahrer_eta_min: number | null;
  komplexitaet: Komplexitaet;
}

interface ApiData {
  bestellungen: Bestellung[];
  kochstart_score: number;
  on_time_rate: number;
  avg_prep_min: number;
  ueberfallig_count: number;
  fahrer_sync_count: number;
  kochzeit_ziel_min: number;
  queue_prognose_15min: number;
}

function buildMock(): ApiData {
  const now = new Date();
  return {
    kochstart_score: 87,
    on_time_rate: 82,
    avg_prep_min: 13,
    ueberfallig_count: 1,
    fahrer_sync_count: 4,
    kochzeit_ziel_min: KOCHZEIT_ZIEL_MIN,
    queue_prognose_15min: 6,
    bestellungen: [
      { id: 'o1', bestellnummer: 'FF-1042', kunde_name: 'Müller, A.', prep_start_iso: new Date(now.getTime() - 7 * 60000).toISOString(), target_min: KOCHZEIT_ZIEL_MIN, status: 'kocht', fahrer_eta_min: 8, komplexitaet: 'niedrig' },
      { id: 'o2', bestellnummer: 'FF-1043', kunde_name: 'Schmidt, B.', prep_start_iso: new Date(now.getTime() - 17 * 60000).toISOString(), target_min: KOCHZEIT_ZIEL_MIN, status: 'ueberfallig', fahrer_eta_min: 2, komplexitaet: 'mittel' },
      { id: 'o3', bestellnummer: 'FF-1044', kunde_name: 'Weber, C.', prep_start_iso: new Date(now.getTime() - 11 * 60000).toISOString(), target_min: KOCHZEIT_ZIEL_MIN, status: 'kocht', fahrer_eta_min: null, komplexitaet: 'hoch' },
      { id: 'o4', bestellnummer: 'FF-1045', kunde_name: 'Fischer, D.', prep_start_iso: null, target_min: KOCHZEIT_ZIEL_MIN, status: 'wartend', fahrer_eta_min: 22, komplexitaet: 'niedrig' },
      { id: 'o5', bestellnummer: 'FF-1046', kunde_name: 'Becker, E.', prep_start_iso: new Date(now.getTime() - 14 * 60000).toISOString(), target_min: KOCHZEIT_ZIEL_MIN, status: 'bereit', fahrer_eta_min: 3, komplexitaet: 'mittel' },
    ],
  };
}

function mapStatus(dbStatus: string, prepStartedAt: string | null, now: number): BestellStatus {
  if (dbStatus === 'fertig') return 'bereit';
  if (dbStatus === 'in_zubereitung') {
    if (!prepStartedAt) return 'kocht';
    const elapsedMin = (now - new Date(prepStartedAt).getTime()) / 60000;
    return elapsedMin > KOCHZEIT_ZIEL_MIN ? 'ueberfallig' : 'kocht';
  }
  return 'wartend';
}

function komplexitaet(elapsedMin: number | null): Komplexitaet {
  if (elapsedMin === null) return 'niedrig';
  if (elapsedMin > 12) return 'hoch';
  if (elapsedMin > 7) return 'mittel';
  return 'niedrig';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const now = Date.now();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, bestellnummer, kunde_name, status, prep_started_at, confirmed_at, created_at')
      .eq('location_id', location_id)
      .in('status', ['bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (error || !orders || orders.length === 0) return NextResponse.json(buildMock());

    const bestellungen: Bestellung[] = orders.map((o) => {
      const prepStart = o.prep_started_at ?? null;
      const elapsedMin = prepStart ? (now - new Date(prepStart).getTime()) / 60000 : null;
      const status = mapStatus(o.status, prepStart, now);
      return {
        id: o.id,
        bestellnummer: o.bestellnummer ?? o.id.slice(0, 8),
        kunde_name: o.kunde_name ?? 'Gast',
        prep_start_iso: prepStart,
        target_min: KOCHZEIT_ZIEL_MIN,
        status,
        fahrer_eta_min: null,
        komplexitaet: komplexitaet(elapsedMin),
      };
    });

    const ueberfallig_count = bestellungen.filter(b => b.status === 'ueberfallig').length;
    const kochend = bestellungen.filter(b => b.status === 'kocht' || b.status === 'ueberfallig');
    const avg_prep_min = kochend.length > 0
      ? Math.round(kochend.reduce((s, b) => s + (b.prep_start_iso ? (now - new Date(b.prep_start_iso).getTime()) / 60000 : 0), 0) / kochend.length)
      : 0;

    const on_time = bestellungen.filter(b => b.status === 'bereit' || b.status === 'kocht').length;
    const on_time_rate = bestellungen.length > 0 ? Math.round((on_time / bestellungen.length) * 100) : 100;
    const kochstart_score = Math.max(0, Math.min(100, 100 - ueberfallig_count * 15 - (avg_prep_min > KOCHZEIT_ZIEL_MIN ? (avg_prep_min - KOCHZEIT_ZIEL_MIN) * 3 : 0)));

    return NextResponse.json({
      bestellungen,
      kochstart_score,
      on_time_rate,
      avg_prep_min,
      ueberfallig_count,
      fahrer_sync_count: 0,
      kochzeit_ziel_min: KOCHZEIT_ZIEL_MIN,
      queue_prognose_15min: bestellungen.filter(b => b.status === 'wartend').length,
    } satisfies ApiData);
  } catch {
    return NextResponse.json(buildMock());
  }
}
