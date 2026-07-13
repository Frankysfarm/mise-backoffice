/**
 * Phase 1300 — Zubereitung-Engpass-Ampel (Kitchen)
 * Props-basiert: Wenn >3 Bestellungen gleichzeitig im Status "preparing" → rote Ampel + Empfehlung.
 * Integration: kitchen/client.tsx nach Phase1298.
 */
'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status?: string;
  status_label?: string;
  created_at?: string;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

interface AmpelInfo {
  farbe: Ampel;
  anzahl: number;
  label: string;
  empfehlung: string;
}

const SCHWELLE_ROT = 3;
const SCHWELLE_GELB = 2;

function berechneAmpel(orders: Order[]): AmpelInfo {
  const preparing = orders.filter(
    o => o.status === 'preparing' || o.status === 'in_preparation' || o.status_label === 'In Zubereitung'
  );
  const anzahl = preparing.length;

  if (anzahl > SCHWELLE_ROT) {
    return {
      farbe: 'rot',
      anzahl,
      label: `${anzahl} Bestellungen in Zubereitung — Engpass!`,
      empfehlung: `Küchen-Engpass: ${anzahl} Bestellungen gleichzeitig. Station aufstocken oder Reihenfolge priorisieren.`,
    };
  }
  if (anzahl >= SCHWELLE_GELB) {
    return {
      farbe: 'gelb',
      anzahl,
      label: `${anzahl} Bestellungen in Zubereitung — Auslastung erhöht`,
      empfehlung: 'Kapazität im Blick behalten. Bei weiteren Bestellungen Prioritäten setzen.',
    };
  }
  return {
    farbe: 'gruen',
    anzahl,
    label: anzahl === 0 ? 'Keine Bestellungen in Zubereitung' : `${anzahl} Bestellung${anzahl > 1 ? 'en' : ''} in Zubereitung`,
    empfehlung: 'Kapazität optimal — kein Engpass.',
  };
}

export function KitchenPhase1300ZubereitungEngpassAmpel({ orders }: Props) {
  const info = useMemo(() => berechneAmpel(orders), [orders]);

  const farbenMap: Record<Ampel, { bg: string; border: string; text: string; icon: string; dot: string }> = {
    gruen:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-300', icon: 'text-emerald-500', dot: 'bg-emerald-500' },
    gelb:   { bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-800 dark:text-amber-300',   icon: 'text-amber-500',   dot: 'bg-amber-500' },
    rot:    { bg: 'bg-red-50 dark:bg-red-950/30',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-800 dark:text-red-300',       icon: 'text-red-500',     dot: 'bg-red-500' },
  };

  const f = farbenMap[info.farbe];

  return (
    <div className={cn('rounded-xl border p-3 mb-3', f.bg, f.border)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {info.farbe === 'rot' ? (
            <AlertTriangle className={cn('h-4 w-4', f.icon)} />
          ) : info.farbe === 'gelb' ? (
            <Circle className={cn('h-4 w-4', f.icon)} />
          ) : (
            <CheckCircle className={cn('h-4 w-4', f.icon)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-xs font-bold', f.text)}>Zubereitung-Engpass-Ampel</span>
            <span className={cn('inline-flex h-2 w-2 rounded-full shrink-0', f.dot)} />
          </div>
          <p className={cn('text-xs font-semibold', f.text)}>{info.label}</p>
          {info.farbe !== 'gruen' && (
            <p className="text-[11px] text-muted-foreground mt-1">{info.empfehlung}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className={cn('text-2xl font-black tabular-nums', f.text)}>{info.anzahl}</span>
          <div className="text-[10px] text-muted-foreground leading-tight">prep.</div>
        </div>
      </div>
    </div>
  );
}
