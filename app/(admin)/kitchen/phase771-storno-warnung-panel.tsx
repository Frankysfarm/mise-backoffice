'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, XCircle, Clock } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  created_at?: string;
  placedAt?: string;
  customer_name?: string;
  table_number?: string | number;
  items?: Array<{ name?: string }>;
}

function warteMinuten(order: Order): number {
  const ts = order.placedAt ?? order.created_at;
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
}

const RISIKO_STATUS = ['pending', 'confirmed'];

export function KitchenPhase771StornoWarnungPanel({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);

  const risikoOrders = orders
    .filter(o => RISIKO_STATUS.includes(o.status))
    .map(o => ({ ...o, warteMin: warteMinuten(o) }))
    .filter(o => o.warteMin >= 10)
    .sort((a, b) => b.warteMin - a.warteMin);

  if (!risikoOrders.length) return null;

  const kritisch = risikoOrders.filter(o => o.warteMin >= 20);
  const gefaehrdet = risikoOrders.filter(o => o.warteMin < 20);

  return (
    <div className="rounded-xl border border-red-400/40 bg-red-50 dark:bg-red-950/20 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold text-red-800 dark:text-red-300">
            Storno-Risiko
          </span>
          <span className="rounded-full bg-red-500 text-white text-xs px-2 py-0.5 font-bold">
            {risikoOrders.length}
          </span>
          {kritisch.length > 0 && (
            <span className="rounded-full bg-red-700 text-white text-xs px-2 py-0.5 font-bold animate-pulse">
              {kritisch.length} kritisch
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {risikoOrders.map(o => {
            const isKritisch = o.warteMin >= 20;
            const borderColor = isKritisch
              ? 'border-red-400 dark:border-red-600'
              : 'border-amber-300 dark:border-amber-600';
            const badgeBg = isKritisch ? 'bg-red-500' : 'bg-amber-500';
            return (
              <div
                key={o.id}
                className={`rounded-lg border ${borderColor} bg-white dark:bg-slate-800 p-3 flex items-center justify-between gap-3`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    #{o.id.slice(0, 8)}
                    {o.table_number != null && (
                      <span className="ml-1 text-slate-600 dark:text-slate-300">
                        · Tisch {o.table_number}
                      </span>
                    )}
                  </p>
                  {o.customer_name && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      {o.customer_name}
                    </p>
                  )}
                  {(o.items ?? []).length > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {(o.items ?? []).map(i => i.name).filter(Boolean).slice(0, 2).join(', ')}
                      {(o.items ?? []).length > 2 && ` +${(o.items ?? []).length - 2}`}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className={`rounded-full ${badgeBg} text-white text-xs px-2 py-0.5 font-bold whitespace-nowrap`}>
                    {o.warteMin} Min
                  </span>
                </div>
              </div>
            );
          })}
          {gefaehrdet.length > 0 && kritisch.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Rot ≥ 20 Min · Amber ≥ 10 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
