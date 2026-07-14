'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  voraussichtliche_kochzeit?: number | null;
}

interface Props {
  orders: Order[];
}

type Stufe = 'ok' | 'warn' | 'dringend' | 'kritisch' | 'ueberfaellig';

const STUFE_META: Record<Stufe, { label: string; ring: string; bg: string; text: string; border: string }> = {
  ok:          { label: 'Pünktlich',    ring: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  warn:        { label: 'Bald fällig',  ring: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'   },
  dringend:    { label: 'Dringend',     ring: 'bg-orange-500',  bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200'  },
  kritisch:    { label: 'Kritisch',     ring: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200'     },
  ueberfaellig:{ label: 'Überfällig',  ring: 'bg-violet-500',  bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200'  },
};

function elapsedSeconds(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
}

function stufe(elapsed: number, ziel: number): Stufe {
  const ratio = elapsed / ziel;
  if (ratio < 0.6)  return 'ok';
  if (ratio < 0.8)  return 'warn';
  if (ratio < 1.0)  return 'dringend';
  if (ratio < 1.3)  return 'kritisch';
  return 'ueberfaellig';
}

function fmt(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return `${sec < 0 ? '+' : ''}${m}:${s}`;
}

export function KitchenPhase1613SmartCountdownPrioritaetsCockpit({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const aktiv = useMemo(() => {
    const ACTIVE = new Set(['bestätigt', 'in_zubereitung', 'neu']);
    return orders
      .filter((o) => o.status && ACTIVE.has(o.status) && o.bestellt_am)
      .map((o) => {
        const ziel = (o.voraussichtliche_kochzeit ?? 20) * 60;
        const elapsed = elapsedSeconds(o.bestellt_am!);
        const remaining = ziel - elapsed;
        const s = stufe(elapsed, ziel);
        return { ...o, remaining, s };
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [orders, tick]);

  if (aktiv.length === 0) return null;

  const zusammenfassung = (['ueberfaellig', 'kritisch', 'dringend', 'warn', 'ok'] as Stufe[]).map((s) => ({
    s,
    count: aktiv.filter((o) => o.s === s).length,
  })).filter((x) => x.count > 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-stone-800 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Smart Countdown · Prioritäts-Cockpit
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{aktiv.length} aktiv</span>
      </div>

      {/* Ampel-Zusammenfassung */}
      <div className="flex gap-2 px-4 pt-3 pb-2 flex-wrap">
        {zusammenfassung.map(({ s, count }) => {
          const m = STUFE_META[s];
          return (
            <span key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.bg} ${m.text} ${m.border} border`}>
              <span className={`inline-block w-2 h-2 rounded-full ${m.ring}`} />
              {count}× {m.label}
            </span>
          );
        })}
      </div>

      {/* Countdown-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
        {aktiv.slice(0, 12).map((o) => {
          const m = STUFE_META[o.s];
          const pct = Math.min(100, Math.max(0,
            o.remaining >= 0
              ? 100 - (o.remaining / ((o.voraussichtliche_kochzeit ?? 20) * 60)) * 100
              : 100,
          ));
          return (
            <div key={o.id} className={`rounded-xl border p-3 ${m.bg} ${m.border}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${m.text} mb-1`}>
                {o.s === 'ueberfaellig' ? '⚠ ' : ''}{m.label}
              </div>
              <div className={`text-xl font-black tabular-nums ${m.text}`}>
                {o.remaining >= 0 ? fmt(o.remaining) : `+${fmt(o.remaining).replace('+', '')}`}
              </div>
              <div className="text-[10px] text-stone-500 mt-0.5 truncate">
                #{o.bestellnummer ?? o.id.slice(-4)}
              </div>
              <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all ${m.ring}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {aktiv.length > 12 && (
        <div className="px-4 pb-3 text-xs text-stone-400 text-center">
          +{aktiv.length - 12} weitere Bestellungen
        </div>
      )}
    </div>
  );
}
