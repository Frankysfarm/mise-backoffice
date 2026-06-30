'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Loader2, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';

type StationType = 'grill' | 'kalt' | 'getraenke' | 'allgemein';
type StationLoad = 'idle' | 'normal' | 'busy' | 'overloaded';

interface StationData {
  stationType: StationType;
  label: string;
  itemsInPrep: number;
  itemsCompleted: number;
  avgEstMinutes: number;
  avgActualMinutes: number | null;
  efficiencyPct: number | null;
  loadLevel: StationLoad;
}

interface ApiResponse {
  ok: boolean;
  stations: StationData[];
  totalInPrep: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const loadStyle: Record<StationLoad, { bg: string; badge: string; label: string; bar: string }> = {
  idle:       { bg: 'bg-stone-50',  badge: 'bg-stone-100 text-stone-500',  label: 'Ruhig',      bar: 'bg-stone-300' },
  normal:     { bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700',  label: 'Normal',     bar: 'bg-green-500' },
  busy:       { bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',  label: 'Ausgelastet',bar: 'bg-amber-400' },
  overloaded: { bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700',      label: 'Überlastet', bar: 'bg-red-500' },
};

const stationIcon: Record<StationType, string> = {
  grill:     '🔥',
  kalt:      '🥗',
  getraenke: '🥤',
  allgemein: '🍽️',
};

function EffBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-stone-400">keine Daten</span>;
  const clamped = Math.min(150, Math.max(0, pct));
  const color = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, clamped)}%` }} />
      </div>
      <span className={cn('text-[11px] font-bold', pct >= 90 ? 'text-green-700' : pct >= 70 ? 'text-amber-600' : 'text-red-600')}>
        {pct}%
      </span>
    </div>
  );
}

export function KitchenStationsEffizienz({ locationId }: Props) {
  const [stations, setStations] = useState<StationData[]>([]);
  const [totalInPrep, setTotalInPrep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-stations-effizienz?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setStations(d.stations ?? []);
        setTotalInPrep(d.totalInPrep ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const overloadedStations = stations.filter((s) => s.loadLevel === 'overloaded');
  const busyStations = stations.filter((s) => s.loadLevel === 'busy');

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Thermometer className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Stations-Effizienz</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {overloadedStations.length > 0 && (
          <span className="ml-auto rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-[10px] font-bold animate-pulse">
            {overloadedStations.map((s) => s.label).join(', ')} überlastet
          </span>
        )}
        {overloadedStations.length === 0 && busyStations.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2.5 py-0.5 text-[10px] font-bold">
            {busyStations.length} Station{busyStations.length > 1 ? 'en' : ''} ausgelastet
          </span>
        )}
        {overloadedStations.length === 0 && busyStations.length === 0 && !loading && (
          <span className="ml-auto text-[10px] text-muted-foreground">{totalInPrep} Positionen in Zubereitung</span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Station Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y divide-stone-100 sm:divide-y-0">
            {stations.map((st) => {
              const s = loadStyle[st.loadLevel];
              const maxItems = { grill: 12, kalt: 16, getraenke: 20, allgemein: 10 }[st.stationType];
              const barPct = Math.min(100, Math.round((st.itemsInPrep / maxItems) * 100));

              return (
                <div key={st.stationType} className={cn('px-5 py-4 border-stone-100', s.bg, 'sm:border-r last:border-r-0')}>
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{stationIcon[st.stationType]}</span>
                    <div>
                      <div className="font-semibold text-sm">{st.label}</div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', s.badge)}>
                        {s.label}
                      </span>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="font-mono text-xl font-black tabular-nums">{st.itemsInPrep}</div>
                      <div className="text-[9px] text-stone-400">in Zubereitung</div>
                    </div>
                  </div>

                  {/* Load Bar */}
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden mb-3">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-500">Abgeschlossen (2h)</span>
                      <span className="text-[11px] font-bold">{st.itemsCompleted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-500">Ø Soll-Zeit</span>
                      <span className="text-[11px] font-bold">{st.avgEstMinutes} Min</span>
                    </div>
                    {st.avgActualMinutes !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-stone-500">Ø Ist-Zeit</span>
                        <span className="text-[11px] font-bold">{st.avgActualMinutes} Min</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-500">Effizienz</span>
                      <EffBar pct={st.efficiencyPct} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-5 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-2">
            <ChefHat className="h-3.5 w-3.5 text-stone-400" />
            <span className="text-[10px] text-stone-500">
              Klassifizierung basiert auf Artikelname · Effizienz = Soll ÷ Ist × 100 · Letzte 2h
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
