'use client';

/**
 * KitchenStopArrivalPrognose — Phase 315
 *
 * Zeigt der Küche eine Echtzeit-Vorschau wann Fahrer zurückkehren,
 * damit rechtzeitig gekocht werden kann.
 * Polling alle 45 s auf /api/delivery/admin/stop-timing-matrix
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, AlertTriangle, CheckCircle2, MapPin, RefreshCw } from 'lucide-react';

interface StopEntry {
  stopId: string;
  batchId: string;
  driverName: string;
  kundeAdresse: string | null;
  remainingMinutes: number | null;
  stopStatus: 'pending' | 'next' | 'en_route' | 'arrived' | 'delivered' | 'late' | 'at_risk';
  isNext: boolean;
  delayMinutes: number | null;
  onTimeProb: number;
}

interface MatrixData {
  activeTours: number;
  totalPendingStops: number;
  lateStops: number;
  atRiskStops: number;
  onTimeStops: number;
  entries: StopEntry[];
}

const STATUS_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  late:      { badge: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500',     label: 'Verspätet' },
  at_risk:   { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400',  label: 'Knapp' },
  en_route:  { badge: 'bg-matcha-100 text-matcha-700 border-matcha-200', dot: 'bg-matcha-500', label: 'Unterwegs' },
  next:      { badge: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500',    label: 'Nächster' },
  pending:   { badge: 'bg-stone-100 text-stone-600 border-stone-200', dot: 'bg-stone-400',  label: 'Wartend' },
  delivered: { badge: 'bg-matcha-100 text-matcha-700 border-matcha-200', dot: 'bg-matcha-600', label: 'Geliefert' },
  arrived:   { badge: 'bg-matcha-100 text-matcha-700 border-matcha-200', dot: 'bg-matcha-500', label: 'Angekommen' },
};

function remainLabel(min: number | null, status: string): string {
  if (status === 'delivered') return '✓ Fertig';
  if (min === null) return '—';
  if (min < 0) return `${Math.abs(min)} Min zu spät`;
  if (min === 0) return 'Jetzt';
  return `~${min} Min`;
}

export function KitchenStopArrivalPrognose({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const url = `/api/delivery/admin/stop-timing-matrix${locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      setData(d);
      setLastUpdate(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 45_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // Nur aktive (nicht gelieferte) Stopps, nach Dringlichkeit sortiert
  const activeEntries = (data?.entries ?? [])
    .filter(e => e.stopStatus !== 'delivered')
    .sort((a, b) => {
      const order = ['late', 'at_risk', 'en_route', 'next', 'pending'];
      const ai = order.indexOf(a.stopStatus);
      const bi = order.indexOf(b.stopStatus);
      if (ai !== bi) return ai - bi;
      return (a.remainingMinutes ?? 999) - (b.remainingMinutes ?? 999);
    })
    .slice(0, 6);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="h-4 w-40 bg-muted rounded animate-pulse" />
        <div className="h-16 bg-muted/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.activeTours === 0) return null;

  const lateOrRisk = (data.lateStops ?? 0) + (data.atRiskStops ?? 0);

  return (
    <div className={cn(
      'rounded-2xl border bg-card overflow-hidden',
      lateOrRisk > 0 ? 'border-amber-300' : 'border-border',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        lateOrRisk > 0 ? 'bg-amber-50 border-amber-200' : 'bg-muted/20',
      )}>
        <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Rückkehr Prognose</span>
        {lateOrRisk > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] font-black">
            <AlertTriangle className="h-2.5 w-2.5" />
            {lateOrRisk} kritisch
          </span>
        )}
        {lateOrRisk === 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[9px] font-bold">
            <CheckCircle2 className="h-2.5 w-2.5" />
            {data.activeTours} aktiv
          </span>
        )}
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 divide-x border-b text-center">
        {[
          { label: 'Offen', value: data.totalPendingStops, color: 'text-foreground' },
          { label: 'Pünktlich', value: data.onTimeStops, color: 'text-matcha-700' },
          { label: 'Gefährdet', value: lateOrRisk, color: lateOrRisk > 0 ? 'text-amber-600' : 'text-muted-foreground' },
        ].map(kpi => (
          <div key={kpi.label} className="py-2 px-2">
            <div className={cn('text-lg font-black tabular-nums', kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y">
        {activeEntries.map(entry => {
          const style = STATUS_STYLE[entry.stopStatus] ?? STATUS_STYLE.pending;
          const remain = entry.remainingMinutes;
          const isUrgent = entry.stopStatus === 'late' || entry.stopStatus === 'at_risk';

          return (
            <div
              key={entry.stopId}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                isUrgent ? 'bg-amber-50/50' : '',
              )}
            >
              <div className={cn('h-2 w-2 rounded-full shrink-0', style.dot)} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold truncate">{entry.driverName}</span>
                  {entry.kundeAdresse && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground truncate max-w-[120px]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {entry.kundeAdresse.split(',')[0]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5 border', style.badge)}>
                    {style.label}
                  </span>
                  {entry.delayMinutes !== null && entry.delayMinutes > 0 && (
                    <span className="text-[9px] text-red-600 font-bold">
                      +{Math.round(entry.delayMinutes)} Min Verzug
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={cn(
                  'font-mono text-sm font-black tabular-nums',
                  entry.stopStatus === 'late' ? 'text-red-600' :
                  entry.stopStatus === 'at_risk' ? 'text-amber-600' : 'text-matcha-700',
                )}>
                  {remain !== null ? (
                    remain <= 0
                      ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{Math.abs(remain)}m</span>
                      : `${remain}m`
                  ) : '—'}
                </div>
                <div className="text-[8px] text-muted-foreground">
                  {remain !== null && remain <= 0 ? 'überfällig' : 'verbleibend'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdate && (
        <div className="flex items-center gap-1 px-4 py-1.5 border-t bg-muted/10">
          <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">
            Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}
