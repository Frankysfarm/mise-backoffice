'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface KuechenSignal {
  signal: 'grün' | 'gelb' | 'rot';
  offeneBestellungen: number;
  inZubereitung: number;
  fertigWartend: number;
  prognoseWarteMin: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const SIGNAL_CONFIG = {
  grün: {
    label: 'Küche frei',
    bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    icon: CheckCircle2,
    iconColor: 'text-green-600 dark:text-green-400',
  },
  gelb: {
    label: 'Küche ausgelastet',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    icon: Clock,
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  rot: {
    label: 'Küche überlastet',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    icon: AlertTriangle,
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

export function DispatchPhase612KuechenStatusOverlay({ locationId }: Props) {
  const [data, setData] = useState<KuechenSignal | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok) setData(json);
    } catch {
      // silent
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data || !locationId) return null;

  const cfg = SIGNAL_CONFIG[data.signal];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.bg} p-3 shadow-sm mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            Küchen-Status
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${cfg.badge}`}>
          <Icon className={`w-3 h-3 ${cfg.iconColor}`} />
          {cfg.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">
            {data.offeneBestellungen}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Offen</div>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">
            {data.inZubereitung}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">In Arbeit</div>
        </div>
        <div className="rounded-lg bg-white/60 dark:bg-white/5 px-2 py-1.5">
          <div className="text-lg font-black tabular-nums text-gray-900 dark:text-gray-100">
            {data.prognoseWarteMin}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Prog. Min</div>
        </div>
      </div>

      {data.signal === 'rot' && (
        <div className="mt-2 text-xs text-red-700 dark:text-red-300 font-medium">
          Küche überlastet — Abholungen ggf. kurz verzögern.
        </div>
      )}
    </div>
  );
}
