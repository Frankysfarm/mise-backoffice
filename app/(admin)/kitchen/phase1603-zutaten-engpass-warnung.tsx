'use client';

import React, { useMemo } from 'react';

interface OrderItem {
  name?: string;
  zutaten?: string[];
  ingredients?: string[];
}

interface OrderInput {
  id: string;
  status?: string | null;
  items?: OrderItem[];
}

interface Props {
  orders: OrderInput[];
}

interface ZutatRow {
  zutat: string;
  count: number;
  anteil: number;
  warnung: boolean;
}

const WARN_THRESHOLD = 0.7;

export function KitchenPhase1603ZutatenEngpassWarnung({ orders }: Props) {
  const rows = useMemo<ZutatRow[]>(() => {
    const active = orders.filter(
      (o) => o.status !== 'geliefert' && o.status !== 'storniert',
    );
    if (active.length === 0) return [];

    const freq: Record<string, number> = {};
    for (const o of active) {
      const seenZutaten = new Set<string>();
      for (const item of o.items ?? []) {
        const zutaten = [
          ...(item.zutaten ?? []),
          ...(item.ingredients ?? []),
        ];
        for (const z of zutaten) {
          const key = z.trim().toLowerCase();
          if (key && !seenZutaten.has(key)) {
            seenZutaten.add(key);
            freq[key] = (freq[key] ?? 0) + 1;
          }
        }
        if ((item.zutaten ?? []).length === 0 && (item.ingredients ?? []).length === 0 && item.name) {
          const key = item.name.trim().toLowerCase();
          if (!seenZutaten.has(key)) {
            seenZutaten.add(key);
            freq[key] = (freq[key] ?? 0) + 1;
          }
        }
      }
    }

    return Object.entries(freq)
      .map(([zutat, count]) => ({
        zutat,
        count,
        anteil: count / active.length,
        warnung: count / active.length >= WARN_THRESHOLD,
      }))
      .filter((r) => r.anteil >= 0.4)
      .sort((a, b) => b.anteil - a.anteil)
      .slice(0, 8);
  }, [orders]);

  const warnRows = rows.filter((r) => r.warnung);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-rose-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-rose-700 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Zutaten-Engpass-Warnung</span>
        {warnRows.length > 0 && (
          <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">
            {warnRows.length} kritisch
          </span>
        )}
      </div>

      {warnRows.length > 0 && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
          <span className="text-rose-700 font-semibold text-xs">
            Kritisch: {warnRows.map((r) => r.zutat).join(', ')} — in &gt;70 % aller offenen Bestellungen!
          </span>
        </div>
      )}

      <div className="p-4 space-y-2">
        {rows.map((r) => (
          <div key={r.zutat} className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                r.warnung
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {r.warnung ? '⚠ Engpass' : 'Häufig'}
            </span>
            <span className="text-sm text-gray-700 flex-1 capitalize">{r.zutat}</span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${r.warnung ? 'bg-rose-500' : 'bg-amber-400'}`}
                  style={{ width: `${Math.round(r.anteil * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">
                {Math.round(r.anteil * 100)} %
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
