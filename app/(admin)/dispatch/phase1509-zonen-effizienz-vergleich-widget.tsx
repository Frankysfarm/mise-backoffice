'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

// Phase 1509 — Zonen-Effizienz-Vergleich-Widget (Dispatch)
// Phase1507-API: Kacheln je Zone A/B/C/D mit Trend-Arrow + Pünktlichkeits-Balken + Lieferzeit;
// 15-Min-Polling; nach Phase1504.

interface ZonenEintrag {
  zone: 'A' | 'B' | 'C' | 'D';
  bestellungen_heute: number;
  bestellungen_vorwoche: number;
  puenktlichkeit_heute_pct: number;
  puenktlichkeit_vorwoche_pct: number;
  lieferzeit_heute_min: number;
  lieferzeit_vorwoche_min: number;
  trend_puenktlichkeit: 'besser' | 'gleich' | 'schlechter';
  trend_lieferzeit: 'besser' | 'gleich' | 'schlechter';
  status: 'gut' | 'normal' | 'kritisch';
}

interface ApiData {
  zonen: ZonenEintrag[];
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 15 * 60 * 1000;

const STATUS_CONFIG: Record<ZonenEintrag['status'], { border: string; badge: string; dot: string }> = {
  gut: {
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  normal: {
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  kritisch: {
    border: 'border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    dot: 'bg-rose-500 animate-pulse',
  },
};

const TREND_ICON: Record<string, React.ReactNode> = {
  besser: <TrendingUp className="w-3 h-3 text-emerald-500" />,
  gleich: <Minus className="w-3 h-3 text-amber-500" />,
  schlechter: <TrendingDown className="w-3 h-3 text-rose-500" />,
};

const TREND_CLS: Record<string, string> = {
  besser: 'text-emerald-600 dark:text-emerald-400',
  gleich: 'text-amber-600 dark:text-amber-400',
  schlechter: 'text-rose-600 dark:text-rose-400',
};

function buildMock(): ApiData {
  return {
    zonen: [
      { zone: 'A', bestellungen_heute: 42, bestellungen_vorwoche: 38, puenktlichkeit_heute_pct: 91, puenktlichkeit_vorwoche_pct: 87, lieferzeit_heute_min: 28, lieferzeit_vorwoche_min: 31, trend_puenktlichkeit: 'besser', trend_lieferzeit: 'besser', status: 'gut' },
      { zone: 'B', bestellungen_heute: 31, bestellungen_vorwoche: 35, puenktlichkeit_heute_pct: 78, puenktlichkeit_vorwoche_pct: 80, lieferzeit_heute_min: 36, lieferzeit_vorwoche_min: 34, trend_puenktlichkeit: 'gleich', trend_lieferzeit: 'gleich', status: 'normal' },
      { zone: 'C', bestellungen_heute: 19, bestellungen_vorwoche: 22, puenktlichkeit_heute_pct: 65, puenktlichkeit_vorwoche_pct: 71, lieferzeit_heute_min: 48, lieferzeit_vorwoche_min: 45, trend_puenktlichkeit: 'schlechter', trend_lieferzeit: 'schlechter', status: 'kritisch' },
      { zone: 'D', bestellungen_heute: 8, bestellungen_vorwoche: 10, puenktlichkeit_heute_pct: 82, puenktlichkeit_vorwoche_pct: 78, lieferzeit_heute_min: 55, lieferzeit_vorwoche_min: 60, trend_puenktlichkeit: 'besser', trend_lieferzeit: 'besser', status: 'normal' },
    ],
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

export function DispatchPhase1509ZonenEffizienzVergleichWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setData(buildMock()); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/zonen-effizienz-vergleich?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const raw = await res.json() as Partial<ApiData>;
      if (raw.zonen && Array.isArray(raw.zonen)) {
        setData(raw as ApiData);
        setLastUpdate(new Date());
      } else {
        setData(buildMock());
      }
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const hatKritisch = data?.zonen.some(z => z.status === 'kritisch') ?? false;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      hatKritisch ? 'border-rose-200 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700',
    )}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <MapPin className={cn('w-4 h-4 shrink-0', hatKritisch ? 'text-rose-500' : 'text-blue-500')} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Zonen-Effizienz-Vergleich
        </span>
        {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin shrink-0" />}
        {lastUpdate && !loading && (
          <span className="text-[10px] text-slate-400 shrink-0">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-3">
          {(data?.zonen ?? []).map(z => {
            const cfg = STATUS_CONFIG[z.status];
            return (
              <div key={z.zone} className={cn('rounded-lg border p-3 space-y-2', cfg.border)}>
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{z.zone}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Zone {z.zone}</span>
                      <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                    </div>
                    <div className="text-[10px] text-slate-400">{z.bestellungen_heute} heute · {z.bestellungen_vorwoche} letzte Woche</div>
                  </div>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
                    {z.status === 'gut' ? 'Gut' : z.status === 'normal' ? 'Normal' : 'Kritisch'}
                  </span>
                </div>

                {/* Pünktlichkeit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Pünktlichkeit</span>
                    <div className="flex items-center gap-1">
                      {TREND_ICON[z.trend_puenktlichkeit]}
                      <span className={cn('text-[10px] font-semibold', TREND_CLS[z.trend_puenktlichkeit])}>
                        {z.puenktlichkeit_heute_pct}% <span className="text-slate-400 font-normal">vs. {z.puenktlichkeit_vorwoche_pct}%</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${z.puenktlichkeit_heute_pct}%`,
                        backgroundColor: z.puenktlichkeit_heute_pct >= 80 ? '#10b981' : z.puenktlichkeit_heute_pct >= 65 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                </div>

                {/* Lieferzeit */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Ø Lieferzeit</span>
                  <div className="flex items-center gap-1">
                    {TREND_ICON[z.trend_lieferzeit]}
                    <span className={cn('text-[10px] font-semibold', TREND_CLS[z.trend_lieferzeit])}>
                      {z.lieferzeit_heute_min} Min <span className="text-slate-400 font-normal">vs. {z.lieferzeit_vorwoche_min} Min</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
