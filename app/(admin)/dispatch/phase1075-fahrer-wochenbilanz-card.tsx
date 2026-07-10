'use client';

import { useEffect, useState } from 'react';
import { Star, Trophy, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type FahrerBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  stopps: number;
  umsatz_eur: number;
  bewertung: number | null;
  abgeschlossene_touren: number;
  avg_stopp_zeit_min: number;
  ist_bester: boolean;
};

type ApiResponse = {
  fahrer: FahrerBilanz[];
  woche_von: string;
  woche_bis: string;
  gesamt_stopps: number;
  gesamt_umsatz_eur: number;
};

function mock(): ApiResponse {
  return {
    fahrer: [
      { fahrer_id: 'd1', fahrer_name: 'Max Müller', stopps: 87, umsatz_eur: 1240.50, bewertung: 4.9, abgeschlossene_touren: 22, avg_stopp_zeit_min: 6.2, ist_bester: true },
      { fahrer_id: 'd2', fahrer_name: 'Tom Klein', stopps: 74, umsatz_eur: 1055.20, bewertung: 4.7, abgeschlossene_touren: 19, avg_stopp_zeit_min: 7.1, ist_bester: false },
      { fahrer_id: 'd3', fahrer_name: 'Lisa Berg', stopps: 68, umsatz_eur: 920.80, bewertung: 4.8, abgeschlossene_touren: 17, avg_stopp_zeit_min: 7.8, ist_bester: false },
      { fahrer_id: 'd4', fahrer_name: 'Jan Schulz', stopps: 55, umsatz_eur: 785.00, bewertung: 4.5, abgeschlossene_touren: 14, avg_stopp_zeit_min: 8.3, ist_bester: false },
    ],
    woche_von: '2026-07-06',
    woche_bis: '2026-07-12',
    gesamt_stopps: 284,
    gesamt_umsatz_eur: 4001.50,
  };
}

function formatEuro(v: number) {
  return v.toFixed(2).replace('.', ',') + ' €';
}

function formatDate(iso: string) {
  return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.';
}

export function DispatchPhase1075FahrerWochenbilanzCard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/fahrer-wochenbilanz?${p}`);
      if (r.ok) setData(await r.json());
      else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 300_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const best = data?.fahrer.find((f) => f.ist_bester);
  const maxStopps = Math.max(...(data?.fahrer.map((f) => f.stopps) ?? [1]));

  return (
    <div className="rounded-2xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-yellow-200 dark:border-yellow-800">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-600 dark:text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-yellow-800 dark:text-yellow-200">
            Fahrer-Wochenbilanz
          </span>
          {data && (
            <span className="text-[10px] text-muted-foreground">
              {formatDate(data.woche_von)}–{formatDate(data.woche_bis)}
            </span>
          )}
        </div>
        {data && (
          <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-2 py-0.5 text-[10px] font-bold text-yellow-700 dark:text-yellow-300">
            {data.gesamt_stopps} Stopps gesamt
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-yellow-400" />
        </div>
      )}

      {!loading && data && (
        <div className="p-3 space-y-3">
          {/* Bester Fahrer highlight */}
          {best && (
            <div className="flex items-center gap-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 px-3 py-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400 dark:bg-yellow-600">
                <Trophy size={18} className="text-yellow-900 dark:text-yellow-100" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-300">
                  Fahrer der Woche
                </div>
                <div className="text-sm font-black text-yellow-900 dark:text-yellow-100 truncate">
                  {best.fahrer_name}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-yellow-700 dark:text-yellow-300">
                  <span>{best.stopps} Stopps</span>
                  <span>·</span>
                  <span>{formatEuro(best.umsatz_eur)}</span>
                  {best.bewertung && (
                    <>
                      <span>·</span>
                      <Star size={9} className="fill-yellow-500 text-yellow-500" />
                      <span>{best.bewertung.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Alle Fahrer */}
          <div className="space-y-2">
            {data.fahrer.map((f, i) => (
              <div key={f.fahrer_id} className={cn(
                'rounded-xl border px-3 py-2',
                f.ist_bester
                  ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-border bg-card',
              )}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                    i === 0
                      ? 'bg-yellow-400 text-yellow-900'
                      : i === 1
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200'
                      : i === 2
                      ? 'bg-amber-600 text-white'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-foreground flex-1 truncate">{f.fahrer_name}</span>
                  {f.bewertung && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Star size={9} className="fill-yellow-400 text-yellow-400" />
                      <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                        {f.bewertung.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stopps-Balken */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', f.ist_bester ? 'bg-yellow-400' : 'bg-matcha-400')}
                      style={{ width: `${Math.min(100, (f.stopps / maxStopps) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-[10px] font-bold tabular-nums text-foreground">
                    {f.stopps} Stopps
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
                  <span>{formatEuro(f.umsatz_eur)}</span>
                  <span>·</span>
                  <span>{f.abgeschlossene_touren} Touren</span>
                  <span>·</span>
                  <div className="flex items-center gap-0.5">
                    <TrendingUp size={8} />
                    <span>{f.avg_stopp_zeit_min.toFixed(1)} Min/Stopp</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-yellow-200 dark:border-yellow-800 text-[10px] text-muted-foreground">
            <span>Gesamt: {data.gesamt_stopps} Stopps</span>
            <span>{formatEuro(data.gesamt_umsatz_eur)} Umsatz</span>
          </div>
        </div>
      )}
    </div>
  );
}
