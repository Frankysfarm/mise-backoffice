'use client';

import { Banknote, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  reihenfolge: number | null;
  geliefert_am: string | null;
  order?: {
    bestellnummer?: string;
    kunde_name?: string;
    gesamtbetrag?: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  } | null;
}

interface Props {
  stops: TourStop[];
}

export function TourKassenRadar({ stops }: Props) {
  if (stops.length === 0) return null;

  const stopsWithPayment = stops.map((s) => {
    const zahlungsart = s.order?.zahlungsart ?? 'karte';
    const isCash = zahlungsart === 'bar' || zahlungsart === 'cash';
    const betrag = s.order?.gesamtbetrag ?? 0;
    const delivered = s.geliefert_am !== null;
    const bezahlt = s.order?.bezahlt ?? delivered;
    return {
      id: s.id,
      reihenfolge: s.reihenfolge ?? 0,
      kundeKurz: s.order?.kunde_name?.split(' ')[0] ?? 'Kunde',
      betrag,
      isCash,
      delivered,
      bezahlt,
    };
  });

  const cashStops = stopsWithPayment.filter((s) => s.isCash);
  const totalCash = cashStops.reduce((sum, s) => sum + s.betrag, 0);
  const collectedCash = cashStops.filter((s) => s.bezahlt || s.delivered).reduce((sum, s) => sum + s.betrag, 0);
  const remainingCash = totalCash - collectedCash;
  const nextCashStop = cashStops.find((s) => !s.bezahlt && !s.delivered);

  if (cashStops.length === 0) {
    return (
      <div className="rounded-2xl border border-matcha-100 bg-matcha-50 px-4 py-3 flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-matcha-500 shrink-0" />
        <div>
          <div className="text-xs font-bold text-matcha-700">Alle Stopps: Kartenzahlung</div>
          <div className="text-[10px] text-matcha-500">Kein Bargeld einzukassieren</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-amber-50 px-4 py-2.5 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-black text-amber-800">Kassen-Radar</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] text-amber-500 font-semibold uppercase">Gesamt Bar</div>
            <div className="text-sm font-black text-amber-800 tabular-nums">
              {totalCash.toFixed(2)} €
            </div>
          </div>
          {remainingCash > 0 && (
            <div className="text-right">
              <div className="text-[9px] text-red-400 font-semibold uppercase">Noch offen</div>
              <div className="text-sm font-black text-red-600 tabular-nums">
                {remainingCash.toFixed(2)} €
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stop list */}
      <div className="divide-y divide-stone-50">
        {cashStops.map((stop) => {
          const done = stop.bezahlt || stop.delivered;
          const isNext = stop.id === nextCashStop?.id;
          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                done ? 'opacity-50' : isNext ? 'bg-amber-50' : '',
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  done
                    ? 'bg-matcha-100 text-matcha-600'
                    : isNext
                    ? 'bg-amber-400 text-white'
                    : 'bg-stone-100 text-stone-500',
                )}
              >
                {stop.reihenfolge}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-800 truncate">{stop.kundeKurz}</span>
                  {isNext && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                      NÄCHSTER
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Banknote className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] text-stone-500">Bar · Wechselgeld bereit?</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-black tabular-nums',
                    done ? 'text-matcha-600 line-through' : isNext ? 'text-amber-700' : 'text-stone-700',
                  )}
                >
                  {stop.betrag.toFixed(2)} €
                </span>
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-matcha-500" />
                ) : isNext ? (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      {collectedCash > 0 && (
        <div className="px-4 py-2 bg-matcha-50 border-t border-matcha-100 flex justify-between items-center">
          <span className="text-[10px] text-matcha-600 font-semibold">Bereits kassiert</span>
          <span className="text-xs font-black text-matcha-700 tabular-nums">
            {collectedCash.toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
}
