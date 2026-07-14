'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface OrderInput {
  id: string;
  bestellnummer?: string;
  status: string;
  accepted_at?: string | null;
  created_at?: string | null;
  geschaetzte_zubereitung_min?: number | null;
}

interface Props {
  orders: OrderInput[];
  ziel_min?: number;
}

type Stufe = 'gruen' | 'hellgruen' | 'gelb' | 'orange' | 'rot';

const ACTIVE = ['angenommen', 'accepted', 'in_zubereitung', 'preparing', 'in_kitchen'];

const STUFEN: Record<Stufe, { bg: string; border: string; text: string; badge: string; label: string }> = {
  gruen:     { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-500 text-white',  label: 'Gut' },
  hellgruen: { bg: 'bg-green-50',    border: 'border-green-200',   text: 'text-green-700',   badge: 'bg-green-400 text-white',    label: 'OK' },
  gelb:      { bg: 'bg-yellow-50',   border: 'border-yellow-200',  text: 'text-yellow-700',  badge: 'bg-yellow-400 text-black',   label: 'Knapp' },
  orange:    { bg: 'bg-orange-50',   border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-500 text-white',   label: 'Dringend' },
  rot:       { bg: 'bg-rose-50',     border: 'border-rose-200',    text: 'text-rose-700',    badge: 'bg-rose-600 text-white',     label: 'Überfällig' },
};

function getStufe(elapsedMin: number, zielMin: number): Stufe {
  const pct = elapsedMin / zielMin;
  if (pct < 0.5)  return 'gruen';
  if (pct < 0.75) return 'hellgruen';
  if (pct < 0.9)  return 'gelb';
  if (pct < 1.0)  return 'orange';
  return 'rot';
}

function fmtCd(remainSec: number): string {
  if (remainSec <= 0) {
    const over = Math.abs(Math.ceil(remainSec / 60));
    return `+${over}m`;
  }
  const m = Math.floor(remainSec / 60);
  const s = Math.floor(remainSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1583SmartKochzeitCountdownMatrix({ orders, ziel_min = 12 }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => ACTIVE.includes(o.status))
      .map((o) => {
        const startMs = new Date(o.accepted_at ?? o.created_at ?? 0).getTime();
        const elapsedMin = (now - startMs) / 60_000;
        const zielMin = o.geschaetzte_zubereitung_min ?? ziel_min;
        const remainSec = (zielMin - elapsedMin) * 60;
        const stufe = getStufe(elapsedMin, zielMin);
        const pct = Math.min(100, Math.round((elapsedMin / zielMin) * 100));
        return { ...o, elapsedMin, remainSec, stufe, zielMin, pct };
      })
      .sort((a, b) => a.remainSec - b.remainSec);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick, ziel_min]);

  if (!open || rows.length === 0) return null;

  const critical = rows.filter((r) => r.stufe === 'rot' || r.stufe === 'orange').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/40 overflow-hidden mb-3">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-matcha-200/60">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-matcha-800">
            Kochzeit-Matrix
          </span>
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {rows.length} aktiv
          </span>
          {critical > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              {critical} überfällig/dringend
            </span>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-base leading-none text-muted-foreground hover:text-foreground">×</button>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {rows.map((r) => {
          const s = STUFEN[r.stufe];
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-2.5 flex flex-col gap-1 ${s.bg} ${s.border} ${r.stufe === 'rot' ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[10px] font-bold ${s.text}`}>
                  #{(r.bestellnummer ?? r.id).slice(-4)}
                </span>
                <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${s.badge}`}>
                  {s.label}
                </span>
              </div>
              <div className={`font-mono text-lg font-black tabular-nums leading-none ${s.text}`}>
                {fmtCd(r.remainSec)}
              </div>
              <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    r.stufe === 'rot' ? 'bg-rose-500' : r.stufe === 'orange' ? 'bg-orange-400' : r.stufe === 'gelb' ? 'bg-yellow-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${r.pct}%` }}
                />
              </div>
              <div className={`text-[9px] ${s.text} opacity-70`}>
                {Math.floor(r.elapsedMin)}m/{r.zielMin}m Ziel
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
