'use client';

import { useEffect, useState } from 'react';
import { Bike, Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  locationId: string;
  defaultEtaMin?: number;
}

interface EtaData {
  etaMin: number;
  trend: 'besser' | 'schlechter' | 'stabil';
  deltaMin: number;
  activeDrivers: number;
  activeOrders: number;
  label: string;
}

const MOCK_ETA: EtaData = {
  etaMin: 28,
  trend: 'stabil',
  deltaMin: 0,
  activeDrivers: 3,
  activeOrders: 7,
  label: 'Normale Auslastung',
};

function etaColor(eta: number): string {
  if (eta <= 25) return 'text-matcha-600 dark:text-matcha-400';
  if (eta <= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function etaBg(eta: number): string {
  if (eta <= 25) return 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-200 dark:border-matcha-800';
  if (eta <= 40) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
}

export function Phase649LiveLieferzeitIndikator({ locationId, defaultEtaMin = 30 }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`/api/delivery/eta-live?location_id=${locationId}`);
        if (r.ok && !cancelled) {
          const raw = await r.json();
          setData({
            etaMin: raw.eta_min ?? defaultEtaMin,
            trend: raw.trend ?? 'stabil',
            deltaMin: raw.delta_min ?? 0,
            activeDrivers: raw.active_drivers ?? 0,
            activeOrders: raw.active_orders ?? 0,
            label: raw.label ?? 'Live-Schätzung',
          });
          setLastUpdated(Date.now());
        }
      } catch {
        if (!cancelled) {
          setData({ ...MOCK_ETA, etaMin: defaultEtaMin });
        }
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId, defaultEtaMin]);

  const eta = data ?? { ...MOCK_ETA, etaMin: defaultEtaMin };

  const TrendIcon =
    eta.trend === 'besser' ? TrendingDown :
    eta.trend === 'schlechter' ? TrendingUp :
    Minus;

  const trendLabel =
    eta.trend === 'besser' ? `−${Math.abs(eta.deltaMin)} Min schneller` :
    eta.trend === 'schlechter' ? `+${Math.abs(eta.deltaMin)} Min langsamer` :
    'Stabile Lieferzeit';

  const trendColor =
    eta.trend === 'besser' ? 'text-matcha-600 dark:text-matcha-400' :
    eta.trend === 'schlechter' ? 'text-red-500 dark:text-red-400' :
    'text-gray-500 dark:text-gray-400';

  return (
    <div className={`rounded-xl border p-4 ${etaBg(eta.etaMin)}`}>
      <div className="flex items-center gap-2 mb-3">
        <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">
          Aktuelle Lieferzeit
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">Live</span>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className={`text-4xl font-black tabular-nums leading-none ${etaColor(eta.etaMin)}`}>
            {eta.etaMin}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">Minuten</div>
        </div>

        <div className="flex-1 pb-1 space-y-1">
          <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">{trendLabel}</span>
          </div>
          <div className="text-xs text-muted-foreground">{eta.label}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 pt-3 border-t border-current/10">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bike className="h-3.5 w-3.5" />
          <span className="font-semibold">{eta.activeDrivers} Fahrer aktiv</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-semibold">{eta.activeOrders} offene Aufträge</span>
        </div>
      </div>
    </div>
  );
}
