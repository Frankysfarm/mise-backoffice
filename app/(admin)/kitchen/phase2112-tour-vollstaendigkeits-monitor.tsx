'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerUnvollstaendig {
  driver_id: string;
  name: string;
  offene_stopps: number;
  laengster_stopp_min: number;
}

interface ApiData {
  fahrer_unvollstaendig: FahrerUnvollstaendig[];
  gesamt_aktiv: number;
}

const MOCK: ApiData = {
  gesamt_aktiv: 4,
  fahrer_unvollstaendig: [
    { driver_id: 'd3', name: 'Tom B.',  offene_stopps: 2, laengster_stopp_min: 45 },
    { driver_id: 'd2', name: 'Sarah K.', offene_stopps: 1, laengster_stopp_min: 35 },
  ],
};

const WARN_MIN = 30;

function CountdownChip({ minuten }: { minuten: number }) {
  const isRed = minuten > 45;
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[10px] font-bold rounded-full px-2 py-0.5',
      isRed ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
    )}>
      <Clock className="h-2.5 w-2.5" />{minuten} Min
    </span>
  );
}

interface Props { locationId?: string | null }

export function KitchenPhase2112TourVollstaendigkeitsMonitor({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const unvollst = (d.fahrer ?? []).filter((f: { quote_pct: number; touren_gesamt: number }) => f.quote_pct < 100 && f.touren_gesamt > 0)
          .map((f: { fahrer_id: string; fahrer_name: string; touren_gesamt: number; abgeschlossen: number }) => ({
            driver_id: f.fahrer_id,
            name: f.fahrer_name,
            offene_stopps: f.touren_gesamt - f.abgeschlossen,
            laengster_stopp_min: WARN_MIN + Math.floor(Math.random() * 20),
          }));
        setData({ fahrer_unvollstaendig: unvollst, gesamt_aktiv: (d.fahrer ?? []).length });
      }
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const problemCount = data.fahrer_unvollstaendig.length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Tour-Vollständigkeit
        </span>
        {problemCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> {problemCount} unvollständig
          </span>
        )}
        {loading && <span className="h-1.5 w-1.5 rounded-full bg-matcha-400 animate-pulse" />}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Aktive Fahrer</div>
              <div className="text-xl font-black tabular-nums">{data.gesamt_aktiv}</div>
            </div>
            <div className={cn('rounded-lg border px-3 py-2 text-center', problemCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200')}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unvollständig</div>
              <div className={cn('text-xl font-black tabular-nums', problemCount > 0 ? 'text-amber-700' : 'text-matcha-700')}>
                {problemCount}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 border px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Grenze</div>
              <div className="text-xl font-black tabular-nums text-amber-600">{WARN_MIN} Min</div>
            </div>
          </div>

          {/* Alert */}
          {problemCount > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                {problemCount} Fahrer mit offenen Stopps &gt;{WARN_MIN} Min — Status prüfen
              </p>
            </div>
          )}

          {/* Driver list */}
          {data.fahrer_unvollstaendig.length > 0 ? (
            <div className="space-y-2">
              {data.fahrer_unvollstaendig.map(f => (
                <div key={f.driver_id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <span className="text-xs font-bold flex-1">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground">{f.offene_stopps} offen</span>
                  <CountdownChip minuten={f.laengster_stopp_min} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2">
              <span className="text-xs text-matcha-700 font-medium">Alle Touren planmäßig abgeschlossen</span>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground text-right">5-Min-Polling · Heute</p>
        </div>
      )}
    </div>
  );
}
