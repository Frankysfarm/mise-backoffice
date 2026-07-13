'use client';

// Phase 1247 — Multi-Posten-Koordination-Alert (Kitchen)
// Wenn viele Bestellungen gleichzeitig ≥3 Items enthalten → Küche "overloaded" → Ampel + Empfehlung
// Props-basiert (orders) · useMemo · Schwelle: ≥4 komplexe Bestellungen gleichzeitig

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
}

interface Order {
  id: string;
  created_at?: string | null;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
  komplexSchwelle?: number;   // Mindest-Items für "komplex"
  gleichzeitigSchwelle?: number; // Mindest-Anzahl simultaner komplexer Bestellungen
}

interface KoordStatus {
  level: 'ok' | 'erhoet' | 'kritisch';
  komplexeBestellungen: number;
  gesamtItems: number;
  empfehlung: string;
  tops: Array<{ id: string; itemCount: number; status: string | undefined }>;
}

function analyzeKoordination(
  orders: Order[],
  komplexSchwelle: number,
  gleichzeitigSchwelle: number,
): KoordStatus | null {
  const AKTIV_STATUS = ['confirmed', 'preparing', 'ready', 'bestätigt', 'in_zubereitung'];
  const active = orders.filter(o => o.status && AKTIV_STATUS.includes(o.status));
  const komplex = active.filter(o => {
    const total = (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0);
    return total >= komplexSchwelle;
  });

  if (komplex.length < 2) return null; // nichts besorgniserregendes

  const gesamtItems = komplex.reduce(
    (s, o) => s + (o.items ?? []).reduce((si, i) => si + (i.quantity ?? 1), 0),
    0,
  );

  let level: KoordStatus['level'] = 'ok';
  let empfehlung = '';

  if (komplex.length >= gleichzeitigSchwelle + 2) {
    level = 'kritisch';
    empfehlung = 'Sofortige Koordination nötig — Posten neu verteilen und Puffer einplanen.';
  } else if (komplex.length >= gleichzeitigSchwelle) {
    level = 'erhoet';
    empfehlung = 'Erhöhte Last erkannt — alle Posten auf maximale Kapazität achten.';
  } else {
    empfehlung = 'Mehrere komplexe Bestellungen parallel — Koordination empfohlen.';
  }

  const tops = komplex
    .map(o => ({
      id: o.id.slice(-6),
      itemCount: (o.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0),
      status: o.status,
    }))
    .sort((a, b) => b.itemCount - a.itemCount)
    .slice(0, 5);

  return { level, komplexeBestellungen: komplex.length, gesamtItems, empfehlung, tops };
}

const LEVEL_STYLE = {
  ok: {
    bg: 'bg-green-50 dark:bg-green-900/10',
    border: 'border-green-200 dark:border-green-700',
    header: 'bg-green-100 dark:bg-green-900/20',
    icon: 'text-green-600 dark:text-green-400',
    badge: 'bg-green-500 text-white',
    label: 'Koordination OK',
  },
  erhoet: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-200 dark:border-amber-700',
    header: 'bg-amber-100 dark:bg-amber-900/20',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500 text-white',
    label: 'Erhöhte Last',
  },
  kritisch: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-200 dark:border-red-700',
    header: 'bg-red-100 dark:bg-red-900/20',
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500 text-white animate-pulse',
    label: 'Kritische Last',
  },
};

export function KitchenPhase1247MultiPostenKoordinationAlert({
  orders,
  komplexSchwelle = 3,
  gleichzeitigSchwelle = 4,
}: Props) {
  const [open, setOpen] = useState(true);

  const status = useMemo(
    () => analyzeKoordination(orders, komplexSchwelle, gleichzeitigSchwelle),
    [orders, komplexSchwelle, gleichzeitigSchwelle],
  );

  if (!status) return null;

  const style = LEVEL_STYLE[status.level];

  return (
    <div className={cn('rounded-xl border overflow-hidden', style.bg, style.border)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-2.5', style.header)}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4 shrink-0', style.icon)} />
          <span className="text-xs font-bold uppercase tracking-wider">Multi-Posten-Koordination</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', style.badge)}>
            {status.komplexeBestellungen} komplex · {status.gesamtItems} Items
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', style.badge)}>
            {LEVEL_STYLE[status.level].label}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-start gap-2">
            <Users className={cn('h-4 w-4 mt-0.5 shrink-0', style.icon)} />
            <p className="text-sm text-foreground">{status.empfehlung}</p>
          </div>

          {status.tops.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Komplexe Bestellungen (Top {status.tops.length})
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {status.tops.map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border bg-background/60 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-xs text-muted-foreground">#{t.id}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold">{t.itemCount} Items</span>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                        t.itemCount >= 5 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      )}>
                        {t.itemCount >= 5 ? '⚡ Viel' : '↑ Komplex'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
