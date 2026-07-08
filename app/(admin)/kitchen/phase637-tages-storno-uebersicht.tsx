'use client';

import { useMemo, useState } from 'react';
import { XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface Order {
  id: string;
  created_at: string;
  status?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  bestellnummer?: string | null;
  kunde_name?: string | null;
  total_price?: number | null;
}

interface Props {
  orders: Order[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const GRUND_LABEL: Record<string, string> = {
  customer_request: 'Kundenwunsch',
  out_of_stock: 'Nicht verfügbar',
  kitchen_error: 'Küchenfehler',
  driver_unavailable: 'Kein Fahrer',
  address_issue: 'Adressproblem',
  payment_failed: 'Zahlung fehlg.',
  duplicate: 'Doppelbestellung',
  other: 'Sonstiges',
};

function grundLabel(reason: string | null | undefined): string {
  if (!reason) return 'Unbekannt';
  return GRUND_LABEL[reason] ?? reason;
}

export function KitchenPhase637TagesStornoUebersicht({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const heute = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return orders.filter((o) => {
      const istStorno =
        o.status === 'cancelled' ||
        o.status === 'storniert' ||
        o.status === 'canceled';
      if (!istStorno) return false;
      const ts = o.cancelled_at ?? o.created_at;
      return new Date(ts) >= start;
    });
  }, [orders]);

  if (heute.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3"
      >
        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
        <span className="text-sm font-bold text-red-800 dark:text-red-200 uppercase tracking-wide flex-1 text-left">
          Stornierungen Heute
        </span>
        <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-xs font-black text-red-700 dark:text-red-300">
          {heute.length}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-red-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-500" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {heute.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 border border-red-100 dark:border-red-900/50 px-3 py-2"
            >
              <div className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 w-12">
                <Clock className="h-3 w-3" />
                {formatTime(o.cancelled_at ?? o.created_at)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {o.bestellnummer ? `#${o.bestellnummer}` : o.id.slice(0, 8)}
                  {o.kunde_name ? ` · ${o.kunde_name}` : ''}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  {grundLabel(o.cancel_reason)}
                </div>
              </div>
              {o.total_price != null && (
                <div className="text-xs font-bold text-red-600 dark:text-red-400 shrink-0">
                  −{(o.total_price / 100).toFixed(2).replace('.', ',')} €
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
