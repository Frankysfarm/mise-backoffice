'use client';

/**
 * LieferdienstTourStoppPünktlichkeitsCockpit — Phase 406
 *
 * Live-Übersicht aller aktiven Stopp-ETAs mit Farbkodierung.
 * Zeigt aktive Touren, offene Stopps, pünktliche/gefährdete/verspätete Stopps.
 * API: GET /api/delivery/admin/stop-timing-matrix?location_id=...
 * Realtime: Supabase channel auf mise_delivery_batch_stops
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface StopEntry {
  stopId: string;
  batchId: string;
  orderId: string;
  reihenfolge: number;
  driverName: string;
  kundeAdresse: string | null;
  kundeName: string | null;
  remainingMinutes: number | null;
  stopStatus: 'pending' | 'next' | 'en_route' | 'arrived' | 'delivered' | 'late' | 'at_risk';
  delayMinutes: number | null;
  onTimeProb: number;
  isNext: boolean;
  completedAt: string | null;
}

interface MatrixData {
  activeTours: number;
  totalPendingStops: number;
  lateStops: number;
  atRiskStops: number;
  onTimeStops: number;
  entries: StopEntry[];
}

const STATUS_ICON: Record<StopEntry['stopStatus'], React.ReactNode> = {
  pending:   <Clock className="h-3 w-3 text-muted-foreground" />,
  next:      <Clock className="h-3 w-3 text-blue-500" />,
  en_route:  <Clock className="h-3 w-3 text-blue-600" />,
  arrived:   <CheckCircle2 className="h-3 w-3 text-matcha-600" />,
  delivered: <CheckCircle2 className="h-3 w-3 text-matcha-700" />,
  late:      <XCircle className="h-3 w-3 text-red-500" />,
  at_risk:   <AlertTriangle className="h-3 w-3 text-amber-500" />,
};

function probColor(p: number): string {
  if (p >= 0.8) return 'text-matcha-700';
  if (p >= 0.5) return 'text-amber-600';
  return 'text-red-600';
}

export function LieferdienstTourStoppPünktlichkeitsCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [open, setOpen] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/stop-timing-matrix?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json: MatrixData = await res.json();
      setData(json);
    } catch {
      // ignore network errors
    }
  }, [locationId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  // Supabase realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('tour-stopp-cockpit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, load]);

  if (!data || data.entries.length === 0) return null;

  const activeEntries = data.entries
    .filter((e) => e.stopStatus !== 'delivered')
    .slice(0, 10);

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-matcha-100 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-sm text-matcha-800">Tour-Stopp-Pünktlichkeit</span>
          {/* Summary row */}
          <span className="text-xs text-muted-foreground">
            {data.activeTours} aktive {data.activeTours === 1 ? 'Tour' : 'Touren'} · {data.totalPendingStops} offene {data.totalPendingStops === 1 ? 'Stopp' : 'Stopps'}
          </span>
          {/* Chip badges */}
          <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 border border-matcha-300 px-2 py-0.5 text-[11px] font-medium text-matcha-700">
            <CheckCircle2 className="h-3 w-3" /> {data.onTimeStops} pünktlich
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" /> {data.atRiskStops} gefährdet
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-300 px-2 py-0.5 text-[11px] font-medium text-red-700">
            <XCircle className="h-3 w-3" /> {data.lateStops} verspätet
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {/* Body */}
      {open && activeEntries.length > 0 && (
        <div className="divide-y divide-matcha-200 border-t border-matcha-200">
          {activeEntries.map((entry) => {
            const probPct = Math.round(entry.onTimeProb * 100);
            const remaining = entry.remainingMinutes;
            const isLate = remaining !== null && remaining < 0;

            return (
              <div key={entry.stopId} className="flex items-center gap-3 px-4 py-2.5">
                {/* Status icon */}
                <div className="shrink-0">{STATUS_ICON[entry.stopStatus]}</div>

                {/* Driver + stop# */}
                <div className="min-w-[90px] shrink-0">
                  <div className="text-xs font-medium text-foreground truncate">{entry.driverName}</div>
                  <div className="text-[10px] text-muted-foreground">Stopp #{entry.reihenfolge}</div>
                </div>

                {/* Customer */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-foreground truncate">
                    {entry.kundeName ?? entry.kundeAdresse ?? '—'}
                  </div>
                  {entry.kundeAdresse && entry.kundeName && (
                    <div className="text-[10px] text-muted-foreground truncate">{entry.kundeAdresse}</div>
                  )}
                </div>

                {/* Remaining time */}
                <div className="shrink-0 text-right">
                  {remaining !== null ? (
                    <div className={cn('text-xs font-semibold', isLate ? 'text-red-600' : 'text-foreground')}>
                      {isLate ? `${Math.abs(remaining)} min fällig` : `${remaining} min`}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">—</div>
                  )}
                  {/* OnTimeProb */}
                  <div className={cn('text-[10px] font-medium', probColor(entry.onTimeProb))}>
                    {probPct}% p&uuml;nktlich
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
