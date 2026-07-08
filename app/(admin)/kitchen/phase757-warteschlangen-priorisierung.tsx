'use client';

import { useMemo, useState } from 'react';
import { Flame, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
  total?: number;
  table_number?: string | null;
  customer_name?: string | null;
  items?: { name: string; menge: number }[];
}

interface Props {
  orders: Order[];
}

function minutenSeit(iso?: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function ampelFarbe(min: number) {
  if (min >= 30) return 'border-red-400 bg-red-50 dark:bg-red-950/20 dark:border-red-800';
  if (min >= 15) return 'border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800';
  return 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900';
}

function ampelBadge(min: number) {
  if (min >= 30) return 'bg-red-500 text-white';
  if (min >= 15) return 'bg-amber-500 text-white';
  return 'bg-emerald-500 text-white';
}

export function KitchenPhase757WarteschlangenPriorisierung({ orders }: Props) {
  const [offen, setOffen] = useState(true);

  const wartend = useMemo(() =>
    orders
      .filter((o) => ['pending', 'confirmed', 'preparing', 'new', 'in_kitchen'].includes(o.status ?? ''))
      .sort((a, b) => minutenSeit(b.created_at) - minutenSeit(a.created_at))
      .slice(0, 8),
    [orders]
  );

  const maxMin = wartend.length > 0 ? minutenSeit(wartend[0]?.created_at) : 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className={`h-4 w-4 ${wartend.some((o) => minutenSeit(o.created_at) >= 30) ? 'text-red-500 animate-pulse' : 'text-orange-400'}`} />
          <span className="text-sm font-semibold">Warteschlangen-Priorität</span>
          <span className="text-xs text-muted-foreground">{wartend.length} offen</span>
          {maxMin >= 15 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              max {maxMin} Min
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {wartend.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1">Keine offenen Bestellungen.</p>
          ) : (
            wartend.map((o, i) => {
              const min = minutenSeit(o.created_at);
              return (
                <div key={o.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ampelFarbe(min)}`}>
                  <span className={`text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 ${ampelBadge(min)}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {o.customer_name ?? (o.table_number ? `Tisch ${o.table_number}` : `#${o.id.slice(-4)}`)}
                    </p>
                    {o.items && o.items.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {o.items.map((it) => `${it.menge}× ${it.name}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={`text-xs font-bold tabular-nums ${min >= 30 ? 'text-red-600 dark:text-red-400' : min >= 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {min} Min
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
