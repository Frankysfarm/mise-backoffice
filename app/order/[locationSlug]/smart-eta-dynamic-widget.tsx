'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, Zap, TrendingUp, CheckCircle2 } from 'lucide-react';

interface EtaData {
  eta_min: number;
  eta_min_low?: number;
  eta_min_high?: number;
  load: 'quiet' | 'normal' | 'busy';
  confidence?: number;
  driver_available?: boolean;
}

interface Props {
  locationId: string;
  className?: string;
  compact?: boolean;
}

const LOAD_CONFIG = {
  quiet: {
    label: 'Kurze Wartezeit',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: Zap,
  },
  normal: {
    label: 'Normale Auslastung',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Clock,
  },
  busy: {
    label: 'Hohe Nachfrage',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: TrendingUp,
  },
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={cn(
              'h-1.5 w-3 rounded-full',
              i <= Math.round(value / 20) ? 'bg-current' : 'bg-current/20'
            )}
          />
        ))}
      </div>
      <span className="text-xs">{value}%</span>
    </div>
  );
}

export function SmartEtaDynamicWidget({ locationId, className, compact = false }: Props) {
  const [eta, setEta] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setEta(data);
          setLastUpdated(new Date());
        } else {
          // Fallback
          setEta({ eta_min: 35, load: 'normal', confidence: 72, driver_available: true });
        }
      } catch {
        setEta({ eta_min: 35, load: 'normal', confidence: 72, driver_available: true });
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className={cn('rounded-xl border border-slate-700/30 bg-slate-800/40 animate-pulse', className)}>
        <div className="p-4 space-y-2">
          <div className="h-8 w-24 bg-slate-700/50 rounded" />
          <div className="h-3 w-40 bg-slate-700/30 rounded" />
        </div>
      </div>
    );
  }

  if (!eta) return null;

  const config = LOAD_CONFIG[eta.load];
  const Icon = config.icon;
  const hasRange = eta.eta_min_low !== undefined && eta.eta_min_high !== undefined;

  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        config.bg, config.border, className
      )}>
        <Bike className={cn('h-4 w-4', config.color)} />
        <span className={cn('text-sm font-bold', config.color)}>
          {hasRange ? `${eta.eta_min_low}–${eta.eta_min_high}` : eta.eta_min} min
        </span>
        <span className="text-xs text-slate-400">Lieferzeit</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border overflow-hidden', config.bg, config.border, className)}>
      <div className="p-4">
        {/* Haupt-ETA */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className={cn('text-4xl font-black tabular-nums', config.color)}>
                {hasRange ? eta.eta_min_low : eta.eta_min}
              </span>
              {hasRange && (
                <>
                  <span className="text-2xl font-bold text-slate-500">–</span>
                  <span className={cn('text-4xl font-black tabular-nums', config.color)}>
                    {eta.eta_min_high}
                  </span>
                </>
              )}
              <span className={cn('text-lg font-semibold ml-0.5', config.color)}>min</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">geschätzte Lieferzeit</p>
          </div>
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', config.bg, 'border', config.border)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
        </div>

        {/* Status-Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', config.bg, config.border, 'border', config.color)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </div>
          {eta.driver_available !== false && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Fahrer verfügbar
            </div>
          )}
        </div>

        {/* Konfidenz */}
        {eta.confidence !== undefined && (
          <div className={cn('flex items-center justify-between mt-3 pt-3 border-t', config.border)}>
            <span className="text-xs text-slate-500">Prognose-Konfidenz</span>
            <div className={cn(config.color)}>
              <ConfidenceBar value={eta.confidence} />
            </div>
          </div>
        )}
      </div>

      {/* Letzte Aktualisierung */}
      {lastUpdated && (
        <div className={cn('px-4 py-1.5 border-t text-xs text-slate-600', config.border)}>
          Aktualisiert: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
