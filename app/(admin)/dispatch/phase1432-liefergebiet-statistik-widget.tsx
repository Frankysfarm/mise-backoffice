'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1432 — Liefergebiet-Statistik-Widget (Dispatch)
 *
 * Zeigt Phase1430-API (/api/delivery/admin/liefergebiet-statistik):
 *   • PLZ-Rangliste nach Bestellaufkommen
 *   • Ø-Lieferzeit je Zone A/B/C/D
 *   • Engpass-Ampel je Zone
 *   • 15-Min-Polling
 *
 * Nach Phase1427 in dispatch/client.tsx.
 */

type Ampel = 'ok' | 'warnung' | 'kritisch';

interface PlzStat {
  plz: string;
  bestellungen: number;
  zone: string;
}

interface ZoneStat {
  zone: string;
  bestellungen: number;
  avg_lieferzeit_min: number;
  ampel: Ampel;
}

interface ApiData {
  top_plz: PlzStat[];
  zonen: ZoneStat[];
  gesamt_bestellungen: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const AMPEL_CFG: Record<Ampel, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  ok:       { icon: CheckCircle,   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20',  border: 'border-emerald-200 dark:border-emerald-700' },
  warnung:  { icon: Clock,         color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',      border: 'border-amber-200 dark:border-amber-700'     },
  kritisch: { icon: AlertTriangle, color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20',        border: 'border-rose-200 dark:border-rose-700'       },
};

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase1432LiefergebietStatistikWidget({ locationId }: Props) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefergebiet-statistik?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!locationId || !data) return null;

  const kritischCount = data.zonen.filter((z) => z.ampel === 'kritisch').length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Liefergebiet-Statistik</span>
          {kritischCount > 0 && (
            <span className="text-[10px] font-bold rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5">
              {kritischCount} Engpass
            </span>
          )}
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Zonen-Übersicht */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.zonen.map((z) => {
              const cfg  = AMPEL_CFG[z.ampel];
              const Icon = cfg.icon;
              return (
                <div
                  key={z.zone}
                  className={cn('rounded-lg border px-3 py-2 space-y-1', cfg.bg, cfg.border)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Zone {z.zone}</span>
                    <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                  </div>
                  <div className="text-base font-black tabular-nums text-slate-800 dark:text-slate-100">
                    {z.bestellungen}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Ø {z.avg_lieferzeit_min > 0 ? `${z.avg_lieferzeit_min} Min` : '–'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top-PLZ-Rangliste */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Top PLZ</p>
            {data.top_plz.slice(0, 5).map((p, i) => {
              const max = data.top_plz[0]?.bestellungen ?? 1;
              const pct = Math.round((p.bestellungen / max) * 100);
              return (
                <div key={p.plz} className="flex items-center gap-2">
                  <span className="w-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums text-right">
                    {i + 1}.
                  </span>
                  <span className="w-12 text-xs font-mono text-slate-700 dark:text-slate-200">{p.plz}</span>
                  <div className="flex-1 rounded-full bg-slate-100 dark:bg-slate-700 h-1.5">
                    <div
                      className="rounded-full bg-indigo-500 dark:bg-indigo-400 h-1.5 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-[10px] tabular-nums text-slate-500 dark:text-slate-400 text-right">
                    {p.bestellungen}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{p.zone}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Letzte 30 Tage · {data.gesamt_bestellungen} Bestellungen · alle 15 Min
          </p>
        </div>
      )}
    </div>
  );
}
