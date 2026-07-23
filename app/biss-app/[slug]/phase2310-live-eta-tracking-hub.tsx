'use client';
import { useEffect, useState } from 'react';

type LoadLevel = 'low' | 'normal' | 'high';

interface ApiData {
  eta_min: number;
  load_level: LoadLevel;
  active_drivers: number;
  queue_position: number | null;
}

const MOCK: ApiData = {
  eta_min: 25,
  load_level: 'normal',
  active_drivers: 3,
  queue_position: null,
};

const LOAD_CONFIG: Record<LoadLevel, { emoji: string; label: string; color: string }> = {
  low:    { emoji: '🟢', label: 'Entspannt',  color: 'text-green-700' },
  normal: { emoji: '🟡', label: 'Normal',     color: 'text-yellow-700' },
  high:   { emoji: '🔴', label: 'Viel los',   color: 'text-red-700' },
};

export function BissPhase2310LiveEtaTrackingHub({
  locationId,
  deliveryTimeMin,
}: {
  locationId: string;
  deliveryTimeMin: number;
}) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/eta?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? { ...MOCK, eta_min: deliveryTimeMin };
  const load = LOAD_CONFIG[d.load_level];

  return (
    <div className="rounded-2xl bg-matcha-600 text-white shadow-md overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-matcha-700/40">
        <span className="relative flex h-3 w-3 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
        </span>
        <span className="text-xs font-semibold tracking-wide uppercase opacity-90">Live-Lieferzeit</span>
      </div>

      <div className="px-4 pb-4 pt-2 space-y-3">
        <div className="flex items-end gap-2">
          <span className="text-5xl font-black tabular-nums leading-none">{d.eta_min}</span>
          <span className="text-lg font-semibold opacity-80 mb-1">Min.</span>
          <span className="ml-auto text-xs opacity-70 mb-1 text-right">geschätzte<br />Lieferzeit</span>
        </div>

        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
          <span className="text-lg flex-shrink-0">{load.emoji}</span>
          <div>
            <div className="text-xs font-semibold">{load.label}</div>
            <div className="text-xs opacity-70">Auslastung gerade</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-sm font-bold">{d.active_drivers}</div>
            <div className="text-xs opacity-70">Fahrer aktiv</div>
          </div>
        </div>

        {d.queue_position !== null && (
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2 text-xs">
            <span className="font-semibold">Warteschlangen-Position:</span>
            <span className="font-black text-sm ml-auto">#{d.queue_position}</span>
          </div>
        )}

        <div className="text-center text-xs opacity-50 pt-1">
          Wird jede Minute aktualisiert
        </div>
      </div>
    </div>
  );
}
