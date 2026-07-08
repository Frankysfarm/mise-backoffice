'use client';

import { useMemo } from 'react';

interface Props {
  status?: string;
  isDelivery?: boolean;
  etaMinuten?: number;
}

interface Schritt {
  key: string;
  label: string;
  emoji: string;
}

const ABHOLUNG_SCHRITTE: Schritt[] = [
  { key: 'bestellt', label: 'Bestellt', emoji: '📋' },
  { key: 'zubereitung', label: 'In Zubereitung', emoji: '👨‍🍳' },
  { key: 'fertig', label: 'Bereit zur Abholung', emoji: '✅' },
];

const LIEFER_SCHRITTE: Schritt[] = [
  { key: 'bestellt', label: 'Bestellt', emoji: '📋' },
  { key: 'zubereitung', label: 'In Zubereitung', emoji: '👨‍🍳' },
  { key: 'unterwegs', label: 'Unterwegs', emoji: '🛵' },
  { key: 'geliefert', label: 'Geliefert', emoji: '🏠' },
];

function statusZuSchritt(status: string | undefined, isDelivery: boolean): number {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (s.includes('geliefert') || s.includes('delivered') || s.includes('completed')) return isDelivery ? 3 : 2;
  if (s.includes('unterwegs') || s.includes('in_lieferung') || s.includes('on_the_way')) return 2;
  if (s.includes('fertig') || s.includes('ready')) return isDelivery ? 1 : 2;
  if (s.includes('zubereitung') || s.includes('cooking') || s.includes('in_prep')) return 1;
  return 0;
}

export function Phase745BestellstatusLeiste({ status, isDelivery = false, etaMinuten }: Props) {
  const schritte = isDelivery ? LIEFER_SCHRITTE : ABHOLUNG_SCHRITTE;
  const aktuellerSchritt = useMemo(() => statusZuSchritt(status, isDelivery), [status, isDelivery]);

  if (!status) return null;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1">
        {schritte.map((s, i) => {
          const erledigt = i < aktuellerSchritt;
          const aktuell = i === aktuellerSchritt;
          return (
            <div key={s.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm border-2 transition-all ${
                  erledigt ? 'bg-emerald-500 border-emerald-500 text-white'
                  : aktuell ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                  : 'bg-muted border-muted-foreground/20 text-muted-foreground/40'
                }`}>
                  {erledigt ? '✓' : s.emoji}
                </div>
                <p className={`text-[9px] mt-1 text-center leading-tight ${
                  aktuell ? 'font-bold text-blue-600 dark:text-blue-400'
                  : erledigt ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground/50'
                }`}>
                  {s.label}
                </p>
              </div>
              {i < schritte.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded-full ${i < aktuellerSchritt ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </div>
          );
        })}
      </div>
      {etaMinuten && aktuellerSchritt < schritte.length - 1 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Geschätzte Zeit: ca. {etaMinuten} Min
        </p>
      )}
    </div>
  );
}
