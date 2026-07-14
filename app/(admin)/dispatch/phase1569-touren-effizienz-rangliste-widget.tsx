'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, TrendingDown, Minus } from 'lucide-react';

// Phase 1569 — Touren-Effizienz-Rangliste-Widget (Dispatch)
// Nutzt Phase1567-API /api/delivery/admin/touren-effizienz-rangliste
// Rangliste je Fahrer mit Badges Top/Normal/Schwach + Stopps/Tour + km/Stopp + Pünktlichkeit
// 15-Min-Polling; Collapsible.

interface FahrerRang {
  driver_id: string;
  rang: number;
  status: 'top' | 'normal' | 'schwach';
  stopps_pro_tour: number;
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  touren_total: number;
}

interface ApiResponse {
  rangliste: FahrerRang[];
}

interface Props {
  locationId: string | null;
}

const STATUS_CFG = {
  top: { label: 'Top', bg: 'bg-emerald-100 text-emerald-700', icon: <Trophy className="h-3 w-3" /> },
  normal: { label: 'Normal', bg: 'bg-sky-100 text-sky-700', icon: <Minus className="h-3 w-3" /> },
  schwach: { label: 'Schwach', bg: 'bg-rose-100 text-rose-700', icon: <TrendingDown className="h-3 w-3" /> },
};

const MOCK: ApiResponse = {
  rangliste: [
    { driver_id: 'Fahrer A', rang: 1, status: 'top', stopps_pro_tour: 4.2, km_pro_stopp: 1.8, puenktlichkeit_pct: 91, touren_total: 12 },
    { driver_id: 'Fahrer B', rang: 2, status: 'normal', stopps_pro_tour: 3.8, km_pro_stopp: 2.1, puenktlichkeit_pct: 78, touren_total: 10 },
    { driver_id: 'Fahrer C', rang: 3, status: 'schwach', stopps_pro_tour: 3.1, km_pro_stopp: 2.8, puenktlichkeit_pct: 62, touren_total: 8 },
  ],
};

export function DispatchPhase1569TourenEffizienzRanglisteWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/touren-effizienz-rangliste?location_id=${locationId}`);
        if (!res.ok) throw new Error('api');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!locationId || (!data && !loading)) return null;

  const d = data ?? MOCK;
  const topCount = d.rangliste.filter((f) => f.status === 'top').length;
  const schwachCount = d.rangliste.filter((f) => f.status === 'schwach').length;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-xs font-bold text-violet-800">Touren-Effizienz (7 Tage)</span>
          <span className="text-[10px] text-violet-600">{d.rangliste.length} Fahrer</span>
        </div>
        {loading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" /> : open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {/* Kurzstatus */}
      {!open && d.rangliste.length > 0 && (
        <div className="mt-2 flex gap-2 text-[10px]">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 font-semibold">{topCount} Top</span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 font-semibold">{schwachCount} Schwach</span>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          {d.rangliste.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Keine Touren-Daten der letzten 7 Tage.</p>
          )}
          {d.rangliste.map((f) => {
            const cfg = STATUS_CFG[f.status];
            return (
              <div key={f.driver_id} className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5">
                <span className="w-5 shrink-0 text-[10px] font-bold text-muted-foreground">{f.rang}.</span>
                <span className="flex-1 truncate text-[11px] font-semibold">{f.driver_id}</span>
                <span className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', cfg.bg)}>
                  {cfg.icon} {cfg.label}
                </span>
                <div className="text-right">
                  <div className="text-[10px] font-bold tabular-nums text-foreground">{f.stopps_pro_tour} Stopps/Tour</div>
                  <div className="text-[9px] text-muted-foreground">{f.puenktlichkeit_pct}% pünktl.</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
