'use client';

/**
 * Phase 589 — Kitchen: Bestellungs-Warteschlangen-Ampel
 *
 * Ampelsystem für die Küchen-Warteschlange:
 *  grün  — < 5 Bestellungen (normal)
 *  gelb  — 5–9 Bestellungen (erhöht)
 *  rot   — ≥ 10 Bestellungen (kritisch)
 *
 * Zählt Bestellungen mit Status bestätigt | in_zubereitung.
 * Ticker: 2s
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Flame } from 'lucide-react';

interface Order {
  id: string;
  status: string;
}

interface Props {
  orders: Order[];
}

const ACTIVE = new Set(['bestätigt', 'in_zubereitung']);

type Ampel = 'gruen' | 'gelb' | 'rot';

function getAmpel(count: number): Ampel {
  if (count < 5) return 'gruen';
  if (count < 10) return 'gelb';
  return 'rot';
}

const COLORS: Record<Ampel, { bg: string; border: string; text: string; label: string }> = {
  gruen: { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', label: 'Normal' },
  gelb:  { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  label: 'Erhöht' },
  rot:   { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-700',   label: 'Kritisch' },
};

export function KitchenPhase589WarteschlangenAmpel({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // suppress tick lint warning — ticker forces re-render to recount
  void tick;

  const active = orders.filter((o) => ACTIVE.has(o.status));
  const count = active.length;
  const ampel = getAmpel(count);
  const { bg, border, text, label } = COLORS[ampel];

  return (
    <div className={`rounded-xl border-2 ${border} ${bg} px-4 py-3 flex items-center gap-3 transition-colors duration-500`}>
      {/* Ampel-Icon */}
      <div className="shrink-0">
        {ampel === 'gruen' && <CheckCircle className={`h-7 w-7 ${text}`} />}
        {ampel === 'gelb'  && <AlertTriangle className={`h-7 w-7 ${text}`} />}
        {ampel === 'rot'   && <Flame className={`h-7 w-7 ${text} animate-pulse`} />}
      </div>

      {/* Kern-Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-black tabular-nums ${text}`}>{count}</span>
          <span className={`text-sm font-semibold ${text}`}>
            Bestellung{count !== 1 ? 'en' : ''} in der Warteschlange
          </span>
        </div>
        <div className={`text-xs mt-0.5 ${text} opacity-75`}>
          {ampel === 'gruen' && 'Küche läuft normal — alles im grünen Bereich'}
          {ampel === 'gelb'  && 'Erhöhte Last — Küche arbeitet unter Druck'}
          {ampel === 'rot'   && 'Kritische Überlast — bitte Neuzugang drosseln!'}
        </div>
      </div>

      {/* Status-Badge */}
      <div className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${border} ${text} ${bg}`}>
        {label}
      </div>

      {/* Drei-Ampel-Punkte */}
      <div className="shrink-0 flex flex-col gap-1">
        <div className={`h-3 w-3 rounded-full ${ampel === 'gruen' ? 'bg-green-500' : 'bg-green-200'}`} />
        <div className={`h-3 w-3 rounded-full ${ampel === 'gelb'  ? 'bg-amber-400'  : 'bg-amber-200'}`} />
        <div className={`h-3 w-3 rounded-full ${ampel === 'rot'   ? 'bg-red-500'   : 'bg-red-200'}`} />
      </div>
    </div>
  );
}
