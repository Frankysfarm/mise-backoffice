'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1106 — Trinkgeld-Wochen-Übersicht (Fahrer-App)
// Wöchentliche Trinkgeld-Statistik: Tages-Balken + bester Tag + Ø pro Tour

interface Props {
  driverId: string;
  isOnline: boolean;
}

type TagStat = {
  tag: string;
  trinkgeld_eur: number;
  touren: number;
};

type ApiData = {
  fahrer_id: string;
  wochen_gesamt_eur: number;
  durchschnitt_pro_tour_eur: number;
  bester_tag: string;
  bester_tag_eur: number;
  tage: TagStat[];
  generiert_am: string;
};

const MOCK: ApiData = {
  fahrer_id: 'mock',
  wochen_gesamt_eur: 31.4,
  durchschnitt_pro_tour_eur: 0.98,
  bester_tag: 'Sa',
  bester_tag_eur: 8.5,
  tage: [
    { tag: 'Mo', trinkgeld_eur: 2.5, touren: 3 },
    { tag: 'Di', trinkgeld_eur: 3.8, touren: 4 },
    { tag: 'Mi', trinkgeld_eur: 1.2, touren: 2 },
    { tag: 'Do', trinkgeld_eur: 4.1, touren: 5 },
    { tag: 'Fr', trinkgeld_eur: 6.3, touren: 6 },
    { tag: 'Sa', trinkgeld_eur: 8.5, touren: 7 },
    { tag: 'So', trinkgeld_eur: 5.0, touren: 5 },
  ],
  generiert_am: new Date().toISOString(),
};

export function FahrerPhase1106TrinkgeldWochenUebersicht({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/trinkgeld-wochen-uebersicht?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isOnline) return null;

  const maxEur = data ? Math.max(...data.tage.map(t => t.trinkgeld_eur), 1) : 1;

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-800 dark:bg-yellow-950/20">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
          <Star className="h-4 w-4 text-yellow-500" />
          <span>Trinkgeld diese Woche</span>
          {data && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
              {data.wochen_gesamt_eur.toFixed(2)} €
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data ? (
            <>
              {/* Summary pills */}
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-2.5 py-1 font-semibold text-yellow-800 dark:text-yellow-200">
                  <span>Gesamt</span>
                  <span className="font-bold">{data.wochen_gesamt_eur.toFixed(2)} €</span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white dark:bg-black/20 border px-2.5 py-1 text-gray-600 dark:text-gray-300">
                  <span>Ø/Tour</span>
                  <span className="font-bold">{data.durchschnitt_pro_tour_eur.toFixed(2)} €</span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-amber-800 dark:text-amber-200">
                  <Star className="h-3 w-3" />
                  <span>Bester Tag: {data.bester_tag} ({data.bester_tag_eur.toFixed(2)} €)</span>
                </div>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1.5 h-20">
                {data.tage.map(t => {
                  const pct = Math.round((t.trinkgeld_eur / maxEur) * 100);
                  const isBest = t.tag === data.bester_tag;
                  return (
                    <div key={t.tag} className="flex flex-1 flex-col items-center gap-1">
                      <div className="relative w-full flex items-end" style={{ height: 56 }}>
                        <div
                          className={cn(
                            'w-full rounded-t-md transition-all',
                            isBest ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-yellow-200 dark:bg-yellow-700',
                          )}
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                      <span className={cn('text-[10px] font-semibold', isBest ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400')}>
                        {t.tag}
                      </span>
                      <span className="text-[9px] tabular-nums text-gray-400">
                        {t.trinkgeld_eur > 0 ? `${t.trinkgeld_eur.toFixed(1)}€` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Lade Trinkgeld-Statistik…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
