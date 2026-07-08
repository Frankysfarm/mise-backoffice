'use client';

import { useEffect, useState } from 'react';
import { Navigation, Clock, CheckCircle2, Bike, MapPin, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingData {
  status: string;
  eta_min: number | null;
  phase: 'bestellt' | 'in_kueche' | 'unterwegs' | 'geliefert' | 'unbekannt';
  driver_name: string | null;
  distance_remaining_m: number | null;
}

interface Props {
  orderId: string | null;
}

const PHASES = [
  { key: 'bestellt', label: 'Bestellt', icon: CheckCircle2 },
  { key: 'in_kueche', label: 'In Zubereitung', icon: Clock },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin },
] as const;

function statusToPhase(status: string): TrackingData['phase'] {
  if (['neu', 'bestätigt'].includes(status)) return 'bestellt';
  if (['in_zubereitung', 'fertig'].includes(status)) return 'in_kueche';
  if (['on_route', 'unterwegs', 'pickup'].includes(status)) return 'unterwegs';
  if (['geliefert', 'abgeholt', 'delivered'].includes(status)) return 'geliefert';
  return 'unbekannt';
}

export function StorefrontPhase851LiveEtaKommando({ orderId }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch');
      const json = await res.json();
      setData({
        status: json.status ?? 'unbekannt',
        eta_min: json.eta_min ?? null,
        phase: statusToPhase(json.status ?? ''),
        driver_name: json.driver_name ?? null,
        distance_remaining_m: json.distance_remaining_m ?? null,
      });
      setLastUpdated(new Date());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;
    fetchData();
    const id = setInterval(fetchData, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!orderId || loading || !data) return null;
  if (data.phase === 'geliefert') return null;

  const phaseIndex = PHASES.findIndex((p) => p.key === data.phase);
  const staleSec = lastUpdated ? Math.round((Date.now() - lastUpdated.getTime()) / 1000) : null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* ETA-Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        data.eta_min !== null && data.eta_min <= 5 ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'bg-card',
      )}>
        <Navigation className={cn('h-5 w-5 shrink-0', data.phase === 'unterwegs' ? 'text-matcha-600 animate-pulse' : 'text-muted-foreground')} />
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Live ETA</div>
          {data.eta_min !== null ? (
            <div className={cn(
              'text-2xl font-black tabular-nums leading-none',
              data.eta_min <= 5 ? 'text-matcha-700' : data.eta_min <= 15 ? 'text-amber-600' : 'text-foreground',
            )}>
              {data.eta_min <= 0 ? 'Jeden Moment' : `~${data.eta_min} Min`}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Wird berechnet…</div>
          )}
          {data.driver_name && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <Bike className="h-3 w-3" />
              {data.driver_name}
            </div>
          )}
        </div>
        {data.distance_remaining_m !== null && data.distance_remaining_m > 0 && (
          <div className="shrink-0 text-right">
            <div className="text-[9px] text-muted-foreground">verbleibend</div>
            <div className="text-sm font-bold tabular-nums text-foreground">
              {data.distance_remaining_m >= 1000
                ? `${(data.distance_remaining_m / 1000).toFixed(1)} km`
                : `${Math.round(data.distance_remaining_m)} m`}
            </div>
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between px-4 py-3">
        {PHASES.map((phase, idx) => {
          const isActive = idx === phaseIndex;
          const isDone = idx < phaseIndex;
          const Icon = phase.icon;
          return (
            <div key={phase.key} className="flex flex-1 flex-col items-center gap-1">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                isDone
                  ? 'bg-matcha-500 border-matcha-500 text-white'
                  : isActive
                  ? 'bg-white border-matcha-500 text-matcha-600 dark:bg-card shadow-sm'
                  : 'bg-muted border-border text-muted-foreground',
              )}>
                <Icon className={cn('h-4 w-4', isActive && 'animate-pulse')} />
              </div>
              <span className={cn(
                'text-[9px] font-medium text-center leading-tight',
                isActive ? 'text-matcha-700 font-bold' : isDone ? 'text-matcha-600' : 'text-muted-foreground',
              )}>
                {phase.label}
              </span>
              {/* Connector */}
              {idx < PHASES.length - 1 && (
                <div className="absolute" />
              )}
            </div>
          );
        })}
      </div>

      {/* Connector-Linie zwischen Phasen */}
      <div className="relative -mt-8 mb-3 px-8">
        <div className="h-0.5 w-full bg-muted overflow-hidden rounded-full">
          <div
            className="h-full bg-matcha-500 transition-all duration-1000"
            style={{ width: phaseIndex >= 0 ? `${Math.min(100, (phaseIndex / (PHASES.length - 1)) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* Stale-Warnung */}
      {staleSec !== null && staleSec > 60 && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 dark:bg-amber-900/15 border-t">
          <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="text-[10px] text-amber-600">Update vor {Math.round(staleSec / 60)} Min · Verbindung prüfen</span>
        </div>
      )}

      <div className="px-4 py-1.5 bg-muted/30 border-t">
        <p className="text-[9px] text-muted-foreground">20s Live-Update · Storefront Phase 851</p>
      </div>
    </div>
  );
}
