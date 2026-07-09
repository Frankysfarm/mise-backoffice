'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';

/**
 * Phase 1019 — Küchen-Kapazitäts-Zustands-Ring (Kitchen)
 *
 * SVG-Ring 0–100% Küchen-Auslastung basierend auf aktiven Bestellungen vs. Kapazitätsgrenze.
 * Farbkodierung: Grün (<60%), Amber (60–85%), Rot (>85%).
 * Empfehlung bei Überlastung. Client-seitig, kein API-Call.
 */

interface OrderItem {
  name?: string;
  title?: string;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[];
  created_at?: string;
}

interface Props {
  orders: Order[];
  kapazitaetLimit?: number;
}

const CAPACITY = 15;

export function KitchenPhase1019KapazitaetsRing({ orders, kapazitaetLimit = CAPACITY }: Props) {
  const [open, setOpen] = useState(true);

  const { aktiv, auslastungPct, status, empfehlung, artikelGesamt } = useMemo(() => {
    const activeOrders = orders.filter(o =>
      ['neu', 'bestaetigt', 'confirmed', 'in_zubereitung', 'preparing'].includes(o.status),
    );
    const items = activeOrders.reduce((sum, o) =>
      sum + (o.items?.reduce((s, it) => s + (it.quantity ?? 1), 0) ?? 1), 0,
    );
    const pct = Math.min(100, Math.round((activeOrders.length / kapazitaetLimit) * 100));

    let st: 'ok' | 'hoch' | 'kritisch' = 'ok';
    let emf = '';
    if (pct > 85) {
      st = 'kritisch';
      emf = 'Küche überlastet — ETA-Verlängerung empfohlen, neue Bestellungen temporär drosseln.';
    } else if (pct > 60) {
      st = 'hoch';
      emf = 'Hohe Auslastung — Parallele Zubereitungen priorisieren.';
    }
    return { aktiv: activeOrders.length, auslastungPct: pct, status: st, empfehlung: emf, artikelGesamt: items };
  }, [orders, kapazitaetLimit]);

  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const dashOffset = circ - (auslastungPct / 100) * circ;

  const color = status === 'kritisch' ? '#ef4444' : status === 'hoch' ? '#f59e0b' : '#4ade80';
  const textColor = status === 'kritisch' ? 'text-red-600 dark:text-red-400' : status === 'hoch' ? 'text-amber-600 dark:text-amber-400' : 'text-matcha-600 dark:text-matcha-400';
  const bgColor = status === 'kritisch' ? 'bg-red-50 border-red-200' : status === 'hoch' ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200';
  const label = status === 'kritisch' ? 'ÜBERLASTET' : status === 'hoch' ? 'HOCH' : 'OK';

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Küchen-Kapazität</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', bgColor, 'border')}>
            {auslastungPct}% · {label}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 flex items-center gap-6">
          {/* SVG Ring */}
          <div className="relative flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <circle
                cx="50" cy="50" r={radius} fill="none"
                stroke={color} strokeWidth="10"
                strokeDasharray={circ}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-black tabular-nums leading-none', textColor)}>{auslastungPct}%</span>
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Last</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Aktiv', value: aktiv },
                { label: 'Limit', value: kapazitaetLimit },
                { label: 'Artikel', value: artikelGesamt },
              ].map(({ label: l, value }) => (
                <div key={l} className="text-center">
                  <div className="text-lg font-black tabular-nums">{value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
                </div>
              ))}
            </div>

            {empfehlung && (
              <div className={cn('rounded-lg border p-2.5 text-xs', bgColor)}>
                <span className="font-bold">Empfehlung:</span> {empfehlung}
              </div>
            )}

            {!empfehlung && (
              <div className="text-xs text-matcha-700 dark:text-matcha-300 font-medium">
                Küche läuft im grünen Bereich ✓
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
