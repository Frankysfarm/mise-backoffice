'use client';

import React, { useMemo } from 'react';

interface Order {
  id: string;
  status?: string | null;
  gewuenschtes_zeitfenster?: string | null;
  lieferzeit?: string | null;
}

interface Props {
  orders: Order[];
}

type Zeitfenster = 'ASAP' | '30 Min' | '60 Min' | 'Sonstige';

interface ZeitfensterGroup {
  label: Zeitfenster;
  count: number;
  color: string;
  bg: string;
  border: string;
}

function klassifiziere(order: Order): Zeitfenster {
  const raw = (order.gewuenschtes_zeitfenster ?? order.lieferzeit ?? '').toLowerCase();
  if (!raw || raw === 'asap' || raw === 'sofort') return 'ASAP';
  if (raw.includes('30')) return '30 Min';
  if (raw.includes('60') || raw.includes('stunde')) return '60 Min';
  return 'Sonstige';
}

const STYLE: Record<Zeitfenster, { color: string; bg: string; border: string }> = {
  'ASAP':     { color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  '30 Min':   { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  '60 Min':   { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'Sonstige': { color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
};

export function KitchenPhase1608BestellungsZeitfensterVerteilung({ orders }: Props) {
  const groups = useMemo<ZeitfensterGroup[]>(() => {
    const active = orders.filter(
      (o) => o.status !== 'geliefert' && o.status !== 'storniert',
    );
    const counts: Record<Zeitfenster, number> = { 'ASAP': 0, '30 Min': 0, '60 Min': 0, 'Sonstige': 0 };
    for (const o of active) {
      counts[klassifiziere(o)] += 1;
    }
    return (['ASAP', '30 Min', '60 Min', 'Sonstige'] as Zeitfenster[])
      .filter((z) => counts[z] > 0)
      .map((z) => ({ label: z, count: counts[z], ...STYLE[z] }));
  }, [orders]);

  if (groups.length === 0) return null;

  const total = groups.reduce((a, g) => a + g.count, 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Zeitfenster-Verteilung</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{total} offen</span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${g.bg} ${g.border}`}
          >
            <span className={`text-2xl font-black tabular-nums ${g.color}`}>{g.count}</span>
            <span className={`text-xs font-semibold ${g.color}`}>{g.label}</span>
            <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden mt-1">
              <div
                className={`h-full rounded-full ${g.color.replace('text-', 'bg-').replace('-700', '-500').replace('-600', '-400')}`}
                style={{ width: `${Math.round((g.count / total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{Math.round((g.count / total) * 100)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
