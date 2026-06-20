'use client';

/**
 * DispatchStopAnkunftsMatrix — Phase 315
 *
 * Zeigt Dispatch eine Matrix aller aktiven Tour-Stopps
 * mit Echtzeit-ETA, Ankunfts-Wahrscheinlichkeit und Risiko-Farbkodierung.
 * Polling alle 30 s — kritische Abweichungen werden sofort hervorgehoben.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock,
  MapPin, Navigation2, RefreshCw, Route, Timer, Zap,
} from 'lucide-react';

interface StopEntry {
  stopId: string;
  batchId: string;
  driverName: string;
  kundeAdresse: string | null;
  kundeName: string | null;
  remainingMinutes: number | null;
  stopStatus: 'pending' | 'next' | 'en_route' | 'arrived' | 'delivered' | 'late' | 'at_risk';
  isNext: boolean;
  delayMinutes: number | null;
  onTimeProb: number;
  reihenfolge: number;
}

interface MatrixData {
  activeTours: number;
  totalPendingStops: number;
  lateStops: number;
  atRiskStops: number;
  onTimeStops: number;
  entries: StopEntry[];
}

const ROW_STYLE: Record<string, { bg: string; border: string; dotColor: string; statusLabel: string; statusBadge: string }> = {
  late:      { bg: 'bg-red-50',     border: 'border-l-red-500',    dotColor: 'bg-red-500',     statusLabel: 'Verspätet',  statusBadge: 'bg-red-500 text-white' },
  at_risk:   { bg: 'bg-amber-50',   border: 'border-l-amber-400',  dotColor: 'bg-amber-400',   statusLabel: 'Risiko',     statusBadge: 'bg-amber-400 text-white' },
  en_route:  { bg: 'bg-matcha-50',  border: 'border-l-matcha-500', dotColor: 'bg-matcha-500',  statusLabel: 'Unterwegs',  statusBadge: 'bg-matcha-500 text-white' },
  next:      { bg: 'bg-blue-50',    border: 'border-l-blue-400',   dotColor: 'bg-blue-400',    statusLabel: 'Nächster',   statusBadge: 'bg-blue-400 text-white' },
  pending:   { bg: '',              border: 'border-l-stone-200',  dotColor: 'bg-stone-300',   statusLabel: 'Wartend',    statusBadge: 'bg-stone-300 text-stone-700' },
  delivered: { bg: 'bg-muted/20',   border: 'border-l-muted',      dotColor: 'bg-muted-foreground', statusLabel: 'Fertig', statusBadge: 'bg-muted text-muted-foreground' },
  arrived:   { bg: 'bg-matcha-50',  border: 'border-l-matcha-400', dotColor: 'bg-matcha-400',  statusLabel: 'Ankommen',   statusBadge: 'bg-matcha-400 text-white' },
};

function probBar(prob: number) {
  const pct = Math.round(prob * 100);
  const color = pct >= 80 ? 'bg-matcha-500' : pct >= 55 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums text-muted-foreground w-6 text-right">{pct}%</span>
    </div>
  );
}

export function DispatchStopAnkunftsMatrix({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState('');
  const [expanded, setExpanded] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const url = `/api/delivery/admin/stop-timing-matrix${locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      setData(d);
      setTs(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const pendingEntries = (data?.entries ?? [])
    .filter(e => e.stopStatus !== 'delivered')
    .sort((a, b) => {
      const priority = ['late', 'at_risk', 'en_route', 'next', 'pending', 'arrived'];
      const ap = priority.indexOf(a.stopStatus);
      const bp = priority.indexOf(b.stopStatus);
      if (ap !== bp) return ap - bp;
      return (a.remainingMinutes ?? 999) - (b.remainingMinutes ?? 999);
    });

  if (loading) {
    return (
      <Card className="p-4 space-y-2">
        <div className="h-4 w-44 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted/50 rounded-xl animate-pulse" />
      </Card>
    );
  }

  if (!data || data.activeTours === 0) return null;

  const critical = (data.lateStops ?? 0) + (data.atRiskStops ?? 0);

  return (
    <Card className={cn('overflow-hidden', critical > 0 && 'ring-1 ring-amber-400')}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition text-left"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Stopp-Ankunfts-Matrix · Live
        </span>
        {critical > 0 ? (
          <Badge className="bg-amber-500 text-white text-[9px] flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {critical} kritisch
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px]">
            {data.activeTours} Tour{data.activeTours !== 1 ? 'en' : ''}
          </Badge>
        )}
      </button>

      {/* KPI-Leiste */}
      <div className="grid grid-cols-4 divide-x border-b text-center bg-muted/10">
        {[
          { v: data.activeTours,       l: 'Touren',     c: 'text-foreground' },
          { v: data.totalPendingStops, l: 'Stopps',     c: 'text-foreground' },
          { v: data.onTimeStops,       l: 'Pünktlich',  c: 'text-matcha-700' },
          { v: critical,               l: 'Kritisch',   c: critical > 0 ? 'text-amber-600' : 'text-muted-foreground' },
        ].map(kpi => (
          <div key={kpi.l} className="py-1.5">
            <div className={cn('text-base font-black tabular-nums leading-none', kpi.c)}>{kpi.v}</div>
            <div className="text-[8px] font-semibold uppercase text-muted-foreground mt-0.5">{kpi.l}</div>
          </div>
        ))}
      </div>

      {expanded && (
        <>
          {/* Matrix-Rows */}
          <div className="divide-y max-h-72 overflow-y-auto">
            {pendingEntries.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                Alle Stopps abgeschlossen
              </div>
            )}
            {pendingEntries.map(entry => {
              const style = ROW_STYLE[entry.stopStatus] ?? ROW_STYLE.pending;
              const remain = entry.remainingMinutes;
              const isUrgent = entry.stopStatus === 'late' || entry.stopStatus === 'at_risk';

              return (
                <div
                  key={entry.stopId}
                  className={cn(
                    'flex items-start gap-3 px-4 py-2.5 border-l-2',
                    style.bg, style.border,
                  )}
                >
                  {/* Stop-Nr */}
                  <div className={cn(
                    'shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black text-white',
                    style.dotColor,
                  )}>
                    {entry.reihenfolge}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold truncate">{entry.driverName}</span>
                      <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 text-white shrink-0', style.dotColor)}>
                        {style.statusLabel}
                      </span>
                      {isUrgent && entry.delayMinutes !== null && entry.delayMinutes > 0 && (
                        <span className="text-[9px] text-red-600 font-black">+{Math.round(entry.delayMinutes)}m</span>
                      )}
                    </div>

                    {(entry.kundeName || entry.kundeAdresse) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {entry.kundeName ?? ''}{entry.kundeName && entry.kundeAdresse ? ' · ' : ''}{entry.kundeAdresse?.split(',')[0] ?? ''}
                        </span>
                      </div>
                    )}

                    <div className="mt-1">{probBar(entry.onTimeProb)}</div>
                  </div>

                  {/* ETA */}
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'font-mono text-sm font-black tabular-nums',
                      entry.stopStatus === 'late' ? 'text-red-600' :
                      entry.stopStatus === 'at_risk' ? 'text-amber-600' :
                      entry.stopStatus === 'en_route' ? 'text-matcha-700' : 'text-foreground',
                    )}>
                      {remain === null ? '—' : remain <= 0 ? `−${Math.abs(remain)}m` : `${remain}m`}
                    </div>
                    <div className="text-[8px] text-muted-foreground">ETA</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-t bg-muted/10">
            <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Zuletzt: {ts}</span>
            <button
              onClick={load}
              className="ml-auto text-[9px] text-matcha-600 font-bold hover:underline"
            >
              Aktualisieren
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
