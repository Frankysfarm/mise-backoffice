'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, Lightbulb, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEinnahmenPerf {
  fahrer_id: string;
  name: string;
  verdienst_eur: number;
  trinkgeld_eur: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta_eur: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEinnahmenPerf[];
  team_durchschnitt_eur: number;
}

const TIPPS: Record<string, string> = {
  top: 'Spitzenleistung! Du liegst über dem Team-Ø. Weiter so!',
  normal: 'Guter Tag! Mehr Touren in der Rush-Hour steigern deinen Verdienst.',
  niedrig: 'Heute noch Luft nach oben. Aktiv auf Aufträge warten und schnell reagieren.',
};

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'fallend') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function FahrerPhase2195MeinVerdienstHeute({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-einnahmen-performance?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-einnahmen-performance';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find((f) => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const ratio = data.team_durchschnitt_eur > 0 ? me.verdienst_eur / data.team_durchschnitt_eur : 1;
  const tippKey = ratio >= 1.1 ? 'top' : ratio >= 0.6 ? 'normal' : 'niedrig';
  const color = ratio >= 1.0 ? 'text-green-600' : ratio >= 0.5 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Mein Verdienst Heute</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className={cn('text-3xl font-bold', color)}>
                {me.verdienst_eur > 0 ? fmt(me.verdienst_eur) : '–'}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                + {fmt(me.trinkgeld_eur)} Trinkgeld
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{me.touren_heute} Touren heute</div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex justify-end">
                <TrendIcon trend={me.trend} />
              </div>
              <div className="text-xs text-gray-400">
                Δ {me.trend_delta_eur >= 0 ? '+' : ''}{fmt(me.trend_delta_eur)} vs. 7d-Ø
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                <Euro className="w-3 h-3" />
                Team-Ø {fmt(data.team_durchschnitt_eur)}
              </div>
              {me.rang === 1 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">#1 im Team ★</div>
              )}
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={cn('h-2 rounded-full transition-all', ratio >= 1.0 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-yellow-500' : 'bg-red-500')}
              style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 text-right">{Math.round(ratio * 100)}% von Team-Ø</div>

          <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
            <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
            <span>{TIPPS[tippKey]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
