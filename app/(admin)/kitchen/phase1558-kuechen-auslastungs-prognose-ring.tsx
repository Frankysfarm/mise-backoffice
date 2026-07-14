'use client';

import React, { useMemo } from 'react';

interface BestellungInput {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min?: number | null;
}

interface Props {
  orders: BestellungInput[];
}

const RING_SIZE = 88;
const STROKE = 10;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelFor(pct: number): Ampel {
  if (pct < 60) return 'gruen';
  if (pct < 85) return 'gelb';
  return 'rot';
}

const COLORS: Record<Ampel, { ring: string; text: string; bg: string; label: string }> = {
  gruen: { ring: '#4ade80', text: 'text-green-600', bg: 'bg-green-50', label: 'Kapazität OK' },
  gelb: { ring: '#fbbf24', text: 'text-amber-600', bg: 'bg-amber-50', label: 'Auslastung hoch' },
  rot: { ring: '#f87171', text: 'text-rose-600', bg: 'bg-rose-50', label: 'Überlastet' },
};

export function KitchenPhase1558KuechenAuslastungsPrognoseRing({ orders }: Props) {
  const { pct, ampel, offene, prognose60 } = useMemo(() => {
    const now = Date.now();
    const offene = orders.filter((o) => ['neu', 'angenommen', 'in_zubereitung'].includes(o.status)).length;
    const naechste60 = orders.filter((o) => {
      if (o.status !== 'neu' || !o.bestellt_am) return false;
      const age = (now - new Date(o.bestellt_am).getTime()) / 60_000;
      return age < 60;
    }).length;
    const histRate = Math.max(orders.filter((o) => o.status !== 'neu').length, 1) / Math.max(1, Math.ceil(orders.length / 10));
    const prognose60 = Math.round(offene + naechste60 * 0.6);
    const MAX_KAPAZITAET = 25;
    const pct = Math.min(100, Math.round((prognose60 / MAX_KAPAZITAET) * 100));
    return { pct, ampel: ampelFor(pct), offene, prognose60, histRate };
  }, [orders]);

  const col = COLORS[ampel];
  const dash = (pct / 100) * CIRC;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  return (
    <div className={`rounded-2xl border border-stone-200 p-4 ${col.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Auslastungs-Prognose 60 Min</span>
      </div>
      <div className="flex items-center gap-4">
        <svg width={RING_SIZE} height={RING_SIZE} className="shrink-0">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} />
          <circle
            cx={cx} cy={cy} r={R} fill="none"
            stroke={col.ring} strokeWidth={STROKE}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy - 4} textAnchor="middle" className="text-[18px] font-black" fill={col.ring} fontSize={18} fontWeight={900}>{pct}%</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7280" fontSize={9}>Auslastung</text>
        </svg>
        <div className="flex-1 space-y-1.5">
          <div className={`text-sm font-bold ${col.text}`}>{col.label}</div>
          <div className="text-xs text-stone-500">
            <span className="font-semibold text-stone-700">{offene}</span> offene Bestellungen
          </div>
          <div className="text-xs text-stone-500">
            Prognose 60 Min: <span className="font-semibold text-stone-700">{prognose60}</span> Bestellungen
          </div>
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${col.text} ${col.bg} border border-current border-opacity-20`}>
            {ampel === 'gruen' ? '✓ Stabil' : ampel === 'gelb' ? '⚠ Aufmerksam' : '🔴 Kritisch'}
          </div>
        </div>
      </div>
    </div>
  );
}
