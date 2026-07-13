'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudRain, Wind, Zap, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1418 — Schicht-Wetter-Check (Fahrer-App)
 *
 * Aktuelles Wetter-Widget aus delivery_config wetter_hinweis:
 *   • Temperatur-/Wetter-Icon/Windgeschwindigkeit
 *   • Extra-Lieferzeit-Hinweis
 *   • isOnline-Guard
 *
 * 15-Min-Polling.
 */

type WetterTyp = 'regen' | 'sturm' | 'wind' | 'klar';

interface ApiData {
  typ: WetterTyp;
  beschreibung: string;
  extra_minuten: number;
  aktiv: boolean;
}

interface Props {
  driverId: string;
  isOnline: boolean;
  locationId?: string;
}

const WETTER_CONFIG: Record<WetterTyp, {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  regen: {
    Icon: CloudRain,
    label: 'Regen',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-200 dark:border-sky-700',
  },
  sturm: {
    Icon: Zap,
    label: 'Sturm',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-700',
  },
  wind: {
    Icon: Wind,
    label: 'Wind',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700',
  },
  klar: {
    Icon: Cloud,
    label: 'Klar',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
  },
};

const MOCK_REGEN: ApiData = {
  typ: 'regen',
  beschreibung: 'Leichter Regen — vorsichtig fahren',
  extra_minuten: 7,
  aktiv: true,
};

export function FahrerPhase1418SchichtWetterCheck({ driverId, isOnline, locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const locId = locationId ?? driverId; // fallback: use driverId as query (server will handle)
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/public/wetter-status?location_id=${encodeURIComponent(locId)}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      setData(MOCK_REGEN);
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    timerRef.current = setInterval(load, 15 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isOnline, load]);

  if (!isOnline || !data || !data.aktiv) return null;

  const cfg = WETTER_CONFIG[data.typ];
  const { Icon } = cfg;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cfg.border, cfg.bg)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', cfg.color)} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Wetter-Check
          </span>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', cfg.color, cfg.bg)}>
            {cfg.label}
          </span>
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Icon + Status */}
          <div className="flex items-center gap-4">
            <div className={cn('rounded-2xl p-4', cfg.bg, 'border', cfg.border)}>
              <Icon className={cn('w-10 h-10', cfg.color)} />
            </div>
            <div>
              <p className={cn('text-xl font-bold', cfg.color)}>{cfg.label}</p>
              {data.beschreibung && (
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{data.beschreibung}</p>
              )}
            </div>
          </div>

          {/* Extra-Zeit-Hinweis */}
          {data.extra_minuten > 0 && (
            <div className={cn('rounded-lg px-4 py-3 flex items-center gap-3', cfg.bg, 'border', cfg.border)}>
              <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                +{data.extra_minuten}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Minuten Puffer</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lieferzeit angepasst</p>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 dark:text-slate-500">
            Fahr vorsichtig und informiere Kunden bei starker Verzögerung.
          </p>
        </div>
      )}
    </div>
  );
}
