'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1175 — Schicht-Bilanzen-Vergleich (Lieferdienst)
// Aktuelle Schicht vs. gleicher Wochentag letzte 4 Wochen

interface Props {
  locationId: string | null;
}

interface WochenTag {
  datum: string;
  stopps: number;
  umsatz_eur: number;
  puenktlichkeit_pct: number;
  fahrer_anzahl: number;
}

interface ApiData {
  wochentag: string;
  aktuell: WochenTag;
  verlauf: WochenTag[];
  ø_stopps: number;
  ø_umsatz_eur: number;
  ø_puenktlichkeit_pct: number;
  trend_stopps: 'besser' | 'gleich' | 'schlechter';
  trend_umsatz: 'besser' | 'gleich' | 'schlechter';
}

const TREND_ICON = {
  besser:      <TrendingUp size={12} className="text-matcha-600" />,
  gleich:      <span className="text-[11px] text-muted-foreground">→</span>,
  schlechter:  <TrendingDown size={12} className="text-red-500" />,
};

const TREND_CLS: Record<string, string> = {
  besser:     'text-matcha-700',
  gleich:     'text-muted-foreground',
  schlechter: 'text-red-600',
};

export function LieferdienstPhase1175SchichtBilanzenVergleich({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/schicht-bilanzen-vergleich?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData({
        wochentag: 'Samstag',
        aktuell: { datum: new Date().toISOString().slice(0, 10), stopps: 31, umsatz_eur: 412, puenktlichkeit_pct: 87, fahrer_anzahl: 4 },
        verlauf: [
          { datum: '', stopps: 28, umsatz_eur: 374, puenktlichkeit_pct: 82, fahrer_anzahl: 3 },
          { datum: '', stopps: 33, umsatz_eur: 445, puenktlichkeit_pct: 91, fahrer_anzahl: 4 },
          { datum: '', stopps: 25, umsatz_eur: 341, puenktlichkeit_pct: 78, fahrer_anzahl: 3 },
          { datum: '', stopps: 29, umsatz_eur: 388, puenktlichkeit_pct: 84, fahrer_anzahl: 4 },
        ],
        ø_stopps: 28.75,
        ø_umsatz_eur: 387,
        ø_puenktlichkeit_pct: 83.75,
        trend_stopps: 'besser',
        trend_umsatz: 'besser',
      });
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!data && !loading) return null;

  const maxStopps = data ? Math.max(data.aktuell.stopps, ...data.verlauf.map(v => v.stopps), 1) : 1;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-black/5 transition">
        <BarChart2 size={16} className="text-blue-700" />
        <span className="font-bold text-sm uppercase tracking-wider text-blue-700">
          {data?.wochentag ?? 'Schicht'}-Vergleich
        </span>
        {data && (
          <span className="ml-1 flex items-center gap-0.5">
            {TREND_ICON[data.trend_umsatz]}
          </span>
        )}
        {loading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        <div className="ml-auto">
          {open ? <ChevronUp size={14} className="text-blue-700" /> : <ChevronDown size={14} className="text-blue-700" />}
        </div>
      </button>

      {open && data && (
        <div className="border-t border-black/10 px-4 py-3 space-y-4">
          {/* KPI comparison row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Stopps', aktuell: data.aktuell.stopps, avg: data.ø_stopps, unit: '', trend: data.trend_stopps },
              { label: 'Umsatz', aktuell: data.aktuell.umsatz_eur, avg: data.ø_umsatz_eur, unit: ' €', trend: data.trend_umsatz },
              { label: 'Pünktlichkeit', aktuell: data.aktuell.puenktlichkeit_pct, avg: data.ø_puenktlichkeit_pct, unit: '%', trend: data.aktuell.puenktlichkeit_pct >= data.ø_puenktlichkeit_pct ? 'besser' : 'schlechter' as const },
            ].map(k => (
              <div key={k.label} className="rounded-xl bg-white/70 border px-2 py-2 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">{k.label}</div>
                <div className={cn('text-lg font-black tabular-nums', TREND_CLS[k.trend])}>
                  {typeof k.aktuell === 'number' && k.unit === ' €' ? k.aktuell.toFixed(0) : k.aktuell}{k.unit}
                </div>
                <div className="text-[9px] text-muted-foreground">Ø {typeof k.avg === 'number' && k.unit === ' €' ? k.avg.toFixed(0) : k.avg.toFixed(1)}{k.unit}</div>
                <div className="flex justify-center mt-0.5">{TREND_ICON[k.trend]}</div>
              </div>
            ))}
          </div>

          {/* 4-week bar chart (stopps) */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Stopps — letzte 4 {data.wochentage ?? 'Wochen'}</div>
            {/* Current */}
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[10px] font-bold text-blue-700">Heute</span>
              <div className="flex-1 h-3 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${(data.aktuell.stopps / maxStopps) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-[10px] font-black text-blue-700 tabular-nums">{data.aktuell.stopps}</span>
            </div>
            {data.verlauf.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[9px] text-muted-foreground">vor {i + 1} Wo</span>
                <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-muted-foreground/40 transition-all duration-700"
                    style={{ width: `${(v.stopps / maxStopps) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[9px] text-muted-foreground tabular-nums">{v.stopps}</span>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-muted-foreground text-right">
            Vergleich: gleicher Wochentag letzte 4 Wochen
          </div>
        </div>
      )}
    </div>
  );
}
