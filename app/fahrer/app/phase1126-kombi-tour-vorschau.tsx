'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Route, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1126 — Kombi-Tour-Vorschau (Fahrer-App)
// Vorschau welche Stopps in der nächsten Bündelungs-Tour zusammengefasst werden könnten

interface Props {
  driverId: string;
  isOnline: boolean;
}

type KombiStopp = {
  order_id: string;
  adresse: string;
  zone: string;
  eta_min: number;
  items_count: number;
};

type ApiData = {
  stopps: KombiStopp[];
  gesamt_stopps: number;
  geschaetzte_tour_min: number;
  bündelungs_vorteil_min: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  stopps: [
    { order_id: 'o1', adresse: 'Hauptstr. 12, 10115 Berlin', zone: 'A', eta_min: 8, items_count: 2 },
    { order_id: 'o2', adresse: 'Parkweg 5, 10117 Berlin',    zone: 'A', eta_min: 12, items_count: 1 },
    { order_id: 'o3', adresse: 'Bergstr. 22, 10119 Berlin',  zone: 'A', eta_min: 18, items_count: 3 },
  ],
  gesamt_stopps: 3,
  geschaetzte_tour_min: 28,
  bündelungs_vorteil_min: 12,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

export function FahrerPhase1126KombiTourVorschau({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/driver/kombi-tour-vorschau?driver_id=${driverId}`);
      if (r.ok) setData(await r.json() as ApiData);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [driverId, isOnline]);

  useEffect(() => { void load(); }, [load]);

  if (!isOnline) return null;

  const d = data ?? MOCK;

  if (d.gesamt_stopps === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-violet-500 shrink-0" />
          <span className="font-bold text-sm text-violet-700 dark:text-violet-300">
            Kombi-Tour-Vorschau
          </span>
          <span className="rounded-full bg-violet-500 text-white text-[10px] font-black px-2 py-0.5">
            {d.gesamt_stopps} Stopps
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-violet-500" /> : <ChevronDown className="h-4 w-4 text-violet-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Summary pills */}
          <div className="flex gap-2 flex-wrap">
            <div className="rounded-lg bg-white dark:bg-black/20 border border-violet-200 dark:border-violet-700 px-3 py-1.5 text-center">
              <div className="text-xs font-black text-violet-700 dark:text-violet-300 tabular-nums">{d.geschaetzte_tour_min} Min</div>
              <div className="text-[9px] text-muted-foreground">Gesamt-Tour</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-black/20 border border-violet-200 dark:border-violet-700 px-3 py-1.5 text-center">
              <div className="text-xs font-black text-green-600 dark:text-green-400 tabular-nums">−{d.bündelungs_vorteil_min} Min</div>
              <div className="text-[9px] text-muted-foreground">Zeitersparnis</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-black/20 border border-violet-200 dark:border-violet-700 px-3 py-1.5 text-center">
              <div className="text-xs font-black text-foreground tabular-nums">{d.gesamt_stopps}</div>
              <div className="text-[9px] text-muted-foreground">Stopps</div>
            </div>
          </div>

          {/* Stop list */}
          <div className="space-y-2">
            {d.stopps.map((s, i) => (
              <div key={s.order_id}
                className="flex items-start gap-3 rounded-lg bg-white dark:bg-black/20 border border-violet-200 dark:border-violet-700 px-3 py-2.5">
                <div className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.adresse}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Zone {s.zone}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">~{s.eta_min} Min</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <PackageCheck className="h-3 w-3 text-violet-400" />
                  <span className="text-[10px] text-muted-foreground">{s.items_count}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Vorschau — endgültige Zuweisung durch Dispatch
          </p>
        </div>
      )}
    </div>
  );
}
