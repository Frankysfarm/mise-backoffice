'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, Euro } from 'lucide-react';
import type { EinnahmenHochrechnungResponse } from '@/app/api/delivery/driver/einnahmen-hochrechnung/route';

/**
 * Phase 1725 — Einnahmen-Hochrechnung-Karte (Fahrer-App)
 *
 * Projektion Tagesverdienst basierend auf bisherigem Stunden-Tempo.
 * Konfidenz-Balken. isOnline-Guard. 15-Min-Polling.
 */

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const POLL_MS = 15 * 60_000;

function KonfidenzBalken({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Konfidenz</span>
        <span className="font-mono font-bold text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10">
        <div className={cn('h-1.5 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FahrerPhase1725EinnahmenHochrechnungKarte({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<EinnahmenHochrechnungResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/einnahmen-hochrechnung?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const verdienstDiff = data.prognose_eur - data.bisher_eur;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10 p-3 mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
          <TrendingUp className="h-4 w-4" />
          Tagesverdienst-Prognose
          {loading && <span className="text-[10px] font-normal text-muted-foreground">lädt…</span>}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-emerald-950/20 p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Bisher</p>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
                {data.bisher_eur.toFixed(2)} €
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-950/20 p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">Prognose heute</p>
              <p className="text-lg font-black text-blue-700 dark:text-blue-300 font-mono">
                {data.prognose_eur.toFixed(2)} €
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 bg-background text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Euro className="h-3 w-3" />
              {data.euro_pro_stunde.toFixed(2)} €/h
            </span>
            <span className="text-muted-foreground">
              {data.stunden_online}h online
            </span>
            {verdienstDiff > 0 && (
              <span className="font-bold text-blue-600 dark:text-blue-400">
                +{verdienstDiff.toFixed(2)} € erwartet
              </span>
            )}
          </div>

          <KonfidenzBalken pct={data.konfidenz} />

          <p className="text-[10px] text-muted-foreground">
            15-Min-Aktualisierung · Prognose für {data.prognose_stunden_rest}h Restschicht
          </p>
        </div>
      )}
    </div>
  );
}
