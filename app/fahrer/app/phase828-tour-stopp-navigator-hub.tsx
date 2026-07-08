'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  reihenfolge: number;
  order_id: string;
  angekommen_am: string | null;
  geliefert_am: string | null;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  onNavigate?: (stop: Stop) => void;
  onComplete?: (stopId: string) => void;
}

export function FahrerPhase828TourStoppNavigatorHub({ stops, onNavigate, onComplete }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const sorted = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const doneCount = sorted.filter((s) => !!s.geliefert_am).length;
  const totalCount = sorted.length;
  const nextStop = sorted.find((s) => !s.geliefert_am);
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Mock stops if none provided
  const MOCK_STOPS: Stop[] = [
    { id: 's1', reihenfolge: 1, order_id: 'o1', angekommen_am: new Date(Date.now() - 5 * 60_000).toISOString(), geliefert_am: new Date(Date.now() - 3 * 60_000).toISOString(), kunde_name: 'Maria S.', kunde_adresse: 'Hauptstr. 12', eta_min: 0 },
    { id: 's2', reihenfolge: 2, order_id: 'o2', angekommen_am: null, geliefert_am: null, kunde_name: 'Thomas B.', kunde_adresse: 'Bahnhofstr. 7', eta_min: 4 },
    { id: 's3', reihenfolge: 3, order_id: 'o3', angekommen_am: null, geliefert_am: null, kunde_name: 'Julia K.', kunde_adresse: 'Gartenweg 3', eta_min: 11 },
  ];

  const display = sorted.length > 0 ? sorted : MOCK_STOPS;
  const displayDone = display.filter((s) => !!s.geliefert_am).length;
  const displayNext = display.find((s) => !s.geliefert_am);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50 border-blue-100">
        <Navigation className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-bold text-blue-800">Tour-Stopps Navigator</span>
        <span className="ml-auto text-[10px] text-blue-600 font-bold">
          {displayDone}/{display.length} erledigt
        </span>
      </div>

      {/* Fortschrittsleiste */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-stone-400">Tour-Fortschritt</span>
          <span className="text-[10px] font-bold text-matcha-700">
            {totalCount > 0 ? progressPct : Math.round((displayDone / display.length) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? progressPct : Math.round((displayDone / display.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-stone-50 px-2 pb-2">
        {display.map((s) => {
          const done = !!s.geliefert_am;
          const isNext = s.id === (displayNext?.id);
          return (
            <div
              key={s.id}
              className={cn(
                'flex items-start gap-3 px-2 py-2.5 rounded-xl transition-colors',
                done ? 'opacity-60' : isNext ? 'bg-blue-50 border border-blue-100' : ''
              )}
            >
              {/* Stopp-Nummer */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black',
                done ? 'bg-matcha-100 text-matcha-600' :
                isNext ? 'bg-blue-500 text-white shadow-md' :
                'bg-stone-100 text-stone-500'
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.reihenfolge}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    'text-xs font-bold truncate',
                    done ? 'line-through text-stone-400' : 'text-stone-800'
                  )}>
                    {s.kunde_name ?? `Stopp ${s.reihenfolge}`}
                  </span>
                  {isNext && (
                    <span className="text-[9px] bg-blue-500 text-white rounded px-1.5 py-0.5 font-bold">
                      NÄCHSTER STOPP
                    </span>
                  )}
                </div>
                {s.kunde_adresse && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-stone-400 shrink-0" />
                    <span className="text-[10px] text-stone-500 truncate">{s.kunde_adresse}</span>
                  </div>
                )}
                {!done && s.eta_min != null && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-stone-400 shrink-0" />
                    <span className="text-[10px] text-stone-500">ETA ~{s.eta_min} Min</span>
                  </div>
                )}
                {done && s.geliefert_am && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Package className="h-3 w-3 text-matcha-500 shrink-0" />
                    <span className="text-[10px] text-matcha-600">
                      Geliefert {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              {/* Navigation-Button */}
              {!done && isNext && onNavigate && (
                <button
                  onClick={() => onNavigate(s)}
                  className="shrink-0 rounded-lg bg-blue-500 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-blue-600 transition flex items-center gap-1"
                >
                  <Navigation className="h-3 w-3" />
                  Navi
                </button>
              )}
              {!done && !isNext && (
                <span className="shrink-0 text-[9px] text-stone-400 tabular-nums pt-1">
                  {s.reihenfolge - displayDone - 1} danach
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
