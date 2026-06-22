'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Package, ShoppingBag, User, MapPin, Clock } from 'lucide-react';

interface TrackingData {
  status: string;
  driver_name?: string;
  eta_minutes?: number;
  distance_km?: number;
  driver_lat?: number;
  driver_lng?: number;
}

type PipelineStep = 'bestellt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

const PIPELINE: PipelineStep[] = ['bestellt', 'in_zubereitung', 'unterwegs', 'geliefert'];

const PIPELINE_META: Record<PipelineStep, { label: string; icon: React.ElementType }> = {
  bestellt:       { label: 'Bestellt',      icon: ShoppingBag },
  in_zubereitung: { label: 'In Zubereitung', icon: ChefHat },
  unterwegs:      { label: 'Unterwegs',      icon: Bike },
  geliefert:      { label: 'Geliefert',      icon: CheckCircle2 },
};

const API_STATUS_MAP: Record<string, PipelineStep> = {
  loading:        'bestellt',
  in_preparation: 'in_zubereitung',
  preparing:      'in_zubereitung',
  ready:          'unterwegs',
  in_delivery:    'unterwegs',
  out_for_delivery: 'unterwegs',
  delivered:      'geliefert',
  completed:      'geliefert',
};

const MOCK_DATA: TrackingData = {
  status: 'in_delivery',
  driver_name: 'Marco',
  eta_minutes: 12,
  distance_km: 1.4,
};

function toPipelineStep(status: string): PipelineStep {
  return API_STATUS_MAP[status] ?? 'bestellt';
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function distanceLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function proximityMinutes(km: number): number {
  return Math.max(1, Math.round((km / 30) * 60));
}

function StatusHeader({ step, driverName }: { step: PipelineStep; driverName?: string }) {
  const headlines: Record<PipelineStep, string> = {
    bestellt:       'Bestellung eingegangen',
    in_zubereitung: 'Wird zubereitet',
    unterwegs:      'Fahrer ist unterwegs!',
    geliefert:      'Geliefert — Guten Appetit!',
  };
  const colors: Record<PipelineStep, string> = {
    bestellt:       'text-blue-400',
    in_zubereitung: 'text-amber-400',
    unterwegs:      'text-matcha-500',
    geliefert:      'text-emerald-400',
  };
  const bgColors: Record<PipelineStep, string> = {
    bestellt:       'bg-blue-500/15 border-blue-500/30',
    in_zubereitung: 'bg-amber-500/15 border-amber-500/30',
    unterwegs:      'bg-matcha-500/15 border-matcha-500/30',
    geliefert:      'bg-emerald-500/15 border-emerald-500/30',
  };
  const Icon = PIPELINE_META[step].icon;

  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', bgColors[step])}>
        <Icon className={cn('h-5 w-5', colors[step])} />
      </div>
      <div className="min-w-0">
        <p className={cn('text-sm font-black leading-tight', colors[step])}>{headlines[step]}</p>
        {driverName && step === 'unterwegs' && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
            <User className="h-3 w-3 shrink-0" />
            {driverName}
          </p>
        )}
      </div>
    </div>
  );
}

function EtaBlock({ etaSeconds, distanceKm }: { etaSeconds: number; distanceKm?: number }) {
  const minutes = Math.ceil(etaSeconds / 60);
  const isImminent = etaSeconds <= 60;

  return (
    <div className="flex items-stretch gap-3">
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-matcha-500/10 border border-matcha-500/20 py-4 px-3">
        <span className="font-mono text-3xl font-black text-white tabular-nums leading-none">
          {isImminent ? (
            <span className="text-matcha-400 animate-pulse">~1</span>
          ) : (
            formatEta(etaSeconds)
          )}
        </span>
        <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/35">
          {isImminent ? 'Jeden Moment' : 'Verbleibend'}
        </span>
      </div>

      {distanceKm != null && (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl bg-white/5 border border-white/10 py-4 px-3">
          <MapPin className="mb-1 h-4 w-4 text-matcha-400" />
          <span className="text-sm font-black text-white leading-none">{distanceLabel(distanceKm)}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-white/35">
            Entfernung
          </span>
        </div>
      )}
    </div>
  );
}

function ProximityBadge({ distanceKm, driverName }: { distanceKm: number; driverName?: string }) {
  const mins = proximityMinutes(distanceKm);
  return (
    <div className="flex items-center gap-2 rounded-xl bg-matcha-600/20 border border-matcha-600/30 px-3 py-2.5">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-matcha-500" />
      </span>
      <p className="text-xs font-bold text-matcha-200 leading-snug">
        {driverName ? `${driverName} ist` : 'Fahrer ist'}{' '}
        <span className="text-white">{mins} {mins === 1 ? 'Min' : 'Min'}</span>{' '}
        von dir entfernt
      </p>
    </div>
  );
}

function PipelineBar({ step }: { step: PipelineStep }) {
  const activeIdx = PIPELINE.indexOf(step);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0">
        {PIPELINE.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          const Icon = PIPELINE_META[s].icon;
          return (
            <div key={s} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] transition-all duration-300',
                  done
                    ? 'border-matcha-500 bg-matcha-600 text-white'
                    : active
                    ? 'border-matcha-400 bg-matcha-500/20 text-matcha-300 ring-2 ring-matcha-400/40 ring-offset-1 ring-offset-slate-950'
                    : 'border-white/15 bg-white/5 text-white/30',
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              {i < PIPELINE.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-0.5 rounded-full transition-all duration-500',
                    done ? 'bg-matcha-500' : 'bg-white/10',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-start">
        {PIPELINE.map((s, i) => (
          <div
            key={s}
            className={cn(
              'flex-1 truncate px-0.5 text-center text-[8px] font-bold',
              i === activeIdx ? 'text-matcha-400' : i < activeIdx ? 'text-white/40' : 'text-white/20',
            )}
          >
            {PIPELINE_META[s].label}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliveredState() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border-2 border-emerald-500">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-black text-emerald-300">Zugestellt</p>
        <p className="text-xs text-white/40">Guten Appetit!</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-white/8" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-40 rounded bg-white/8" />
          <div className="h-2.5 w-24 rounded bg-white/5" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-20 flex-1 rounded-xl bg-white/5" />
        <div className="h-20 flex-1 rounded-xl bg-white/5" />
      </div>
      <div className="h-10 rounded-xl bg-white/5" />
    </div>
  );
}

export function FahrerLiveTracker({ orderId }: { orderId: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/tracking`, { cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const json: TrackingData = await res.json();
      setData(json);
      if (json.eta_minutes != null) {
        setEtaSeconds((prev) => {
          if (prev == null) return json.eta_minutes! * 60;
          return prev;
        });
      }
      setUseMock(false);
    } catch {
      if (!data) {
        setData(MOCK_DATA);
        setEtaSeconds(MOCK_DATA.eta_minutes! * 60);
        setUseMock(true);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
    const poll = setInterval(fetchTracking, 15_000);
    return () => clearInterval(poll);
  }, [fetchTracking]);

  useEffect(() => {
    if (etaSeconds == null || etaSeconds <= 0) return;
    const tick = setInterval(() => setEtaSeconds((s) => (s != null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, [etaSeconds != null]);

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!data) return null;

  const step = toPipelineStep(data.status);
  const isDelivered = step === 'geliefert';
  const isUnterwegs = step === 'unterwegs';

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden border bg-gradient-to-br from-slate-900 to-slate-950 p-5 space-y-4 transition-all duration-500',
        isUnterwegs ? 'border-matcha-500/30' : 'border-white/10',
      )}
    >
      <StatusHeader step={step} driverName={data.driver_name} />

      {isDelivered ? (
        <DeliveredState />
      ) : (
        <>
          {etaSeconds != null && (
            <EtaBlock etaSeconds={etaSeconds} distanceKm={data.distance_km} />
          )}

          {isUnterwegs && data.distance_km != null && (
            <ProximityBadge distanceKm={data.distance_km} driverName={data.driver_name} />
          )}

          {useMock && (
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <p className="text-[11px] text-white/40">Alles läuft nach Plan</p>
            </div>
          )}
        </>
      )}

      <PipelineBar step={step} />
    </div>
  );
}
