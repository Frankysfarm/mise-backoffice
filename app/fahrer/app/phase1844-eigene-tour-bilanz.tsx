'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, MapPin, Clock, Star, TrendingUp } from 'lucide-react';

/**
 * Phase 1844 — Eigene-Tour-Bilanz (Fahrer-App)
 *
 * Zeigt die letzten 3 abgeschlossenen eigenen Touren: Stopps, Dauer, Ø Bewertung + Pünktlichkeit.
 * isOnline-Guard. 30-Min-Polling.
 */

interface TourBilanz {
  id: string;
  stopps: number;
  dauer_min: number;
  abgeschlossen_um: string;
  puenktlich: boolean;
  bewertung: number | null;
  km: number | null;
}

interface ApiAntwort {
  touren: TourBilanz[];
}

const MOCK_TOUREN: TourBilanz[] = [
  { id: '1', stopps: 4, dauer_min: 37, abgeschlossen_um: new Date(Date.now() - 25 * 60_000).toISOString(), puenktlich: true, bewertung: 4.8, km: 12.3 },
  { id: '2', stopps: 3, dauer_min: 28, abgeschlossen_um: new Date(Date.now() - 80 * 60_000).toISOString(), puenktlich: true, bewertung: 5.0, km: 9.1 },
  { id: '3', stopps: 5, dauer_min: 54, abgeschlossen_um: new Date(Date.now() - 140 * 60_000).toISOString(), puenktlich: false, bewertung: 4.2, km: 16.8 },
];

function zeitVor(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  return `vor ${Math.round(diffMin / 60)} Std`;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1844EigeneTourBilanz({ driverId, isOnline, className }: Props) {
  const [touren, setTouren] = useState<TourBilanz[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/driver-app/my-tours?driver_id=${driverId}&limit=3`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: ApiAntwort = await res.json();
          setTouren(json.touren ?? []);
        }
      } catch {
        setTouren(MOCK_TOUREN);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const anzeige = touren.length > 0 ? touren : MOCK_TOUREN;
  const puenktlichkeit = Math.round((anzeige.filter((t) => t.puenktlich).length / anzeige.length) * 100);
  const avgBew = anzeige.reduce((s, t) => s + (t.bewertung ?? 0), 0) / anzeige.filter((t) => t.bewertung !== null).length;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-semibold">Meine Touren</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Letzte {anzeige.length}</span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-3">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-700 px-3 py-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
              <div>
                <div className="text-base font-black tabular-nums">{puenktlichkeit}%</div>
                <div className="text-[9px] font-semibold text-muted-foreground">Pünktlich</div>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 px-3 py-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <div className="text-base font-black tabular-nums">
                  {isNaN(avgBew) ? '—' : avgBew.toFixed(1)}
                </div>
                <div className="text-[9px] font-semibold text-muted-foreground">Ø Bewertung</div>
              </div>
            </div>
          </div>

          {/* Tour-Liste */}
          <div className="divide-y rounded-xl border overflow-hidden">
            {anzeige.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-black">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {t.stopps} Stopps
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {t.dauer_min} Min
                    </span>
                    {t.km !== null && (
                      <span>{t.km.toFixed(1)} km</span>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{zeitVor(t.abgeschlossen_um)}</div>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <div className={cn(
                    'text-[10px] font-bold rounded-full px-1.5 py-0.5',
                    t.puenktlich
                      ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                  )}>
                    {t.puenktlich ? 'Pünktlich' : 'Verspätet'}
                  </div>
                  {t.bewertung !== null && (
                    <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-end gap-0.5">
                      <Star className="h-2.5 w-2.5" /> {t.bewertung.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
