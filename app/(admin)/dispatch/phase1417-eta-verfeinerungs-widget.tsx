'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw, ChevronDown, ChevronUp, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1417 — ETA-Verfeinerungs-Widget (Dispatch)
 *
 * Zeigt Phase1410-API (/api/delivery/public/eta-verfeinert):
 *   • Basis-ETA vs. verfeinerte ETA
 *   • Faktoren-Aufschlüsselung (Wetter / Queue / Fahrer)
 *   • Status-Ampel normal/erhoecht/hoch
 *
 * 5-Min-Polling. Nach Phase1412 in dispatch/client.tsx.
 */

interface ApiData {
  basis_eta_min: number;
  verfeinerte_eta_min: number;
  faktoren: {
    wetter_zusatz: number;
    queue_zusatz: number;
    fahrer_abzug: number;
  };
  status: 'normal' | 'erhoecht' | 'hoch';
  hinweis: string | null;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG = {
  normal: {
    label: 'Normal',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    dot: 'bg-emerald-500',
  },
  erhoecht: {
    label: 'Erhöht',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    dot: 'bg-amber-500',
  },
  hoch: {
    label: 'Hoch',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-700',
    dot: 'bg-rose-500',
  },
};

const MOCK: ApiData = {
  basis_eta_min: 30,
  verfeinerte_eta_min: 35,
  faktoren: { wetter_zusatz: 5, queue_zusatz: 3, fahrer_abzug: -3 },
  status: 'erhoecht',
  hinweis: 'Leicht erhöhtes Bestellaufkommen',
  location_id: 'mock',
  generiert_am: new Date().toISOString(),
};

export function DispatchPhase1417EtaVerfeinerungsWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/public/eta-verfeinert?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!locationId) return null;

  const cfg = data ? STATUS_CONFIG[data.status] : STATUS_CONFIG.normal;
  const delta = data ? data.verfeinerte_eta_min - data.basis_eta_min : 0;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cfg.border, cfg.bg)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className={cn('w-4 h-4', cfg.color)} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            ETA-Verfeinerung
          </span>
          {data && (
            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
              {data.verfeinerte_eta_min} Min
            </span>
          )}
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3">
          {/* Basis vs. verfeinert */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Basis-ETA</p>
              <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {data.basis_eta_min}<span className="text-sm font-normal ml-1">Min</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 p-3 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Verfeinert</p>
              <p className={cn('text-2xl font-bold', cfg.color)}>
                {data.verfeinerte_eta_min}<span className="text-sm font-normal ml-1">Min</span>
              </p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center justify-center gap-0.5">
                {delta > 0 ? (
                  <><TrendingUp className="w-3 h-3 text-amber-500" /> +{delta} Min</>
                ) : delta < 0 ? (
                  <><TrendingUp className="w-3 h-3 rotate-180 text-emerald-500" /> {delta} Min</>
                ) : (
                  <><Minus className="w-3 h-3" /> Unverändert</>
                )}
              </p>
            </div>
          </div>

          {/* Faktoren */}
          <div className="rounded-lg bg-white/60 dark:bg-slate-800/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Faktoren</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">🌧 Wetter</span>
              <span className={cn('font-semibold', data.faktoren.wetter_zusatz > 0 ? 'text-amber-600' : 'text-slate-400')}>
                {data.faktoren.wetter_zusatz > 0 ? `+${data.faktoren.wetter_zusatz}` : '±0'} Min
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">📋 Warteschlange</span>
              <span className={cn('font-semibold', data.faktoren.queue_zusatz > 0 ? 'text-amber-600' : 'text-slate-400')}>
                {data.faktoren.queue_zusatz > 0 ? `+${data.faktoren.queue_zusatz}` : '±0'} Min
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">🚴 Fahrer verfügbar</span>
              <span className={cn('font-semibold', data.faktoren.fahrer_abzug < 0 ? 'text-emerald-600' : 'text-slate-400')}>
                {data.faktoren.fahrer_abzug < 0 ? `${data.faktoren.fahrer_abzug}` : '±0'} Min
              </span>
            </div>
          </div>

          {/* Hinweis & Status */}
          {data.hinweis && (
            <div className={cn('rounded-lg px-3 py-2 text-xs', cfg.color, cfg.bg)}>
              <span className="mr-1">ℹ️</span>{data.hinweis}
            </div>
          )}

          {lastUpdate && (
            <p className="text-[10px] text-slate-400 text-right">
              Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
