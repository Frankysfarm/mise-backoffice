'use client';

// Phase 1236 — Zonen-Effizienz-Frontend (Lieferdienst-Dashboard)
// Nutzt GET /api/delivery/admin/lieferzonen-tages-effizienz
// Sortierte Zonen-Liste mit Effizienz-Ampel (schwach/normal/gut/top) + Pünktlichkeit + Umsatz
// 10-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneEintrag {
  zone: string;
  lieferungen: number;
  avg_lieferzeit_min: number;
  on_time_pct: number;
  umsatz_eur: number;
  umsatz_pro_lieferung_eur: number;
  effizienz_level: 'schwach' | 'normal' | 'gut' | 'top';
}

interface ApiResponse {
  zonen: ZoneEintrag[];
  gesamt_lieferungen: number;
  gesamt_umsatz_eur: number;
  beste_zone: string | null;
  schlechteste_zone: string | null;
  location_id: string;
  generiert_am: string;
}

const LEVEL_LABEL: Record<ZoneEintrag['effizienz_level'], string> = {
  top: 'Top',
  gut: 'Gut',
  normal: 'Normal',
  schwach: 'Schwach',
};

const LEVEL_DOT: Record<ZoneEintrag['effizienz_level'], string> = {
  top: 'bg-emerald-500',
  gut: 'bg-green-400',
  normal: 'bg-amber-400',
  schwach: 'bg-red-500',
};

const LEVEL_TEXT: Record<ZoneEintrag['effizienz_level'], string> = {
  top: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30',
  gut: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30',
  normal: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30',
  schwach: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30',
};

const LEVEL_BAR: Record<ZoneEintrag['effizienz_level'], string> = {
  top: 'bg-emerald-500',
  gut: 'bg-green-400',
  normal: 'bg-amber-400',
  schwach: 'bg-red-500',
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function LieferdienstPhase1236ZonenEffizienzFrontend({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function load() {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/lieferzonen-tages-effizienz?location_id=${encodeURIComponent(locationId)}`)
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
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const sorted = data
    ? [...data.zonen].sort((a, b) => {
        const order: Record<ZoneEintrag['effizienz_level'], number> = { top: 0, gut: 1, normal: 2, schwach: 3 };
        return order[a.effizienz_level] - order[b.effizienz_level];
      })
    : [];

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Zonen-Effizienz heute</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">
            {data
              ? `${data.gesamt_lieferungen} Lieferungen · ${fmtEur(data.gesamt_umsatz_eur)} Umsatz`
              : 'Lade…'}
          </div>
        </div>
        {loading && (
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400" />
        )}
      </button>

      {open && (
        <div className="p-5 space-y-3">
          {/* Summary row */}
          {data && (data.beste_zone || data.schlechteste_zone) && (
            <div className="flex gap-2 text-xs mb-1">
              {data.beste_zone && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                  <TrendingUp className="h-3 w-3" />
                  Beste: {data.beste_zone}
                </span>
              )}
              {data.schlechteste_zone && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  <TrendingDown className="h-3 w-3" />
                  Schwächste: {data.schlechteste_zone}
                </span>
              )}
            </div>
          )}

          {/* Zone list */}
          {sorted.length === 0 && !loading && (
            <div className="text-sm text-stone-400 text-center py-4">Keine Zonen-Daten verfügbar</div>
          )}

          {sorted.map((z) => (
            <div
              key={z.zone}
              className="rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', LEVEL_DOT[z.effizienz_level])} />
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">{z.zone}</span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    LEVEL_TEXT[z.effizienz_level],
                  )}
                >
                  {LEVEL_LABEL[z.effizienz_level]}
                </span>
              </div>

              {/* Pünktlichkeits-Balken */}
              <div className="mb-2">
                <div className="flex justify-between text-[10px] text-stone-500 dark:text-stone-400 mb-0.5">
                  <span>Pünktlichkeit</span>
                  <span className="font-semibold">{z.on_time_pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', LEVEL_BAR[z.effizienz_level])}
                    style={{ width: `${Math.min(z.on_time_pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-stone-500 dark:text-stone-400">
                <div>
                  <div className="font-semibold text-stone-700 dark:text-stone-200 text-xs">{z.lieferungen}</div>
                  <div>Lieferungen</div>
                </div>
                <div>
                  <div className="font-semibold text-stone-700 dark:text-stone-200 text-xs">{z.avg_lieferzeit_min} Min</div>
                  <div>Ø Lieferzeit</div>
                </div>
                <div>
                  <div className="font-semibold text-stone-700 dark:text-stone-200 text-xs">{fmtEur(z.umsatz_eur)}</div>
                  <div>Umsatz</div>
                </div>
              </div>
            </div>
          ))}

          {lastUpdated && (
            <div className="text-[10px] text-stone-400 dark:text-stone-500 text-right pt-1">
              Stand: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
