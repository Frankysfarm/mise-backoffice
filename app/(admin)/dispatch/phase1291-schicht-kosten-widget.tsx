'use client';

// Phase 1291 — Schicht-Kosten-Widget (Dispatch)
// Gesamtkosten / Umsatz / Gewinn + Break-Even-Ampel aus schicht-kosten-kalkulation-API
// 15-Min-Polling · locationId-Prop · nach Phase1287

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiResponse {
  umsatz_eur: number;
  personalkosten_eur: number;
  fahrtkosten_eur: number;
  gesamt_kosten_eur: number;
  deckungsbeitrag_eur: number;
  marge_pct: number;
  status: 'gewinn' | 'kostendeckend' | 'verlust';
  aktive_fahrer: number;
  generiert_am: string;
}

const STATUS_CONFIG = {
  gewinn: { label: 'Gewinn', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: TrendingUp },
  kostendeckend: { label: 'Kostendeckend', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', icon: Minus },
  verlust: { label: 'Verlust', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40', icon: TrendingDown },
};

function fmt(eur: number) {
  return eur.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function DispatchPhase1291SchichtKostenWidget({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-kosten-kalkulation?location_id=${locationId}`);
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

  const cfg = STATUS_CONFIG[data.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-600 dark:bg-slate-700 text-white"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4" />
          <span className="text-sm font-semibold">Schicht-Kosten</span>
          <span className={cn('ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
            {cfg.label}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Break-Even-Ampel */}
          <div className={cn('flex items-center gap-3 rounded-xl p-3', cfg.bg)}>
            <Icon className={cn('h-6 w-6 shrink-0', cfg.color)} />
            <div>
              <div className={cn('text-sm font-bold', cfg.color)}>
                Deckungsbeitrag: {fmt(data.deckungsbeitrag_eur)}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400">
                Marge: {data.marge_pct}% · {data.aktive_fahrer} aktive Fahrer
              </div>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Umsatz', value: fmt(data.umsatz_eur), color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Personalkosten', value: fmt(data.personalkosten_eur), color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Fahrtkosten', value: fmt(data.fahrtkosten_eur), color: 'text-orange-600 dark:text-orange-400' },
            ].map(kpi => (
              <div key={kpi.label} className="rounded-xl bg-stone-50 dark:bg-stone-800 p-3 text-center">
                <div className={cn('text-base font-bold', kpi.color)}>{kpi.value}</div>
                <div className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Gesamtkosten */}
          <div className="flex items-center justify-between rounded-xl bg-stone-100 dark:bg-stone-800 px-4 py-2">
            <span className="text-xs text-stone-600 dark:text-stone-400">Gesamtkosten</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(data.gesamt_kosten_eur)}</span>
          </div>

          <div className="text-[10px] text-stone-400 dark:text-stone-500 text-right">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
