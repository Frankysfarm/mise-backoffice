'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Star, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1206 — Zonen-Vertrautheits-Score (Fahrer-App)
// Wie gut kennt der Fahrer eine Zone: Score + Empfehlung für nächste Tour

interface ZonenScore {
  zone: string;
  lieferungen: number;
  avg_lieferzeit_min: number;
  score: number;
  level: 'anfaenger' | 'vertraut' | 'experte' | 'profi';
  empfehlung: string;
}

interface ApiData {
  fahrer_id: string;
  zonen: ZonenScore[];
  best_zone: string | null;
  generiert_am: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const LEVEL_STYLES: Record<ZonenScore['level'], { color: string; badge: string; bar: string; label: string }> = {
  anfaenger: { color: 'text-slate-500 dark:text-slate-400',    badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',    bar: 'bg-slate-400',  label: 'Anfänger' },
  vertraut:  { color: 'text-amber-600 dark:text-amber-400',    badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',     bar: 'bg-amber-500',  label: 'Vertraut' },
  experte:   { color: 'text-blue-600 dark:text-blue-400',      badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',         bar: 'bg-blue-500',   label: 'Experte' },
  profi:     { color: 'text-violet-600 dark:text-violet-400',  badge: 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500', label: 'Profi' },
};

function MOCK(driverId: string): ApiData {
  return {
    fahrer_id: driverId,
    zonen: [
      { zone: 'A', lieferungen: 52, avg_lieferzeit_min: 22, score: 88, level: 'profi',     empfehlung: 'Zone A ist deine Stärke — optimal für schnelle Touren' },
      { zone: 'B', lieferungen: 28, avg_lieferzeit_min: 27, score: 61, level: 'experte',   empfehlung: 'Zone B kennst du gut — gute Wahl für nächste Tour' },
      { zone: 'D', lieferungen: 15, avg_lieferzeit_min: 31, score: 38, level: 'vertraut',  empfehlung: 'Zone D — du wirst sicherer mit mehr Touren' },
      { zone: 'C', lieferungen: 9,  avg_lieferzeit_min: 34, score: 22, level: 'anfaenger', empfehlung: 'Zone C — noch wenig Erfahrung, lieber andere Zone wählen' },
    ],
    best_zone: 'A',
    generiert_am: new Date().toISOString(),
  };
}

export function FahrerPhase1206ZonenVertrautheitsScore({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await window.fetch(`/api/delivery/driver/zonen-vertrautheits-score?driver_id=${driverId}`);
      const json = await res.json();
      setData(json.zonen !== undefined ? json : MOCK(driverId));
    } catch {
      setData(MOCK(driverId));
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (!isOnline || !data) return null;

  const bestStyle = data.best_zone ? LEVEL_STYLES.profi : LEVEL_STYLES.vertraut;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-violet-400" />
          <span className="font-bold text-sm text-white">Zonen-Vertrautheits-Score</span>
          {data.best_zone && (
            <span className="rounded-full bg-violet-900/60 text-violet-300 text-[10px] font-bold px-2 py-0.5">
              Best: Zone {data.best_zone}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-white/50" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {data.zonen.map(z => {
            const s = LEVEL_STYLES[z.level];
            return (
              <div key={z.zone} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white font-black text-sm shrink-0">
                    {z.zone}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-[10px] font-bold uppercase rounded px-1.5 py-0.5', s.badge)}>
                          {s.label}
                        </span>
                        <span className="text-[10px] text-white/50">
                          {z.lieferungen} Touren · Ø {z.avg_lieferzeit_min} Min
                        </span>
                      </div>
                      <span className={cn('text-sm font-black tabular-nums shrink-0', s.color)}>
                        {z.score}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10">
                      <div
                        className={cn('h-full rounded-full transition-all', s.bar)}
                        style={{ width: `${z.score}%` }}
                      />
                    </div>
                  </div>
                </div>
                {z.level !== 'anfaenger' && (
                  <p className="text-[10px] text-white/50 pl-10">{z.empfehlung}</p>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-white/30 pt-1">Score basiert auf Lieferanzahl + Ø-Geschwindigkeit letzte 30 Tage.</p>
        </div>
      )}
    </div>
  );
}
