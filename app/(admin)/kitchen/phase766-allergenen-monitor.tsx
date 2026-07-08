'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

const BEKANNTE_ALLERGENE = ['Gluten', 'Laktose', 'Nüsse', 'Erdnüsse', 'Ei', 'Fisch', 'Soja', 'Sesam', 'Sellerie', 'Senf'];

interface Order {
  id: string;
  status: string;
  items?: Array<{ name?: string; extras?: string; notes?: string }>;
  notes?: string;
  customer_notes?: string;
}

interface AllergenFund {
  orderId: string;
  allergene: string[];
  hinweis: string;
}

function extractAllergene(text: string): string[] {
  const lower = text.toLowerCase();
  return BEKANNTE_ALLERGENE.filter(a => lower.includes(a.toLowerCase()));
}

function scanOrder(order: Order): AllergenFund | null {
  const hits: string[] = [];
  const quellen: string[] = [];

  const notizText = [order.notes ?? '', order.customer_notes ?? ''].join(' ');
  const notizTreffer = extractAllergene(notizText);
  if (notizTreffer.length) {
    hits.push(...notizTreffer);
    quellen.push('Bestellnotiz');
  }

  for (const item of order.items ?? []) {
    const itemText = [item.name ?? '', item.extras ?? '', item.notes ?? ''].join(' ');
    const itemTreffer = extractAllergene(itemText);
    if (itemTreffer.length) {
      hits.push(...itemTreffer);
      quellen.push(item.name ?? 'Artikel');
    }
  }

  if (!hits.length) return null;
  const unique = Array.from(new Set(hits));
  return { orderId: order.id, allergene: unique, hinweis: quellen.join(', ') };
}

const AKTIVE_STATUS = ['pending', 'confirmed', 'in_progress', 'preparing', 'ready', 'in_bearbeitung'];

export function KitchenPhase766AllergenenMonitor({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);

  const aktiveOrders = orders.filter(o => AKTIVE_STATUS.includes(o.status));
  const funde: AllergenFund[] = aktiveOrders.flatMap(o => {
    const f = scanOrder(o);
    return f ? [f] : [];
  });

  if (!funde.length) return null;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Allergenen-Monitor
          </span>
          <span className="rounded-full bg-amber-500 text-white text-xs px-2 py-0.5 font-bold">
            {funde.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {funde.map(f => (
            <div
              key={f.orderId}
              className="rounded-lg border border-amber-300/60 bg-white dark:bg-amber-900/20 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    #{f.orderId.slice(0, 8)}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {f.allergene.map(a => (
                      <span
                        key={a}
                        className="rounded-full bg-amber-500 text-white text-xs px-2 py-0.5 font-medium"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{f.hinweis}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
