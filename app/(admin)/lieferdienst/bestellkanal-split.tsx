'use client';

// Phase 344: LieferdienstBestellkanalSplit — Verteilung der Bestellquellen (Direkt/Lieferando/Sonstige)

import React, { useMemo } from 'react';
import { Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type OrderRow = { external_source: string | null; typ: string };

interface Props {
  orders: Array<OrderRow>;
}

type KanalKey = 'Direkt' | 'Lieferando' | 'Sonstige';

const KANAL_COLORS: Record<KanalKey, string> = {
  Direkt: '#4ade80',
  Lieferando: '#f97316',
  Sonstige: '#94a3b8',
};

function kategorize(external_source: string | null): KanalKey {
  if (!external_source) return 'Direkt';
  const src = external_source.toLowerCase();
  if (src.includes('lieferando')) return 'Lieferando';
  return 'Sonstige';
}

export function LieferdienstBestellkanalSplit({ orders }: Props) {
  const data = useMemo(() => {
    if (orders.length === 0) return null;
    const counts: Record<KanalKey, number> = { Direkt: 0, Lieferando: 0, Sonstige: 0 };
    for (const o of orders) {
      const k = kategorize(o.external_source);
      counts[k] += 1;
    }
    const total = orders.length;
    return (['Direkt', 'Lieferando', 'Sonstige'] as KanalKey[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({
        name: k,
        count: counts[k],
        pct: Math.round((counts[k] / total) * 100),
      }));
  }, [orders]);

  if (!data || orders.length === 0) return null;

  return (
    <Card className="p-4 bg-white border border-matcha-100">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="h-4 w-4 text-matcha-600" />
        <span className="font-semibold text-sm text-gray-800">Bestellkanäle</span>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: unknown, _name: unknown, props: { payload?: { pct?: number } }) => [
                `${Number(value)} (${props.payload?.pct ?? 0}%)`,
                'Bestellungen',
              ]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={KANAL_COLORS[entry.name as KanalKey]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: KANAL_COLORS[entry.name as KanalKey] }}
            />
            <span>{entry.name}</span>
            <span className="text-gray-400">
              {entry.count} ({entry.pct}%)
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
