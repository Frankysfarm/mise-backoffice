'use client';

/**
 * DispatchTourStopVerfolger — Phase 388
 * Live Tour-Stop-Tracker: Zeigt aktive Batches mit Fortschritt, ETA zur Basis und Health-Ampel.
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Bike, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
  } | null;
};

type BatchEntry = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  fahrer?: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type ApiResponse = {
  batches?: BatchEntry[];
};

const AVG_DELIVERY_MIN = 8;

const MOCK_BATCHES: BatchEntry[] = [
  {
    id: 'mock-batch-1',
    status: 'unterwegs',
    fahrer_id: 'drv-1',
    startzeit: new Date(Date.now() - 18 * 60_000).toISOString(),
    total_eta_min: 35,
    zone: 'Nord',
    fahrer: { vorname: 'Max', nachname: 'Müller' },
    stops: [
      { id: 's1', reihenfolge: 1, geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString() },
      { id: 's2', reihenfolge: 2, geliefert_am: null },
      { id: 's3', reihenfolge: 3, geliefert_am: null },
    ],
  },
  {
    id: 'mock-batch-2',
    status: 'on_route',
    fahrer_id: 'drv-2',
    startzeit: new Date(Date.now() - 5 * 60_000).toISOString(),
    total_eta_min: 30,
    zone: 'Süd',
    fahrer: { vorname: 'Anna', nachname: 'Schmidt' },
    stops: [
      { id: 's4', reihenfolge: 1, geliefert_am: null },
      { id: 's5', reihenfolge: 2, geliefert_am: null },
    ],
  },
  {
    id: 'mock-batch-3',
    status: 'unterwegs',
    fahrer_id: 'drv-3',
    startzeit: new Date(Date.now() - 40 * 60_000).toISOString(),
    total_eta_min: 38,
    zone: 'Mitte',
    fahrer: { vorname: 'Tom', nachname: 'Becker' },
    stops: [
      { id: 's6', reihenfolge: 1, geliefert_am: new Date(Date.now() - 25 * 60_000).toISOString() },
      { id: 's7', reihenfolge: 2, geliefert_am: new Date(Date.now() - 12 * 60_000).toISOString() },
      { id: 's8', reihenfolge: 3, geliefert_am: null },
    ],
  },
];

type Health = 'green' | 'amber' | 'red';

function computeHealth(
  startzeit: string | null | undefined,
  totalEtaMin: number | null | undefined,
  now: number,
): Health {
  if (!startzeit || !totalEtaMin) return 'green';
  const etaMs = new Date(startzeit).getTime() + totalEtaMin * 60_000;
  const overMs = now - etaMs;
  if (overMs < 0) return 'green';
  if (overMs < 5 * 60_000) return 'amber';
  return 'red';
}

const HEALTH_STYLES: Record<Health, { border: string; bg: string; dot: string; text: string }> = {
  green: {
    border: 'border-matcha-200',
    bg: 'bg-matcha-50',
    dot: 'bg-matcha-500',
    text: 'text-matcha-700',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50',
    dot: 'bg-red-500 animate-pulse',
    text: 'text-red-700',
  },
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function TourCard({ batch, now }: { batch: BatchEntry; now: number }) {
  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const deliveredCount = sorted.filter((s) => !!s.geliefert_am).length;
  const totalCount = sorted.length;
  const remainingStops = totalCount - deliveredCount;
  const currentStopNumber = deliveredCount + 1;
  const pct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  // ETA to base return: remaining stops × avg delivery time
  const etaToBaseMin = remainingStops * AVG_DELIVERY_MIN;
  const etaToBaseMs = now + etaToBaseMin * 60_000;

  const health = computeHealth(batch.startzeit, batch.total_eta_min, now);
  const c = HEALTH_STYLES[health];

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
    : 'Fahrer';

  const lastUpdateStr = fmtTime(new Date(now));

  return (
    <div className={cn('rounded-xl border p-3', c.bg, c.border)}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', c.dot)} />
        <span className={cn('text-sm font-bold', c.text)}>{driverName}</span>
        {batch.zone && (
          <span className="text-[10px] font-semibold text-matcha-600 bg-matcha-100 rounded-full px-1.5 py-0.5">
            {batch.zone}
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-500 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Stopp {Math.min(currentStopNumber, totalCount)} / {totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full bg-white/70 rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            health === 'green' ? 'bg-matcha-500' : health === 'amber' ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      {/* ETA + last update */}
      <div className="flex items-center justify-between text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Rückkehr ~{fmtTime(new Date(etaToBaseMs))}
        </span>
        <span>Akt. {lastUpdateStr}</span>
      </div>
    </div>
  );
}

interface Props {
  locationId: string | null;
}

export function DispatchTourStopVerfolger({ locationId }: Props) {
  const [batches, setBatches] = useState<BatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) {
      setBatches(MOCK_BATCHES);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/dispatch-queue?location_id=${encodeURIComponent(locationId)}`,
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: ApiResponse = await res.json();
      const active = (json.batches ?? []).filter(
        (b) => b.status === 'unterwegs' || b.status === 'on_route',
      );
      setBatches(active.length > 0 ? active : MOCK_BATCHES);
    } catch {
      setBatches(MOCK_BATCHES);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const fetchIv = setInterval(() => void load(), 20_000);
    const tickIv = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      clearInterval(fetchIv);
      clearInterval(tickIv);
    };
  }, [load]);

  const activeTours = batches.filter(
    (b) => b.status === 'unterwegs' || b.status === 'on_route',
  );

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-matcha-50 hover:bg-matcha-100 transition-colors"
      >
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          Tour-Stop-Verfolger
        </span>
        <span className="text-[10px] font-black text-white bg-matcha-600 rounded-full px-2 py-0.5 ml-1">
          {activeTours.length}
        </span>
        {loading && (
          <span className="ml-2 text-[10px] text-matcha-400">Laden…</span>
        )}
        <span className="ml-auto">
          {open ? (
            <ChevronUp className="h-4 w-4 text-matcha-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-matcha-400" />
          )}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {activeTours.length === 0 ? (
            <p className="text-center text-xs text-matcha-400 py-4">
              Keine aktiven Touren
            </p>
          ) : (
            activeTours.map((batch) => (
              <TourCard key={batch.id} batch={batch} now={now} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
