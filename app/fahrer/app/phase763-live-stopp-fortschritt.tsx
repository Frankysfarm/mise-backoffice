'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation2, Clock } from 'lucide-react';

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface StoppInfo {
  stopp_nr: number;
  gesamt_stopps: number;
  adresse: string;
  entfernung_m: number;
  eta_min: number;
  status: 'unterwegs' | 'angekommen' | 'fertig';
}

const MOCK: StoppInfo = {
  stopp_nr: 2,
  gesamt_stopps: 4,
  adresse: 'Musterstraße 42, Berlin',
  entfernung_m: 850,
  eta_min: 4,
  status: 'unterwegs',
};

function formatDistanz(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function FahrerPhase763LiveStoppFortschritt({ driverId, isOnline }: Props) {
  const [data, setData] = useState<StoppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!driverId || !isOnline) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/driver/aktueller-stopp?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.stopp) { setData(json.stopp); return; }
      }
    } catch { /* fallback */ }
    setData(MOCK);
  }, [driverId, isOnline]);

  useEffect(() => {
    if (!isOnline) { setLoading(false); return; }
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 15_000);
    return () => clearInterval(id);
  }, [laden, isOnline]);

  if (!isOnline || loading || !data) return null;

  const pct = Math.round((data.stopp_nr / data.gesamt_stopps) * 100);

  const navUrl = `https://maps.google.com/?q=${encodeURIComponent(data.adresse)}`;

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold">Aktueller Stopp</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {data.stopp_nr} / {data.gesamt_stopps}
        </span>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-start gap-2 mb-3">
        <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        <span className="text-sm font-medium leading-tight">{data.adresse}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <p className="text-lg font-black tabular-nums">{formatDistanz(data.entfernung_m)}</p>
          <p className="text-[9px] text-muted-foreground">Entfernung</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2 text-center">
          <p className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400">~{data.eta_min} Min</p>
          <p className="text-[9px] text-muted-foreground flex items-center justify-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> ETA
          </p>
        </div>
      </div>

      <a
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-400 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        <Navigation2 className="h-4 w-4" /> Navigieren
      </a>
    </div>
  );
}
