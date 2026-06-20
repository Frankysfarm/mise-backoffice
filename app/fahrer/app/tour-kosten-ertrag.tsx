'use client';

/* Phase 326: TourKostenErtrag
   Zeigt dem Fahrer Echtzeit-Einnahmen der aktuellen Tour:
   Verdienst pro Stopp, Gesamt, Durchschnitt pro Stopp.
*/

import { useMemo } from 'react';
import { Euro, TrendingUp, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  status: 'pending' | 'completed' | 'failed';
  trinkgeld?: number;
  bestellwert?: number;
};

interface Props {
  stops: Stop[];
  basisVerdienst?: number;  // € pro abgeschlossenem Stopp
  trinkgeldSumme?: number;  // direkt übergeben falls vorhanden
  className?: string;
}

export function TourKostenErtrag({
  stops,
  basisVerdienst = 3.5,
  trinkgeldSumme,
  className,
}: Props) {
  const stats = useMemo(() => {
    const abgeschlossen = stops.filter((s) => s.status === 'completed');
    const gesamt = stops.length;
    const done = abgeschlossen.length;

    const basisGesamt = done * basisVerdienst;
    const tips = trinkgeldSumme ?? abgeschlossen.reduce((s, o) => s + (o.trinkgeld ?? 0), 0);
    const total = basisGesamt + tips;

    const prognose = gesamt > 0 && done > 0
      ? (total / done) * gesamt
      : null;

    return { done, gesamt, basisGesamt, tips, total, prognose };
  }, [stops, basisVerdienst, trinkgeldSumme]);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={cn('rounded-2xl bg-white border border-stone-200 overflow-hidden', className)}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
          <Euro className="h-3.5 w-3.5 text-matcha-700" />
        </div>
        <div>
          <div className="text-sm font-bold text-stone-800">Tour-Einnahmen</div>
          <div className="text-[10px] text-stone-400">
            {stats.done} / {stats.gesamt} Stopps erledigt
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xl font-black text-matcha-700 tabular-nums">
            {fmtEur(stats.total)} €
          </div>
          <div className="text-[10px] text-stone-400">bisher</div>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-base font-black text-stone-800 tabular-nums">
            {fmtEur(stats.basisGesamt)} €
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Basis</div>
        </div>
        <div className="text-center border-x border-stone-100">
          <div className="text-base font-black text-amber-600 tabular-nums">
            {fmtEur(stats.tips)} €
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Trinkgeld</div>
        </div>
        <div className="text-center">
          <div className="text-base font-black text-stone-500 tabular-nums">
            {stats.done > 0
              ? `${fmtEur(stats.total / stats.done)} €`
              : '–'}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Ø / Stopp</div>
        </div>
      </div>

      {stats.prognose !== null && stats.done < stats.gesamt && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-matcha-50 border-t border-matcha-100">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-[11px] text-matcha-700">
            Prognose Tour-Gesamt:{' '}
            <span className="font-black">{fmtEur(stats.prognose)} €</span>
          </span>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-matcha-500">
            <Package className="h-3 w-3" />
            {stats.gesamt - stats.done} verbleibend
          </div>
        </div>
      )}

      {/* Fortschrittsbalken */}
      {stats.gesamt > 0 && (
        <div className="px-4 pb-3 pt-1">
          <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all"
              style={{ width: `${(stats.done / stats.gesamt) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
