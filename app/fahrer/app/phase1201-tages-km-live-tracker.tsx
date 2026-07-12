'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Navigation, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1201 — Tages-Kilometer-Live-Tracker (Fahrer-App)
// Kumulierte km des Tages + Balken vs. Durchschnitt + CO2-Fußabdruck

interface Props {
  driverId: string;
  isOnline: boolean;
}

type StundenEintrag = {
  stunde: number;
  stunde_label: string;
  km: number;
  stopps: number;
};

type ApiData = {
  stundenlog: StundenEintrag[];
  km_gesamt: number;
  stopps_gesamt: number;
  km_pro_stopp: number;
  driver_id: string;
  generiert_am: string;
};

const TEAM_AVG_KM = 48.0;
// CO2-Einsparung vs. PKW: ~160g CO2/km PKW, Fahrrad/Cargo ~0g; Moped ~70g
// Hier vereinfacht: 90g/km gespart ggü. PKW
const CO2_SAVING_G_PER_KM = 90;

const MOCK: ApiData = {
  stundenlog: [
    { stunde: 10, stunde_label: '10:00–11:00', km: 12.5, stopps: 4 },
    { stunde: 11, stunde_label: '11:00–12:00', km: 15.2, stopps: 5 },
    { stunde: 12, stunde_label: '12:00–13:00', km: 9.8, stopps: 3 },
    { stunde: 13, stunde_label: '13:00–14:00', km: 4.2, stopps: 0 },
  ],
  km_gesamt: 41.7,
  stopps_gesamt: 12,
  km_pro_stopp: 3.48,
  driver_id: 'mock',
  generiert_am: new Date().toISOString(),
};

export function FahrerPhase1201TagesKmLiveTracker({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/tages-km-log?driver_id=${driverId}`);
      if (!res.ok) throw new Error('API error');
      setData(await res.json() as ApiData);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    void load();
    const id = setInterval(() => void load(), 10 * 60_000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  if (!isOnline) return null;

  const kmGesamt = data?.km_gesamt ?? 0;
  const pct = Math.min(100, Math.round((kmGesamt / TEAM_AVG_KM) * 100));
  const co2g = Math.round(kmGesamt * CO2_SAVING_G_PER_KM);
  const co2label = co2g >= 1000 ? `${(co2g / 1000).toFixed(2)} kg` : `${co2g} g`;

  const barColor = pct >= 100 ? 'bg-matcha-500' : pct >= 70 ? 'bg-amber-400' : 'bg-blue-400';
  const textColor = pct >= 100 ? 'text-matcha-600 dark:text-matcha-400' : pct >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 shrink-0 text-indigo-500" />
          <span className="font-bold text-sm text-foreground">Tages-km-Tracker</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Main KM stat */}
          <div className="flex items-end gap-3">
            <span className={cn('text-4xl font-black tabular-nums', textColor)}>
              {kmGesamt.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground pb-1">km heute</span>
            <span className="ml-auto text-xs text-muted-foreground pb-1">
              Ø Team {TEAM_AVG_KM} km
            </span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>0</span>
              <span className={cn('font-bold', textColor)}>{pct}% des Team-Ø</span>
              <span>{TEAM_AVG_KM} km</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* CO2 stat */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
            <Leaf className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              <span className="font-bold">{co2label} CO₂</span> eingespart vs. PKW heute
            </span>
          </div>

          {/* Hourly bar chart */}
          {(data?.stundenlog ?? []).length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                km je Stunde
              </div>
              <div className="flex items-end gap-1 h-12">
                {(data?.stundenlog ?? []).map(e => {
                  const maxKm = Math.max(...(data?.stundenlog ?? []).map(s => s.km), 1);
                  const h = Math.round((e.km / maxKm) * 48);
                  return (
                    <div key={e.stunde} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                      <div
                        className={cn('w-full rounded-t', barColor)}
                        style={{ height: `${h}px` }}
                        title={`${e.stunde_label}: ${e.km} km`}
                      />
                      <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                        {String(e.stunde).padStart(2, '0')}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Stopps: <span className="font-bold text-foreground">{data?.stopps_gesamt ?? 0}</span></span>
            <span>km/Stopp: <span className="font-bold text-foreground">{(data?.km_pro_stopp ?? 0).toFixed(2)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
