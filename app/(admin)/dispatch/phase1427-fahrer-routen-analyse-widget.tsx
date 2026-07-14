'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Route, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1427 — Fahrer-Routen-Analyse-Widget (Dispatch)
 *
 * Zeigt Phase1425-API (/api/delivery/admin/fahrer-routen-analyse):
 *   • km/Stopp-Rangliste je Fahrer
 *   • Optimierungspotenzial-Badge (hoch/mittel/niedrig)
 *   • Häufigste Zone + Gesamt-KPIs
 *   • 15-Min-Polling
 *
 * Nach Phase1422 in dispatch/client.tsx.
 */

type Potential = 'hoch' | 'mittel' | 'niedrig';

interface FahrerKpi {
  fahrer_id: string;
  name: string;
  km_gesamt: number;
  stopps_gesamt: number;
  km_pro_stopp: number;
  haeufigste_zone: string;
  optimierungspotenzial: Potential;
}

interface ApiData {
  fahrer: FahrerKpi[];
  gesamt_km: number;
  gesamt_stopps: number;
  ø_km_pro_stopp: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POT_CFG: Record<Potential, { label: string; color: string; bg: string }> = {
  hoch:    { label: 'Hoch',    color: 'text-rose-700 dark:text-rose-400',    bg: 'bg-rose-100 dark:bg-rose-900/30'    },
  mittel:  { label: 'Mittel',  color: 'text-amber-700 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/30'  },
  niedrig: { label: 'Niedrig', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const POLL_MS = 15 * 60 * 1000;

export function DispatchPhase1427FahrerRoutenAnalyseWidget({ locationId }: Props) {
  const [data, setData]       = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-analyse?location_id=${locationId}`);
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

  const avg = data.ø_km_pro_stopp;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Routen-Analyse</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Ø {avg} km/Stopp</span>
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Gesamt-KPIs */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Gesamt km',    value: `${data.gesamt_km}` },
              { label: 'Gesamt Stopps', value: `${data.gesamt_stopps}` },
              { label: 'Ø km/Stopp',   value: `${avg}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-center">
                <div className="text-base font-black tabular-nums text-slate-800 dark:text-slate-100">{value}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          {/* Fahrer-Liste */}
          <div className="space-y-1.5">
            {data.fahrer.map((f) => {
              const pot  = POT_CFG[f.optimierungspotenzial];
              const delta = f.km_pro_stopp - avg;
              const Icon  = delta > 0.3 ? TrendingUp : delta < -0.3 ? TrendingDown : Minus;
              const iColor = delta > 0.3 ? 'text-rose-500' : delta < -0.3 ? 'text-emerald-500' : 'text-slate-400';
              return (
                <div
                  key={f.fahrer_id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                >
                  <Icon className={cn('w-3.5 h-3.5 shrink-0', iColor)} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-20 truncate">{f.name}</span>
                  <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">{f.km_pro_stopp} km/Stopp</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Zone {f.haeufigste_zone}</span>
                  <span className={cn('ml-auto text-[10px] font-bold rounded-full px-2 py-0.5', pot.bg, pot.color)}>
                    {pot.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Letzte 14 Tage · Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 15 Min
          </p>
        </div>
      )}
    </div>
  );
}
