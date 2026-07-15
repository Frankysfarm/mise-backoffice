'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  voraussichtliche_kochzeit?: number | null;
  typ?: string | null;
  prioritaet?: string | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'ok' | 'warn' | 'dringend' | 'kritisch' | 'ueberfaellig';

const META: Record<Ampel, { label: string; bg: string; border: string; text: string; dot: string; pulse: boolean }> = {
  ok:           { label: 'Pünktlich',   bg: 'bg-emerald-50',  border: 'border-emerald-300', text: 'text-emerald-800', dot: 'bg-emerald-500', pulse: false },
  warn:         { label: 'Bald fällig', bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-800',   dot: 'bg-amber-400',   pulse: false },
  dringend:     { label: 'Dringend',    bg: 'bg-orange-50',   border: 'border-orange-300',  text: 'text-orange-800',  dot: 'bg-orange-500',  pulse: true  },
  kritisch:     { label: 'Kritisch',    bg: 'bg-red-50',      border: 'border-red-400',     text: 'text-red-800',     dot: 'bg-red-500',     pulse: true  },
  ueberfaellig: { label: 'Überfällig', bg: 'bg-violet-50',   border: 'border-violet-400',  text: 'text-violet-800',  dot: 'bg-violet-600',  pulse: true  },
};

const ACTIVE_STATI = new Set(['bestätigt', 'in_zubereitung', 'neu', 'confirmed', 'preparing']);

function classify(bestellt_am: string, zielSek: number): { ampel: Ampel; remaining: number } {
  const elapsed = (Date.now() - new Date(bestellt_am).getTime()) / 1000;
  const remaining = zielSek - elapsed;
  const ratio = elapsed / zielSek;
  let ampel: Ampel;
  if (ratio < 0.6)      ampel = 'ok';
  else if (ratio < 0.8) ampel = 'warn';
  else if (ratio < 1.0) ampel = 'dringend';
  else if (ratio < 1.3) ampel = 'kritisch';
  else                  ampel = 'ueberfaellig';
  return { ampel, remaining };
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = Math.floor(abs % 60).toString().padStart(2, '0');
  return `${sec < 0 ? '+' : ''}${m}:${s}`;
}

export function KitchenPhase1628LiveFarbkodierungCountdownMatrix({ orders }: Props) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const aktiv = useMemo(() => {
    return orders
      .filter((o) => o.status && ACTIVE_STATI.has(o.status) && o.bestellt_am)
      .map((o) => {
        const zielSek = (o.voraussichtliche_kochzeit ?? 20) * 60;
        const { ampel, remaining } = classify(o.bestellt_am!, zielSek);
        return { ...o, ampel, remaining, zielSek };
      })
      .sort((a, b) => a.remaining - b.remaining);
  }, [orders]);

  if (aktiv.length === 0) return null;

  const counts = Object.fromEntries(
    (['ueberfaellig', 'kritisch', 'dringend', 'warn', 'ok'] as Ampel[]).map((a) => [
      a,
      aktiv.filter((o) => o.ampel === a).length,
    ]),
  ) as Record<Ampel, number>;

  const urgent = counts.ueberfaellig + counts.kritisch + counts.dringend;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${urgent > 0 ? 'bg-red-600' : 'bg-stone-800'} text-white`}
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1">
          Live Farbkodierung · Countdown-Matrix
        </span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5 tabular-nums">
          {aktiv.length} aktiv{urgent > 0 ? ` · ${urgent} ⚡ dringend` : ''}
        </span>
      </div>

      {/* Ampel-Zusammenfassung */}
      <div className="flex border-b border-stone-100">
        {(['ueberfaellig', 'kritisch', 'dringend', 'warn', 'ok'] as Ampel[])
          .filter((a) => counts[a] > 0)
          .map((a) => {
            const m = META[a];
            return (
              <div key={a} className={`flex-1 text-center py-2 ${m.bg}`}>
                <div className={`text-lg font-black tabular-nums ${m.text}`}>{counts[a]}</div>
                <div className={`text-[9px] font-bold uppercase tracking-wider ${m.text} opacity-70`}>{m.label}</div>
              </div>
            );
          })}
      </div>

      {/* Countdown-Cards */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {aktiv.slice(0, 12).map((o) => {
          const m = META[o.ampel];
          const progress = Math.max(0, Math.min(1, 1 - o.remaining / o.zielSek));
          return (
            <div
              key={o.id}
              className={`rounded-xl border ${m.border} ${m.bg} p-3 flex flex-col gap-1.5 relative overflow-hidden`}
            >
              {/* Fortschritts-Balken */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/40">
                <div
                  className={`h-full ${m.dot} transition-all duration-1000`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${m.dot} ${m.pulse ? 'animate-pulse' : ''} shrink-0`} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${m.text}`}>{m.label}</span>
              </div>

              <div className={`text-2xl font-black tabular-nums tracking-tight ${m.text}`}>
                {fmtCountdown(o.remaining)}
              </div>

              <div className="text-[10px] text-stone-500 truncate">
                #{o.bestellnummer ?? o.id.slice(-4)}
                {o.prioritaet === 'express' && (
                  <span className="ml-1 text-amber-600 font-bold">⚡ Express</span>
                )}
                {o.typ === 'delivery' && <span className="ml-1">🛵</span>}
              </div>
            </div>
          );
        })}
      </div>

      {aktiv.length > 12 && (
        <div className="px-4 pb-3 text-[11px] text-stone-400 text-center">
          +{aktiv.length - 12} weitere aktive Bestellungen
        </div>
      )}
    </div>
  );
}
