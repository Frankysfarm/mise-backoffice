'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Circle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1472 — Bestellungs-Prioritäts-Ampel (Kitchen)
// Ampelkodierung aller aktiven Bestellungen nach Dringlichkeit (grün/gelb/rot)
// + Übersicht wie viele je Stufe. Props-basiert. Nach Phase 1468.

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
}

interface Props {
  orders: Order[];
}

type Stufe = 'kritisch' | 'dringend' | 'normal';

interface KlassifizierteBestellung {
  id: string;
  bestellnummer: string | null;
  stufe: Stufe;
  warteMin: number;
}

const STUFEN_CFG: Record<Stufe, { label: string; cls: string; bg: string; icon: typeof Circle }> = {
  kritisch: { label: 'Kritisch',  cls: 'text-rose-700 dark:text-rose-400',   bg: 'bg-rose-50   dark:bg-rose-900/20   border-rose-200 dark:border-rose-800',   icon: AlertTriangle },
  dringend: { label: 'Dringend',  cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50  dark:bg-amber-900/20  border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  normal:   { label: 'Normal',    cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
};

function klassifiziere(order: Order): KlassifizierteBestellung {
  const warteMs = order.bestellt_am
    ? Date.now() - new Date(order.bestellt_am).getTime()
    : 0;
  const warteMin = Math.floor(warteMs / 60_000);
  let stufe: Stufe = 'normal';
  if (warteMin >= 25) stufe = 'kritisch';
  else if (warteMin >= 12) stufe = 'dringend';
  return {
    id: order.id,
    bestellnummer: order.bestellnummer ?? null,
    stufe,
    warteMin,
  };
}

export function KitchenPhase1472BestellungsPrioritaetsAmpel({ orders }: Props) {
  const aktive = orders.filter((o) =>
    ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status),
  );

  const klassifiziert = useMemo(() => aktive.map(klassifiziere), [aktive]);

  const zaehler: Record<Stufe, number> = { kritisch: 0, dringend: 0, normal: 0 };
  for (const k of klassifiziert) zaehler[k.stufe]++;

  const sorted = [...klassifiziert].sort((a, b) => {
    const rnk: Record<Stufe, number> = { kritisch: 0, dringend: 1, normal: 2 };
    return rnk[a.stufe] - rnk[b.stufe] || b.warteMin - a.warteMin;
  });

  if (aktive.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider">Prioritäts-Ampel</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{aktive.length} Bestellungen</span>
      </div>

      {/* Zähler-Zeile */}
      <div className="grid grid-cols-3 divide-x border-b">
        {(['kritisch', 'dringend', 'normal'] as Stufe[]).map((s) => {
          const cfg = STUFEN_CFG[s];
          return (
            <div key={s} className="flex flex-col items-center py-2.5 gap-0.5">
              <div className={cn('text-2xl font-black tabular-nums', cfg.cls)}>{zaehler[s]}</div>
              <div className={cn('text-[10px] font-bold uppercase tracking-wide', cfg.cls)}>{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* Bestellliste */}
      <div className="divide-y max-h-64 overflow-y-auto">
        {sorted.map((k) => {
          const cfg = STUFEN_CFG[k.stufe];
          const Icon = cfg.icon;
          return (
            <div key={k.id} className={cn('flex items-center gap-3 px-4 py-2', cfg.bg, 'border-l-4', k.stufe === 'kritisch' ? 'border-l-rose-500' : k.stufe === 'dringend' ? 'border-l-amber-400' : 'border-l-emerald-400')}>
              <Icon className={cn('h-4 w-4 shrink-0', cfg.cls)} />
              <span className="text-sm font-semibold">
                {k.bestellnummer ? `#${k.bestellnummer}` : k.id.slice(0, 8)}
              </span>
              <span className={cn('ml-auto text-xs font-bold', cfg.cls)}>
                {k.warteMin} Min
              </span>
              <span className={cn('text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 border', cfg.cls, cfg.bg)}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
