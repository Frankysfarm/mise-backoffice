'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

/**
 * phase885 — Artikel-Ausverkauf-Alarm
 *
 * Echtzeit-Warnung wenn häufige Artikel im laufenden Batch übermäßig nachgefragt werden.
 * Erkennt potenzielle Ausverkaufs-Risiken durch Häufigkeitsanalyse der aktiven Bestellungen.
 * Client-seitig, ohne API — berechnet direkt aus den übergebenen Bestellungen.
 */

interface OrderItem {
  name: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const ALARM_THRESHOLD = 3;
const WARNING_THRESHOLD = 2;

interface ArtikelRisiko {
  name: string;
  count: number;
  menge_gesamt: number;
  risiko: 'alarm' | 'warnung';
}

function analyzeArtikel(orders: Order[]): ArtikelRisiko[] {
  const aktiv = orders.filter(o => !['geliefert', 'storniert', 'cancelled'].includes(o.status ?? ''));
  const artikelMap = new Map<string, { count: number; menge: number }>();

  for (const order of aktiv) {
    if (!order.items) continue;
    for (const item of order.items) {
      const name = item.name;
      if (!name) continue;
      const menge = (item.menge ?? item.quantity ?? 1);
      const prev = artikelMap.get(name) ?? { count: 0, menge: 0 };
      artikelMap.set(name, { count: prev.count + 1, menge: prev.menge + menge });
    }
  }

  const risiken: ArtikelRisiko[] = [];
  for (const [name, { count, menge }] of artikelMap) {
    if (count >= WARNING_THRESHOLD) {
      risiken.push({
        name,
        count,
        menge_gesamt: menge,
        risiko: count >= ALARM_THRESHOLD ? 'alarm' : 'warnung',
      });
    }
  }

  return risiken.sort((a, b) => b.count - a.count);
}

export function KitchenPhase885ArtikelAusverkaufAlarm({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const risiken = useMemo(() => analyzeArtikel(orders), [orders]);

  const alarme = risiken.filter(r => r.risiko === 'alarm');
  const warnungen = risiken.filter(r => r.risiko === 'warnung');

  if (risiken.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      alarme.length > 0
        ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
        : 'border-amber-400 bg-amber-50 dark:bg-amber-950/20',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4', alarme.length > 0 ? 'text-red-500' : 'text-amber-500')} />
          <span className={cn('text-sm font-bold', alarme.length > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')}>
            Ausverkauf-Risiko
          </span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-black',
            alarme.length > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white',
          )}>
            {alarme.length > 0 ? `${alarme.length} ALARM` : `${warnungen.length} Warnung`}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {alarme.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                Kritisch — jetzt prüfen
              </p>
              {alarme.map(r => (
                <div key={r.name} className="flex items-center justify-between rounded-lg border border-red-300 bg-red-100 dark:bg-red-900/30 px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-sm font-bold text-red-800 dark:text-red-200">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-red-600 dark:text-red-400">{r.menge_gesamt}× benötigt</span>
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {r.count} Bestellungen
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {warnungen.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                Erhöhte Nachfrage
              </p>
              {warnungen.map(r => (
                <div key={r.name} className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-100 dark:bg-amber-900/30 px-3 py-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">{r.menge_gesamt}×</span>
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {r.count}×
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Basiert auf {orders.filter(o => !['geliefert', 'storniert', 'cancelled'].includes(o.status ?? '')).length} aktiven Bestellungen.
          </p>
        </div>
      )}
    </div>
  );
}
