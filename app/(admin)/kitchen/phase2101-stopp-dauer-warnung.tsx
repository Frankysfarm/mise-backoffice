'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerRow {
  driver_id: string;
  name: string;
  median_min: number;
  avg_min: number;
  stopps_heute: number;
  outlier_count: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_median_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_median_min: 3.6,
  alert_count: 1,
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   median_min: 2.1, avg_min: 2.4, stopps_heute: 14, outlier_count: 1, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', median_min: 3.8, avg_min: 4.1, stopps_heute: 11, outlier_count: 2, alert: false },
    { driver_id: 'd3', name: 'Tom B.',   median_min: 5.7, avg_min: 6.3, stopps_heute: 9,  outlier_count: 4, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  median_min: 2.8, avg_min: 3.0, stopps_heute: 13, outlier_count: 1, alert: false },
  ],
};

const THRESHOLD = 5;

interface Props { locationId?: string | null }

export function KitchenPhase2101StoppDauerWarnung({ locationId }: Props) {
  const [open, setOpen]     = useState(true);
  const [data, setData]     = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/stopp-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const outliers = data.fahrer.filter(f => f.median_min > THRESHOLD || f.outlier_count >= 3);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Stopp-Dauer-Warnung</span>
        {outliers.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> {outliers.length}
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Team-Median</div>
              <div className={cn('text-lg font-black tabular-nums', data.team_median_min > THRESHOLD ? 'text-red-600' : 'text-foreground')}>
                {data.team_median_min.toFixed(1)}<span className="text-xs font-normal ml-0.5">Min</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Warnungen</div>
              <div className={cn('text-lg font-black tabular-nums', outliers.length > 0 ? 'text-red-600' : 'text-matcha-600')}>
                {outliers.length}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Schwelle</div>
              <div className="text-lg font-black text-amber-600">&gt;{THRESHOLD}<span className="text-xs font-normal ml-0.5">Min</span></div>
            </div>
          </div>

          {/* Alert banner */}
          {outliers.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700">Fahrer verweilen zu lange am Stopp!</p>
                <p className="text-[10px] text-red-600 mt-0.5">
                  {outliers.map(f => f.name).join(', ')} — Dispatch informieren
                </p>
              </div>
            </div>
          )}

          {/* Outlier list */}
          {outliers.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fahrer mit langen Stopp-Zeiten</div>
              {outliers.map(f => (
                <div key={f.driver_id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
                  <UserX className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-xs font-bold flex-1">{f.name}</span>
                  <span className="text-xs font-black text-red-600 tabular-nums">{f.median_min.toFixed(1)} Min Median</span>
                  <span className="text-[9px] text-red-500">{f.outlier_count} Ausreißer</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 text-center">
              <p className="text-xs text-matcha-700 font-medium">Alle Fahrer im grünen Bereich</p>
            </div>
          )}

          {/* All drivers mini */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Alle Fahrer</div>
            {data.fahrer.map(f => (
              <div key={f.driver_id} className="flex items-center gap-2 text-[10px]">
                <span className={cn('font-medium w-20 truncate', f.median_min > THRESHOLD ? 'text-red-600 font-bold' : 'text-foreground')}>{f.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-black/8 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', f.median_min <= 3 ? 'bg-matcha-500' : f.median_min <= THRESHOLD ? 'bg-amber-400' : 'bg-red-500')}
                    style={{ width: `${Math.min((f.median_min / (THRESHOLD * 2)) * 100, 100)}%` }}
                  />
                </div>
                <span className="tabular-nums font-bold w-12 text-right">{f.median_min.toFixed(1)} Min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
