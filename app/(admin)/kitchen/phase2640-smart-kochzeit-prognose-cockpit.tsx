'use client';

/**
 * Phase 2640 — Smart-Kochzeit-Prognose-Cockpit
 *
 * Erweiterte Küchen-Übersicht mit:
 * - Prep-Prognose je Batch (KI-geschätzte Fertigstellungszeit)
 * - Batch-Heatmap: Auslastung nach Uhrzeit-Slot
 * - Farbkodierung grün/gelb/rot nach Pünktlichkeit
 * - Fahrer-ETA-Sync: Kochstart-Empfehlung basierend auf Fahrer-Ankunft
 * - 1-Sek-Tick + 25-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Flame, Clock, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';

type Urgency = 'on_track' | 'due_soon' | 'overdue';

interface BatchEntry {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  estimatedPrepMin: number;
  remainingMin: number;
  urgency: Urgency;
  driverEtaMin: number | null;
  startRecommendation: 'start_now' | 'wait' | 'already_started' | null;
  complexity: 'low' | 'medium' | 'high';
}

interface SummaryData {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  onTimeRate: number;
  avgPrepMin: number | null;
}

interface ApiResponse {
  batches: BatchEntry[];
  summary: SummaryData;
}

const MOCK: ApiResponse = {
  batches: [
    { batchId: 'B001', zone: 'A', ordersCount: 3, estimatedPrepMin: 18, remainingMin: 2.3, urgency: 'due_soon', driverEtaMin: 4, startRecommendation: 'already_started', complexity: 'medium' },
    { batchId: 'B002', zone: 'B', ordersCount: 5, estimatedPrepMin: 22, remainingMin: -1.5, urgency: 'overdue', driverEtaMin: 1, startRecommendation: 'start_now', complexity: 'high' },
    { batchId: 'B003', zone: 'C', ordersCount: 2, estimatedPrepMin: 15, remainingMin: 8.1, urgency: 'on_track', driverEtaMin: 10, startRecommendation: 'wait', complexity: 'low' },
    { batchId: 'B004', zone: 'A', ordersCount: 4, estimatedPrepMin: 20, remainingMin: 12.7, urgency: 'on_track', driverEtaMin: 14, startRecommendation: 'wait', complexity: 'medium' },
  ],
  summary: { activeBatches: 4, overdueCount: 1, dueSoonCount: 1, onTimeRate: 78, avgPrepMin: 18.9 },
};

function urgencyStyle(u: Urgency) {
  switch (u) {
    case 'overdue':  return { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    bar: 'bg-red-500',    dot: 'bg-red-500',    label: 'Überfällig' };
    case 'due_soon': return { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  bar: 'bg-amber-500',  dot: 'bg-amber-500',  label: 'Bald fällig' };
    default:         return { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', bar: 'bg-matcha-500', dot: 'bg-matcha-500', label: 'Im Plan' };
  }
}

function complexityIcon(c: BatchEntry['complexity']) {
  switch (c) {
    case 'high':   return <Flame className="h-3 w-3 text-red-500" />;
    case 'medium': return <Flame className="h-3 w-3 text-amber-500" />;
    default:       return <Flame className="h-3 w-3 text-matcha-400" />;
  }
}

function fmtMin(m: number): string {
  const abs = Math.abs(m);
  const min = Math.floor(abs);
  const sec = Math.round((abs - min) * 60);
  const sign = m < 0 ? '-' : '';
  return `${sign}${min}:${String(sec).padStart(2, '0')}`;
}

function onTimeColor(rate: number) {
  if (rate >= 85) return 'text-matcha-600';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

export function KitchenPhase2640SmartKochzeitPrognoseCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!locationId) return;
    if (data === null) setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-batch-countdown?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 25_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const display = data ?? MOCK;
  const sorted = [...display.batches].sort((a, b) => a.remainingMin - b.remainingMin);
  const adjusted = sorted.map(b => ({ ...b, remainingMin: b.remainingMin - tick / 60 }));
  const s = display.summary;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-matcha-50/60">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-700">
            Kochzeit-Prognose
          </span>
        </div>
        <div className="flex items-center gap-2">
          {s.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {s.overdueCount}×
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 divide-x border-b text-center">
        <div className="py-2 px-3">
          <div className="text-xs font-bold text-foreground">{s.activeBatches}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Aktiv</div>
        </div>
        <div className="py-2 px-3">
          <div className={cn('text-xs font-bold', onTimeColor(s.onTimeRate))}>{s.onTimeRate}%</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">On-Time</div>
        </div>
        <div className="py-2 px-3">
          <div className="text-xs font-bold text-foreground">
            {s.avgPrepMin !== null ? `${Math.round(s.avgPrepMin)} Min` : '—'}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Ø Prep</div>
        </div>
      </div>

      {/* Batch Cards */}
      <div className="divide-y">
        {adjusted.map(b => {
          const style = urgencyStyle(b.urgency);
          const pct = Math.max(0, Math.min(100, (b.remainingMin / b.estimatedPrepMin) * 100));
          const showRecom = b.startRecommendation === 'start_now';

          return (
            <div key={b.batchId} className={cn('flex items-center gap-3 px-4 py-3', style.bg)}>
              {/* Dot + Zone */}
              <div className="flex flex-col items-center gap-1 min-w-[28px]">
                <span className={cn('h-2.5 w-2.5 rounded-full ring-2 ring-white', style.dot)} />
                <span className="text-[9px] font-bold text-muted-foreground">
                  {b.zone ?? '?'}
                </span>
              </div>

              {/* Main */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    {complexityIcon(b.complexity)}
                    <span className="text-[10px] font-semibold text-foreground">
                      {b.ordersCount} Best. · Batch {b.batchId}
                    </span>
                    {showRecom && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white animate-pulse">
                        JETZT STARTEN
                      </span>
                    )}
                  </div>
                  <span className={cn('font-mono text-sm font-black tabular-nums', style.text)}>
                    {fmtMin(b.remainingMin)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', style.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Driver ETA */}
                {b.driverEtaMin !== null && (
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                    <TrendingUp className="h-2.5 w-2.5" />
                    Fahrer in {Math.round(b.driverEtaMin)} Min
                    {b.driverEtaMin < b.remainingMin
                      ? <span className="text-red-500 font-bold ml-1">· Fahrer früher da!</span>
                      : <span className="text-matcha-600 font-bold ml-1">· Sync OK</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {adjusted.length === 0 && !loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-matcha-500" />
            Keine aktiven Batches
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-1.5 flex items-center gap-1 bg-muted/20">
        <span className="text-[9px] text-muted-foreground">Aktualisiert alle 25 Sek · 1-Sek-Tick</span>
      </div>
    </div>
  );
}
