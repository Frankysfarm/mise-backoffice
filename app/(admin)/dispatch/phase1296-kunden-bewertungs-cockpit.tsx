'use client';

// Phase 1296 — Kunden-Bewertungs-Cockpit (Dispatch)
// Wochentag-Balken + Beschwerden-Liste + Trend-Badge aus /api/delivery/admin/kunden-bewertungs-aggregat
// 15-Min-Polling · locationId-Prop · nach Phase1291

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WochentagBewertung {
  wochentag: number;
  label: string;
  durchschnitt: number;
  anzahl: number;
}

interface ApiResponse {
  wochentag_verlauf: WochentagBewertung[];
  gesamt_schnitt: number;
  top_beschwerden: string[];
  trend: 'positiv' | 'stabil' | 'negativ';
  trend_pct: number;
  total_bewertungen: number;
  generiert_am: string;
}

const TREND_CONFIG = {
  positiv: { label: 'Steigend', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: TrendingUp },
  stabil: { label: 'Stabil', color: 'text-stone-600 dark:text-stone-400', bg: 'bg-stone-100 dark:bg-stone-800', icon: Minus },
  negativ: { label: 'Fallend', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', icon: TrendingDown },
};

function schnittFarbe(schnitt: number): string {
  if (schnitt >= 4.0) return 'bg-emerald-500';
  if (schnitt >= 3.5) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DispatchPhase1296KundenBewertungsCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kunden-bewertungs-aggregat?location_id=${locationId}`);
        if (active && res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId || loading) return null;
  if (!data) return null;

  const trendCfg = TREND_CONFIG[data.trend];
  const TrendIcon = trendCfg.icon;
  const alertNegativ = data.trend === 'negativ' && data.gesamt_schnitt < 3.5;
  const maxSchnitt = Math.max(...data.wochentag_verlauf.map(d => d.durchschnitt), 5);

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-white',
          alertNegativ ? 'bg-red-600 dark:bg-red-700' : 'bg-violet-600 dark:bg-violet-700',
        )}
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          <span className="text-sm font-semibold">Kunden-Bewertungs-Cockpit</span>
          <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
            Ø {data.gesamt_schnitt.toFixed(1)} ★
          </span>
          {alertNegativ && (
            <span className="text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 animate-pulse">
              KRITISCH
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Trend-Badge + Gesamtschnitt */}
          <div className="flex items-center justify-between">
            <div className={cn('flex items-center gap-2 rounded-xl px-3 py-2', trendCfg.bg)}>
              <TrendIcon className={cn('h-4 w-4', trendCfg.color)} />
              <span className={cn('text-xs font-bold', trendCfg.color)}>
                {trendCfg.label} {data.trend_pct > 0 ? '+' : ''}{data.trend_pct}%
              </span>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-stone-800 dark:text-stone-100">
                {data.gesamt_schnitt.toFixed(1)} <span className="text-amber-500">★</span>
              </div>
              <div className="text-[10px] text-stone-400">{data.total_bewertungen} Bewertungen</div>
            </div>
          </div>

          {/* Wochentag-Balken */}
          <div className="space-y-1">
            <div className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
              Ø-Bewertung je Wochentag
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {data.wochentag_verlauf.map(d => (
                <div key={d.wochentag} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn('w-full rounded-t-sm', schnittFarbe(d.durchschnitt))}
                    style={{ height: `${Math.round((d.durchschnitt / maxSchnitt) * 48)}px` }}
                    title={`${d.label}: ${d.durchschnitt.toFixed(1)} ★ (${d.anzahl})`}
                  />
                  <span className="text-[9px] text-stone-500 dark:text-stone-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top-Beschwerden */}
          {data.top_beschwerden.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">
                Häufigste Beschwerden
              </div>
              {data.top_beschwerden.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3 py-1.5"
                >
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-300">{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-stone-400 dark:text-stone-500 text-right">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
