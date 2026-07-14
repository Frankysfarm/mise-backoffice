'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, Users } from 'lucide-react';

// Phase 1514 — Fahrer-Tages-Leistungs-Ranking (Dispatch)
// Phase1512-API: Leaderboard Stopps/Verdienst/Pünktlichkeit; Farb-Ranking Top/Mitte/Low;
// 10-Min-Polling; nach Phase1509.

interface FahrerEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  verdienst_heute_eur: number;
  km_heute: number;
  puenktlichkeit_pct: number;
  rang: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface ApiData {
  fahrer: FahrerEintrag[];
  team_schnitt_stopps: number;
  team_schnitt_puenktlichkeit_pct: number;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 10 * 60 * 1000;

const TREND_ICON: Record<string, React.ReactNode> = {
  besser: <TrendingUp className="w-3 h-3 text-emerald-500" />,
  gleich: <Minus className="w-3 h-3 text-amber-500" />,
  schlechter: <TrendingDown className="w-3 h-3 text-rose-500" />,
};

function getRangKlasse(rang: number, total: number): { bg: string; text: string; border: string } {
  const pct = rang / Math.max(total, 1);
  if (pct <= 0.33) return {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  };
  if (pct <= 0.66) return {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  };
  return {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  };
}

function buildMock(): ApiData {
  const names = ['Alex M.', 'Ben K.', 'Clara S.', 'David R.', 'Eva L.'];
  const fahrer: FahrerEintrag[] = names.map((name, i) => ({
    fahrer_id: `f${i + 1}`,
    fahrer_name: name,
    stopps_heute: 14 - i * 2,
    verdienst_heute_eur: parseFloat(((14 - i * 2) * 3.5).toFixed(2)),
    km_heute: parseFloat(((14 - i * 2) * 2.8).toFixed(1)),
    puenktlichkeit_pct: 94 - i * 7,
    rang: i + 1,
    trend: (['besser', 'gleich', 'besser', 'schlechter', 'gleich'] as const)[i],
  }));
  return {
    fahrer,
    team_schnitt_stopps: 10,
    team_schnitt_puenktlichkeit_pct: 82,
    location_id: 'mock',
    generiert_am: new Date().toISOString(),
  };
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function DispatchPhase1514FahrerTagesLeistungsRanking({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) { setData(buildMock()); setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tages-leistung?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const raw = await res.json() as Partial<ApiData>;
      if (raw.fahrer && Array.isArray(raw.fahrer) && raw.fahrer.length > 0) {
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

  const total = data?.fahrer.length ?? 0;
  const top = data?.fahrer[0];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Tages-Leistungs-Ranking
        </span>
        {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin shrink-0" />}
        {lastUpdate && !loading && (
          <span className="text-[10px] text-slate-400 shrink-0">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded-full font-bold shrink-0">
          {total} Fahrer
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-3">
          {/* Team-Schnitt */}
          {data && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
                <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                  {data.team_schnitt_stopps}
                </div>
                <div className="text-[9px] text-slate-400">Ø Stopps Team</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2.5 text-center">
                <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                  {data.team_schnitt_puenktlichkeit_pct}%
                </div>
                <div className="text-[9px] text-slate-400">Ø Pünktlichkeit</div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="space-y-1.5">
            {(data?.fahrer ?? []).map(f => {
              const rangKlasse = getRangKlasse(f.rang, total);
              const isTop = f.rang === 1;
              return (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2',
                    rangKlasse.bg, rangKlasse.border,
                  )}
                >
                  {/* Rang */}
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isTop ? 'bg-amber-400 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700',
                  )}>
                    {isTop ? '🥇' : f.rang}
                  </div>

                  {/* Name + Trend */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {f.fahrer_name}
                      </span>
                      {TREND_ICON[f.trend]}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {f.km_heute.toFixed(1)} km · {fmtEur(f.verdienst_heute_eur)}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{f.stopps_heute}</div>
                      <div className="text-[9px] text-slate-400">Stopps</div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        'text-sm font-bold',
                        f.puenktlichkeit_pct >= 85 ? 'text-emerald-600 dark:text-emerald-400' :
                        f.puenktlichkeit_pct >= 70 ? 'text-amber-600 dark:text-amber-400' :
                        'text-rose-600 dark:text-rose-400',
                      )}>
                        {f.puenktlichkeit_pct}%
                      </div>
                      <div className="text-[9px] text-slate-400">Pünktl.</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {top && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Users className="w-3 h-3 shrink-0" />
              <span>Bester heute: <strong>{top.fahrer_name}</strong> mit {top.stopps_heute} Stopps und {top.puenktlichkeit_pct}% Pünktlichkeit</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
