'use client';

import React, { useMemo } from 'react';

interface BestellungInput {
  id: string;
  status: string;
  items?: { quantity: number; category?: string }[] | null;
}

interface Props {
  orders: BestellungInput[];
}

const CLOCK_SIZE = 88;
const STROKE = 10;
const R = (CLOCK_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelFor(score: number): Ampel {
  if (score < 6) return 'gruen';
  if (score < 10) return 'gelb';
  return 'rot';
}

const COLORS: Record<Ampel, { ring: string; text: string; bg: string; label: string }> = {
  gruen: { ring: '#4ade80', text: 'text-green-700', bg: 'bg-green-50', label: 'Einfach' },
  gelb: { ring: '#fbbf24', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Mittel' },
  rot: { ring: '#f87171', text: 'text-rose-700', bg: 'bg-rose-50', label: 'Komplex' },
};

const MAX_SCORE = 15;

export function KitchenPhase1563BestellungsKomplexitaetsUhr({ orders }: Props) {
  const { score, ampel, offene, avgItems, uniqueCats } = useMemo(() => {
    const offene = orders.filter((o) =>
      ['neu', 'angenommen', 'in_zubereitung'].includes(o.status)
    );
    if (offene.length === 0) return { score: 0, ampel: 'gruen' as Ampel, offene: 0, avgItems: 0, uniqueCats: 0 };

    let totalItems = 0;
    const catSet = new Set<string>();
    for (const o of offene) {
      const items = o.items ?? [];
      totalItems += items.reduce((s, i) => s + (i.quantity ?? 1), 0);
      for (const i of items) { if (i.category) catSet.add(i.category); }
    }
    const avg = offene.length > 0 ? totalItems / offene.length : 0;
    const cats = catSet.size;
    const score = Math.round(avg * (cats || 1));
    return { score, ampel: ampelFor(score), offene: offene.length, avgItems: Math.round(avg * 10) / 10, uniqueCats: cats };
  }, [orders]);

  const pct = Math.min(score / MAX_SCORE, 1);
  const dash = pct * CIRC;
  const col = COLORS[ampel];

  return (
    <div className={`rounded-2xl border border-stone-200 ${col.bg} p-3 flex items-center gap-3`}>
      <svg width={CLOCK_SIZE} height={CLOCK_SIZE} className="shrink-0">
        <circle
          cx={CLOCK_SIZE / 2} cy={CLOCK_SIZE / 2} r={R}
          fill="none" stroke="#e7e5e4" strokeWidth={STROKE}
        />
        <circle
          cx={CLOCK_SIZE / 2} cy={CLOCK_SIZE / 2} r={R}
          fill="none" stroke={col.ring} strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRC - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${CLOCK_SIZE / 2} ${CLOCK_SIZE / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={18} fontWeight={700} fill={col.ring}>
          {score}
        </text>
        <text x="50%" y="68%" textAnchor="middle" fontSize={9} fill="#78716c">Komp.</text>
      </svg>
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wide ${col.text}`}>Komplexitäts-Uhr</p>
        <p className={`text-sm font-semibold ${col.text}`}>{col.label}</p>
        <p className="text-xs text-stone-500 mt-0.5">{offene} offene Bestellungen</p>
        <p className="text-xs text-stone-500">Ø {avgItems} Artikel · {uniqueCats} Kategorien</p>
      </div>
    </div>
  );
}
