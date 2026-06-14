'use client';

/**
 * CashflowTracker — Zeigt dem Fahrer, wie viel Bargeld er bei den
 * verbleibenden Stops kassieren muss.
 *
 * Unterscheidet:
 *  - Bar-Stops: Betrag einzukassieren
 *  - Bereits bezahlte / kartenbasierte Stops: kein Bargeld nötig
 *
 * Hilft, sich auf Wechselgeld vorzubereiten und vermeidet Überraschungen.
 */

import { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { Banknote, CheckCircle2 } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  };
};

interface Props {
  stops: Stop[];
}

type CashStop = {
  stop: Stop;
  betrag: number;
  isDone: boolean;
};

export function CashflowTracker({ stops }: Props) {
  const cashStops: CashStop[] = useMemo(() => {
    return stops
      .filter(s => {
        const z = s.order.zahlungsart?.toLowerCase() ?? 'bar';
        return z === 'bar' || z === 'cash' || z === 'barzahlung';
      })
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
      .map(s => ({
        stop: s,
        betrag: s.order.gesamtbetrag,
        isDone: !!s.geliefert_am,
      }));
  }, [stops]);

  const totalCashRemaining = useMemo(
    () => cashStops.filter(cs => !cs.isDone).reduce((s, cs) => s + cs.betrag, 0),
    [cashStops],
  );

  const totalCashDone = useMemo(
    () => cashStops.filter(cs => cs.isDone).reduce((s, cs) => s + cs.betrag, 0),
    [cashStops],
  );

  // Keine Bar-Stops → kein Widget nötig
  if (!cashStops.length) return null;

  const remainingStops = cashStops.filter(cs => !cs.isDone);

  return (
    <div className="mx-4 mb-3 rounded-2xl overflow-hidden border border-amber-500/30 bg-amber-500/5">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10">
        <Banknote size={13} className="text-amber-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 flex-1">
          Bargeld-Stops
        </span>
        <span className="text-[12px] font-black text-amber-200 tabular-nums">
          {euro(totalCashRemaining)}
        </span>
      </div>

      {/* Stop-Liste */}
      <div className="px-3 py-2 space-y-1.5">
        {cashStops.map(({ stop, betrag, isDone }) => (
          <div
            key={stop.id}
            className={cn(
              'flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all',
              isDone
                ? 'bg-matcha-800/20 opacity-50'
                : 'bg-amber-500/10 border border-amber-500/20',
            )}
          >
            {/* Stop-Nummer */}
            <div className={cn(
              'shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black',
              isDone ? 'bg-matcha-700 text-matcha-300' : 'bg-amber-500 text-matcha-900',
            )}>
              {isDone ? '✓' : stop.reihenfolge}
            </div>

            {/* Name */}
            <span className={cn(
              'flex-1 min-w-0 text-[11px] font-semibold truncate',
              isDone ? 'text-matcha-500 line-through' : 'text-matcha-100',
            )}>
              {stop.order.kunde_name}
            </span>

            {/* Betrag */}
            <span className={cn(
              'shrink-0 text-[12px] font-black tabular-nums',
              isDone ? 'text-matcha-500' : 'text-amber-300',
            )}>
              {euro(betrag)}
            </span>

            {isDone && <CheckCircle2 size={12} className="shrink-0 text-matcha-500" />}
          </div>
        ))}
      </div>

      {/* Footer: Gesamtübersicht */}
      {totalCashDone > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-1 text-[9px] text-matcha-400">
            <CheckCircle2 size={10} />
            <span>Kassiert: {euro(totalCashDone)}</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-amber-400 font-bold">
            <Banknote size={10} />
            <span>Noch: {euro(totalCashRemaining)}</span>
          </div>
        </div>
      )}

      {!remainingStops.length && totalCashDone > 0 && (
        <div className="flex items-center justify-center gap-1.5 px-3 py-2 border-t border-matcha-700/30">
          <CheckCircle2 size={12} className="text-matcha-400" />
          <span className="text-[10px] font-bold text-matcha-400">
            Alle Bar-Stops kassiert — {euro(totalCashDone)} insgesamt
          </span>
        </div>
      )}
    </div>
  );
}
