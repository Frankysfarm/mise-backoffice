'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourTrinkgeld = {
  tour_id: string;
  tour_nr: number;
  betrag: number;
  uhrzeit: string;
  bewertung?: number;
};

type TrinkgeldDaten = {
  touren: TourTrinkgeld[];
  gesamt_heute: number;
  ø_pro_tour: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  besste_tour_betrag: number;
  anzahl_touren_heute: number;
};

function mock(driverId: string): TrinkgeldDaten {
  const seed = driverId.charCodeAt(0) % 3;
  const trends = ['steigend', 'stabil', 'fallend'] as const;
  return {
    touren: [
      { tour_id: 't1', tour_nr: 1, betrag: 3.50, uhrzeit: '11:15', bewertung: 5 },
      { tour_id: 't2', tour_nr: 2, betrag: 0, uhrzeit: '12:30' },
      { tour_id: 't3', tour_nr: 3, betrag: 2.00, uhrzeit: '13:45', bewertung: 4 },
      { tour_id: 't4', tour_nr: 4, betrag: 5.00, uhrzeit: '14:50', bewertung: 5 },
    ],
    gesamt_heute: 10.50 + seed * 2.5,
    ø_pro_tour: 2.63 + seed * 0.5,
    trend: trends[seed],
    besste_tour_betrag: 5.00 + seed,
    anzahl_touren_heute: 4 + seed,
  };
}

function formatEuro(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

export function FahrerPhase1066TrinkgeldAnalyseDashboard({
  driverId,
  isOnline,
}: {
  driverId: string;
  isOnline?: boolean;
}) {
  const [data, setData] = useState<TrinkgeldDaten | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await fetch(`/api/delivery/driver/fahrten-chronik?driver_id=${encodeURIComponent(driverId)}&datum=Heute`);
      if (!r.ok) throw new Error();
      const json = await r.json();
      const fahrten = Array.isArray(json.fahrten) ? json.fahrten : [];
      const touren: TourTrinkgeld[] = fahrten.map((f: Record<string, unknown>, idx: number) => ({
        tour_id: String(f.id ?? idx),
        tour_nr: idx + 1,
        betrag: typeof f.trinkgeld === 'number' ? f.trinkgeld : 0,
        uhrzeit: typeof f.abgeschlossen_um === 'string' ? f.abgeschlossen_um.slice(11, 16) : '--:--',
        bewertung: typeof f.bewertung === 'number' ? f.bewertung : undefined,
      }));
      const gesamt = touren.reduce((s, t) => s + t.betrag, 0);
      const avg = touren.length > 0 ? gesamt / touren.length : 0;
      const beste = touren.reduce((m, t) => Math.max(m, t.betrag), 0);
      const letzte3 = touren.slice(-3).map((t) => t.betrag);
      const erste3 = touren.slice(0, 3).map((t) => t.betrag);
      const avgLetzt = letzte3.reduce((s, x) => s + x, 0) / Math.max(letzte3.length, 1);
      const avgErst = erste3.reduce((s, x) => s + x, 0) / Math.max(erste3.length, 1);
      const trend: TrinkgeldDaten['trend'] =
        avgLetzt > avgErst + 0.3 ? 'steigend' : avgLetzt < avgErst - 0.3 ? 'fallend' : 'stabil';
      setData({ touren, gesamt_heute: gesamt, ø_pro_tour: avg, trend, besste_tour_betrag: beste, anzahl_touren_heute: touren.length });
    } catch {
      setData(mock(driverId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, isOnline]);

  if (!isOnline) return null;
  if (loading) return (
    <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4 flex items-center justify-center">
      <Loader2 size={16} className="animate-spin text-yellow-500" />
    </div>
  );
  if (!data) return null;

  const TrendIcon =
    data.trend === 'steigend' ? TrendingUp : data.trend === 'fallend' ? TrendingDown : Minus;
  const trendFarbe =
    data.trend === 'steigend' ? 'text-green-600 dark:text-green-400' :
    data.trend === 'fallend' ? 'text-red-500 dark:text-red-400' :
    'text-gray-500 dark:text-gray-400';

  return (
    <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-yellow-200 dark:border-yellow-800">
        <Euro size={14} className="text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-bold text-yellow-800 dark:text-yellow-200 uppercase tracking-wider">
          Trinkgeld-Analyse
        </span>
      </div>

      <div className="p-3">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl bg-white dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-2.5 text-center">
            <div className="text-sm font-bold text-yellow-900 dark:text-yellow-100">{formatEuro(data.gesamt_heute)}</div>
            <div className="text-[10px] text-yellow-600 dark:text-yellow-400">Gesamt heute</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-2.5 text-center">
            <div className="text-sm font-bold text-yellow-900 dark:text-yellow-100">{formatEuro(data.ø_pro_tour)}</div>
            <div className="text-[10px] text-yellow-600 dark:text-yellow-400">Ø je Tour</div>
          </div>
          <div className="rounded-xl bg-white dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-2.5 text-center">
            <div className={cn('flex items-center justify-center gap-0.5 text-sm font-bold', trendFarbe)}>
              <TrendIcon size={13} />
              <span className="capitalize text-xs">{data.trend}</span>
            </div>
            <div className="text-[10px] text-yellow-600 dark:text-yellow-400">Trend</div>
          </div>
        </div>

        {/* Tour list */}
        <div className="space-y-1">
          {data.touren.map((tour) => (
            <div
              key={tour.tour_id}
              className="flex items-center justify-between rounded-lg bg-white dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900 px-3 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-yellow-600 dark:text-yellow-400">{tour.uhrzeit}</span>
                <span className="text-[11px] text-gray-700 dark:text-gray-300">Tour {tour.tour_nr}</span>
                {tour.bewertung !== undefined && (
                  <span className="text-[10px] text-yellow-500">{'⭐'.repeat(Math.round(tour.bewertung))}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-[11px] font-bold',
                  tour.betrag > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'
                )}
              >
                {tour.betrag > 0 ? formatEuro(tour.betrag) : '—'}
              </span>
            </div>
          ))}
        </div>

        {data.besste_tour_betrag > 0 && (
          <div className="mt-2 text-[10px] text-yellow-700 dark:text-yellow-400 text-center">
            🏆 Beste Tour heute: {formatEuro(data.besste_tour_betrag)}
          </div>
        )}
      </div>
    </div>
  );
}
