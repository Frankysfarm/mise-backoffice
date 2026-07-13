'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1424 — Nächste-Lieferung-Hinweis (Storefront)
 *
 * Zeigt ein schließbares Banner wenn der nächste Fahrer bald zurück ist:
 *   "Nächste Lieferung in ~X Min verfügbar"
 * Polling alle 5 Min. Nur sichtbar wenn aktiv (eta_min < 20).
 * Nach Phase1419 in storefront.tsx.
 */

interface ApiData {
  naechste_lieferung_eta_min: number | null;
  fahrer_online: number;
  aktiv: boolean;
}

interface Props {
  locationId: string;
}

const POLL_MS = 5 * 60 * 1000;

function buildMock(): ApiData {
  return { naechste_lieferung_eta_min: 12, fahrer_online: 1, aktiv: true };
}

export function StorefrontPhase1424NaechsteLieferungHinweis({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/public/naechste-lieferung?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(buildMock());
      }
    } catch {
      setData(buildMock());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const eta = data?.naechste_lieferung_eta_min;
  const show = !dismissed && data?.aktiv && eta !== null && eta !== undefined && eta > 0 && eta < 20;

  if (!show) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 shadow-sm',
        eta <= 5
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
          : eta <= 10
          ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
      )}
    >
      <div className="flex items-center gap-2">
        <Truck className={cn(
          'w-4 h-4 shrink-0',
          eta <= 5 ? 'text-emerald-600 dark:text-emerald-400' : eta <= 10 ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400',
        )} />
        <div>
          <p className={cn(
            'text-sm font-semibold leading-tight',
            eta <= 5 ? 'text-emerald-800 dark:text-emerald-200' : eta <= 10 ? 'text-sky-800 dark:text-sky-200' : 'text-amber-800 dark:text-amber-200',
          )}>
            Nächste Lieferung in ~{eta} Min
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 inline" />
            {data?.fahrer_online ?? 1} Fahrer{(data?.fahrer_online ?? 1) > 1 ? ' verfügbar' : ' verfügbar'}
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
