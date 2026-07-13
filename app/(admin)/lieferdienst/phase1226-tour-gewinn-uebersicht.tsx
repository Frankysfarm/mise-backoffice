'use client';

// Phase 1226 — Tour-Gewinn-Übersicht (Lieferdienst-Dashboard)
// Nutzt GET /api/delivery/admin/tour-gewinn-analyse
// Zeigt beste/schlechteste Tour + Gesamt-Bruttogewinn heute + Effizienz-Verteilung als Balken

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Euro, AlertTriangle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface TourGewinn {
  tour_id: string;
  fahrer_name: string;
  zone: string | null;
  stopps_gesamt: number;
  stopps_geliefert: number;
  bestellwert_eur: number;
  bruttogewinn_eur: number;
  gewinn_pct: number;
  effizienz: 'verlust' | 'niedrig' | 'normal' | 'gut' | 'top';
  status: 'aktiv' | 'abgeschlossen';
}

interface ApiResponse {
  touren: TourGewinn[];
  beste_tour: TourGewinn | null;
  schlechteste_tour: TourGewinn | null;
  gesamt_bestellwert_eur: number;
  gesamt_bruttogewinn_eur: number;
}

const EFFIZIENZ_LABELS: Record<TourGewinn['effizienz'], string> = {
  verlust: 'Verlust',
  niedrig: 'Niedrig',
  normal: 'Normal',
  gut: 'Gut',
  top: 'Top',
};

const EFFIZIENZ_COLORS: Record<TourGewinn['effizienz'], string> = {
  verlust: 'bg-red-500',
  niedrig: 'bg-amber-400',
  normal: 'bg-yellow-400',
  gut: 'bg-emerald-400',
  top: 'bg-emerald-600',
};

const EFFIZIENZ_TEXT: Record<TourGewinn['effizienz'], string> = {
  verlust: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40',
  niedrig: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40',
  normal: 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40',
  gut: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40',
  top: 'text-emerald-800 dark:text-emerald-200 bg-emerald-200 dark:bg-emerald-900/60',
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function LieferdienstPhase1226TourGewinnUebersicht({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function load() {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/tour-gewinn-analyse?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) {
    if (loading) {
      return (
        <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-zinc-900 p-4 animate-pulse">
          <div className="h-4 w-48 bg-stone-100 dark:bg-stone-800 rounded mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-stone-100 dark:bg-stone-800 rounded-xl" />
            ))}
          </div>
        </div>
      );
    }
    return null;
  }

  const touren = data.touren ?? [];
  const effizienzen = ['verlust', 'niedrig', 'normal', 'gut', 'top'] as TourGewinn['effizienz'][];
  const effCount: Record<string, number> = {};
  for (const e of effizienzen) effCount[e] = 0;
  for (const t of touren) effCount[t.effizienz] = (effCount[t.effizienz] ?? 0) + 1;
  const maxCount = Math.max(1, ...Object.values(effCount));

  const gewinnPositiv = data.gesamt_bruttogewinn_eur >= 0;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
      >
        <Euro className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">
          Tour-Gewinn-Übersicht
        </span>
        <span className={cn(
          'text-[11px] font-bold tabular-nums',
          gewinnPositiv ? 'text-emerald-600' : 'text-red-600',
        )}>
          {gewinnPositiv ? '+' : ''}{fmtEur(data.gesamt_bruttogewinn_eur)}
        </span>
        {loading && <span className="text-[10px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Summary-Kacheln */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bestellwert heute</div>
              <div className="text-base font-black tabular-nums text-foreground">{fmtEur(data.gesamt_bestellwert_eur)}</div>
            </div>
            <div className={cn('rounded-xl p-3', gewinnPositiv ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30')}>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bruttogewinn</div>
              <div className={cn('text-base font-black tabular-nums flex items-center gap-1', gewinnPositiv ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300')}>
                {gewinnPositiv ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {fmtEur(data.gesamt_bruttogewinn_eur)}
              </div>
            </div>
          </div>

          {/* Effizienz-Verteilung Balken */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Effizienz-Verteilung ({touren.length} Touren)</div>
            <div className="space-y-1.5">
              {effizienzen.map((e) => (
                <div key={e} className="flex items-center gap-2">
                  <div className="w-12 text-[10px] font-semibold text-muted-foreground text-right">{EFFIZIENZ_LABELS[e]}</div>
                  <div className="flex-1 h-4 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', EFFIZIENZ_COLORS[e])}
                      style={{ width: `${(effCount[e] / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="w-4 text-[10px] font-bold text-foreground tabular-nums">{effCount[e]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Beste / Schlechteste Tour */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.beste_tour && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                  <Trophy className="h-3 w-3" /> Beste Tour
                </div>
                <div className="text-xs font-bold text-foreground">{data.beste_tour.fahrer_name}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {data.beste_tour.zone && <span>Zone {data.beste_tour.zone}</span>}
                  <span>{data.beste_tour.stopps_gesamt} Stopps</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">+{fmtEur(data.beste_tour.bruttogewinn_eur)}</span>
                </div>
                <span className={cn('mt-1.5 inline-block text-[9px] font-bold rounded-full px-2 py-0.5', EFFIZIENZ_TEXT[data.beste_tour.effizienz])}>
                  {EFFIZIENZ_LABELS[data.beste_tour.effizienz]}
                </span>
              </div>
            )}
            {data.schlechteste_tour && data.schlechteste_tour.tour_id !== data.beste_tour?.tour_id && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 mb-1">
                  <AlertTriangle className="h-3 w-3" /> Schlechteste Tour
                </div>
                <div className="text-xs font-bold text-foreground">{data.schlechteste_tour.fahrer_name}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  {data.schlechteste_tour.zone && <span>Zone {data.schlechteste_tour.zone}</span>}
                  <span>{data.schlechteste_tour.stopps_gesamt} Stopps</span>
                  <span className={cn('font-bold', data.schlechteste_tour.bruttogewinn_eur < 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
                    {data.schlechteste_tour.bruttogewinn_eur >= 0 ? '+' : ''}{fmtEur(data.schlechteste_tour.bruttogewinn_eur)}
                  </span>
                </div>
                <span className={cn('mt-1.5 inline-block text-[9px] font-bold rounded-full px-2 py-0.5', EFFIZIENZ_TEXT[data.schlechteste_tour.effizienz])}>
                  {EFFIZIENZ_LABELS[data.schlechteste_tour.effizienz]}
                </span>
              </div>
            )}
          </div>

          {lastUpdated && (
            <div className="text-[10px] text-muted-foreground">
              Aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 5-Min-Polling
            </div>
          )}
        </div>
      )}
    </div>
  );
}
