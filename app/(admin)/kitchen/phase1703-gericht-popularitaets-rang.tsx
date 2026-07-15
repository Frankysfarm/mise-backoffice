'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1703 — Gericht-Popularitäts-Rang (Kitchen)
 *
 * Props-basiert (orders): Top-5 meistbestellte Gerichte heute
 * + Rang vs. gestern (aus localStorage) + Trend-Pfeil; rein client-seitig useMemo.
 */

interface OrderItem {
  name?: string;
  product_name?: string;
  quantity?: number;
  qty?: number;
}

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

interface GerichtEintrag {
  name: string;
  anzahl: number;
  rang: number;
  rangGestern: number | null;
  trend: 'hoch' | 'runter' | 'neu' | 'stabil';
}

const STORAGE_KEY = 'mise_gericht_rang_gestern';

function getGesternRang(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const { date, data } = JSON.parse(raw) as { date: string; data: Record<string, number> };
    const today = new Date().toISOString().slice(0, 10);
    if (date !== today) return data;
    return {};
  } catch {
    return {};
  }
}

function saveRangHeute(rang: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, data: rang }));
  } catch {}
}

export function KitchenPhase1703GerichtPopularitaetsRang({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const eintraege = useMemo<GerichtEintrag[]>(() => {
    const counts: Record<string, number> = {};
    for (const o of orders) {
      const items = o.items ?? o.order_items ?? [];
      for (const item of items) {
        const name = item.product_name ?? item.name ?? 'Unbekannt';
        const qty = item.quantity ?? item.qty ?? 1;
        counts[name] = (counts[name] ?? 0) + qty;
      }
    }

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const gestern = getGesternRang();

    const result: GerichtEintrag[] = sorted.map(([name, anzahl], i) => {
      const rang = i + 1;
      const rangGestern = gestern[name] ?? null;
      let trend: GerichtEintrag['trend'] = 'neu';
      if (rangGestern !== null) {
        if (rangGestern > rang) trend = 'hoch';
        else if (rangGestern < rang) trend = 'runter';
        else trend = 'stabil';
      }
      return { name, anzahl, rang, rangGestern, trend };
    });

    const heuteRangMap: Record<string, number> = {};
    for (const e of result) heuteRangMap[e.name] = e.rang;
    saveRangHeute(heuteRangMap);

    return result;
  }, [orders]);

  if (!eintraege.length) return null;

  const maxAnzahl = eintraege[0]?.anzahl ?? 1;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Award className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Gericht-Popularitäts-Rang</span>
        <span className="text-[10px] text-muted-foreground">Top {eintraege.length}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {eintraege.map(e => (
            <div key={e.name} className="flex items-center gap-2">
              <span className={cn(
                'w-5 text-center text-[11px] font-black',
                e.rang === 1 ? 'text-amber-500' : e.rang === 2 ? 'text-zinc-400' : e.rang === 3 ? 'text-amber-700' : 'text-muted-foreground',
              )}>
                {e.rang}.
              </span>
              <span className="flex-1 text-[11px] font-medium text-foreground truncate">{e.name}</span>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${Math.round((e.anzahl / maxAnzahl) * 100)}%` }}
                />
              </div>
              <span className="w-6 text-right text-[11px] font-bold tabular-nums text-foreground">{e.anzahl}</span>
              <span className="w-4 flex justify-center shrink-0">
                {e.trend === 'hoch' && <TrendingUp className="h-3 w-3 text-matcha-500" />}
                {e.trend === 'runter' && <TrendingDown className="h-3 w-3 text-red-500" />}
                {e.trend === 'stabil' && <Minus className="h-3 w-3 text-muted-foreground" />}
                {e.trend === 'neu' && <span className="text-[8px] font-bold text-sky-500">NEU</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
