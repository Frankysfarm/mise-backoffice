'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface Order {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  voraussichtliche_kochzeit?: number | null;
}

interface Props {
  orders: Order[];
  kapazitaetsgrenze?: number;
}

type Eskalation = 'normal' | 'achtung' | 'kritisch';

const ACTIVE_STATI = new Set(['bestätigt', 'in_zubereitung', 'neu', 'confirmed', 'preparing']);

const META: Record<Eskalation, { label: string; bg: string; headerBg: string; border: string; text: string; barColor: string }> = {
  normal:   { label: 'Normal',   bg: 'bg-emerald-50',  headerBg: 'bg-emerald-700', border: 'border-emerald-200', text: 'text-emerald-700', barColor: 'bg-emerald-500' },
  achtung:  { label: 'Achtung',  bg: 'bg-amber-50',    headerBg: 'bg-amber-600',   border: 'border-amber-200',   text: 'text-amber-700',   barColor: 'bg-amber-400'   },
  kritisch: { label: 'Kritisch', bg: 'bg-red-50',      headerBg: 'bg-red-700',     border: 'border-red-300',     text: 'text-red-700',     barColor: 'bg-red-500'     },
};

function classify(aktiv: number, grenze: number): Eskalation {
  const ratio = aktiv / grenze;
  if (ratio >= 0.9) return 'kritisch';
  if (ratio >= 0.7) return 'achtung';
  return 'normal';
}

function fmtCountdown(sec: number): string {
  if (sec <= 0) return '–';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')} Min`;
}

export function KitchenPhase1633KuechenKapazitaetsWarnungPanel({ orders, kapazitaetsgrenze = 10 }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const { aktiv, eskalation, auslastungPct, avgRemainingMin, maxRemainingMin } = useMemo(() => {
    const aktiv = orders.filter((o) => o.status && ACTIVE_STATI.has(o.status));

    const remainings = aktiv
      .filter((o) => o.bestellt_am)
      .map((o) => {
        const elapsed = (Date.now() - new Date(o.bestellt_am!).getTime()) / 1000;
        const target = (o.voraussichtliche_kochzeit ?? 20) * 60;
        return Math.max(0, target - elapsed);
      });

    const avgRemainingMin =
      remainings.length > 0
        ? remainings.reduce((a, b) => a + b, 0) / remainings.length / 60
        : 0;
    const maxRemainingMin =
      remainings.length > 0 ? Math.max(...remainings) / 60 : 0;

    const eskalation = classify(aktiv.length, kapazitaetsgrenze);
    const auslastungPct = Math.min(100, Math.round((aktiv.length / kapazitaetsgrenze) * 100));

    return { aktiv, eskalation, auslastungPct, avgRemainingMin, maxRemainingMin };
  }, [orders, kapazitaetsgrenze]);

  if (aktiv.length === 0) return null;

  const m = META[eskalation];
  const normalisiertInSek = eskalation !== 'normal'
    ? Math.max(0, (kapazitaetsgrenze - aktiv.length) * 3 * 60)
    : 0;

  return (
    <div className={`rounded-2xl border ${m.border} ${m.bg} overflow-hidden shadow-sm mb-4`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${m.headerBg} text-white`}>
        {eskalation === 'kritisch' && <span className="animate-pulse text-base">⚠️</span>}
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Küchen-Kapazität · {m.label}
        </span>
        <span className="bg-white/20 rounded-full px-2 py-0.5 text-xs tabular-nums">
          {aktiv.length}/{kapazitaetsgrenze} Bestellungen
        </span>
      </div>

      {/* Auslastungs-Balken */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${m.text}`}>Auslastung</span>
          <span className={`text-sm font-black tabular-nums ${m.text}`}>{auslastungPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-black/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${m.barColor} ${eskalation === 'kritisch' ? 'animate-pulse' : ''}`}
            style={{ width: `${auslastungPct}%` }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 divide-x divide-black/5 border-t border-black/5 mx-4 mb-3">
        <div className="px-3 py-2 text-center">
          <div className={`text-lg font-black tabular-nums ${m.text}`}>{aktiv.length}</div>
          <div className="text-[9px] text-stone-500 uppercase tracking-wide">In Arbeit</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`text-lg font-black tabular-nums ${m.text}`}>{avgRemainingMin.toFixed(0)}</div>
          <div className="text-[9px] text-stone-500 uppercase tracking-wide">Ø Rest-Min</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className={`text-lg font-black tabular-nums ${m.text}`}>{maxRemainingMin.toFixed(0)}</div>
          <div className="text-[9px] text-stone-500 uppercase tracking-wide">Max Rest-Min</div>
        </div>
      </div>

      {/* Normalisierungs-Countdown */}
      {eskalation !== 'normal' && normalisiertInSek > 0 && (
        <div className={`mx-4 mb-3 rounded-xl ${m.bg} border ${m.border} px-3 py-2 flex items-center gap-2`}>
          <span className="text-[10px] text-stone-500">Normalisierung in ca.</span>
          <span className={`text-sm font-black tabular-nums ${m.text}`}>{fmtCountdown(normalisiertInSek)}</span>
        </div>
      )}
    </div>
  );
}
