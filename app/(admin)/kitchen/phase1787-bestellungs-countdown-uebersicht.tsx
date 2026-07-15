'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, AlertTriangle } from 'lucide-react';

/**
 * Phase 1787 — Bestellungs-Countdown-Übersicht (Kitchen)
 *
 * Alle aktiven Bestellungen als Countdown-Liste; Farbampel grün/gelb/rot.
 * Props-basiert; useMemo; Collapsible. Kein API-Call (nutzt orders-Prop).
 */

interface Order {
  id?: string;
  status?: string;
  created_at?: string;
  order_number?: string | number;
  eta_minutes?: number;
  items?: unknown[];
  order_items?: unknown[];
}

interface Props {
  orders: Order[];
  locationId?: string | null;
  className?: string;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

const AMPEL_ROW: Record<Ampel, string> = {
  gruen: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-800',
  gelb: 'bg-saffron-50 dark:bg-saffron-900/20 border-amber-200 dark:border-amber-800',
  rot: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};
const AMPEL_DOT: Record<Ampel, string> = {
  gruen: 'bg-matcha-500',
  gelb: 'bg-amber-400',
  rot: 'bg-red-500',
};
const AMPEL_TEXT: Record<Ampel, string> = {
  gruen: 'text-matcha-700 dark:text-matcha-300',
  gelb: 'text-amber-700 dark:text-amber-300',
  rot: 'text-red-700 dark:text-red-300',
};

const AKTIV_STATUS = new Set(['pending', 'confirmed', 'in_preparation', 'ready', 'ausstehend', 'bestaetigt', 'in_zubereitung', 'bereit']);

export function KitchenPhase1787BestellungsCountdownUebersicht({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const items = useMemo(() => {
    const DEFAULT_ETA = 30;
    return orders
      .filter(o => AKTIV_STATUS.has(o.status ?? ''))
      .map(o => {
        const createdMs = o.created_at ? new Date(o.created_at).getTime() : now;
        const minSeit = Math.round((now - createdMs) / 60000);
        const ziel = o.eta_minutes ?? DEFAULT_ETA;
        const verbleibend = ziel - minSeit;
        let ampel: Ampel = 'gruen';
        if (verbleibend < 0) ampel = 'rot';
        else if (verbleibend < 8) ampel = 'gelb';
        const nr = o.order_number
          ? `#${o.order_number}`
          : `#${(o.id ?? '????').slice(0, 4)}`;
        return { id: o.id ?? nr, nr, minSeit, ziel, verbleibend, ampel };
      })
      .sort((a, b) => a.verbleibend - b.verbleibend);
  }, [orders, now]);

  const ueberfaellig = items.filter(i => i.ampel === 'rot').length;
  const kritisch = items.filter(i => i.ampel === 'gelb').length;

  if (items.length === 0) return null;

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm mx-4 mt-3', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3"
      >
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left text-sm font-bold">Bestellungs-Countdown</span>
        {ueberfaellig > 0 && (
          <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 mr-1">
            {ueberfaellig} überfällig
          </span>
        )}
        {kritisch > 0 && ueberfaellig === 0 && (
          <span className="rounded-full bg-amber-400 text-white text-[10px] font-bold px-1.5 py-0.5 mr-1">
            {kritisch} kritisch
          </span>
        )}
        <span className="text-xs text-muted-foreground">{items.length} aktiv</span>
        {open ? <ChevronUp className="h-4 w-4 ml-1 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-1 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          {ueberfaellig > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                {ueberfaellig} Bestellung{ueberfaellig > 1 ? 'en' : ''} überfällig!
              </p>
            </div>
          )}

          {items.map(item => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2',
                AMPEL_ROW[item.ampel],
              )}
            >
              {/* Dot */}
              <span className={cn('h-2 w-2 rounded-full shrink-0', AMPEL_DOT[item.ampel])} />

              {/* Bestellnummer */}
              <span className="text-xs font-bold w-14 shrink-0">{item.nr}</span>

              {/* Countdown */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-bold', AMPEL_TEXT[item.ampel])}>
                  {item.verbleibend < 0
                    ? `${Math.abs(item.verbleibend)} Min überfällig`
                    : item.verbleibend === 0
                    ? 'Fällig jetzt'
                    : `Noch ${item.verbleibend} Min`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Seit {item.minSeit} Min — Ziel {item.ziel} Min
                </p>
              </div>

              {/* Fortschrittsbalken */}
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    item.ampel === 'gruen' ? 'bg-matcha-500' :
                    item.ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500',
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, (item.minSeit / item.ziel) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
