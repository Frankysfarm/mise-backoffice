'use client';

import React, { useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  status: string;
  accepted_at?: string | null;
  created_at?: string;
}

interface Props {
  orders: OrderInput[];
}

type DruckStufe = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

const STUFEN: Record<DruckStufe, { bg: string; border: string; text: string; ring: string; label: string }> = {
  niedrig: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'bg-emerald-400', label: 'Kein Stau' },
  mittel: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'bg-amber-400', label: 'Mittlerer Druck' },
  hoch: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', ring: 'bg-orange-400', label: 'Hoher Druck' },
  kritisch: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', ring: 'bg-rose-400', label: 'Kritisch' },
};

const ACTIVE_STATUSES = ['neu', 'angenommen', 'in_zubereitung', 'preparing', 'accepted'];

export function KitchenPhase1568WarteschlangenDruckAnzeige({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { stufe, buckets, total } = useMemo(() => {
    const now = Date.now();
    const aktive = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));

    const b5 = aktive.filter((o) => {
      const t = o.accepted_at ?? o.created_at;
      if (!t) return false;
      const diff = (now - new Date(t).getTime()) / 60_000;
      return diff >= 5 && diff < 10;
    }).length;

    const b10 = aktive.filter((o) => {
      const t = o.accepted_at ?? o.created_at;
      if (!t) return false;
      const diff = (now - new Date(t).getTime()) / 60_000;
      return diff >= 10 && diff < 15;
    }).length;

    const b15 = aktive.filter((o) => {
      const t = o.accepted_at ?? o.created_at;
      if (!t) return false;
      const diff = (now - new Date(t).getTime()) / 60_000;
      return diff >= 15;
    }).length;

    let stufe: DruckStufe = 'niedrig';
    if (b15 >= 2 || b10 >= 3) stufe = 'kritisch';
    else if (b15 >= 1 || b10 >= 2) stufe = 'hoch';
    else if (b5 >= 3 || b10 >= 1) stufe = 'mittel';

    return { stufe, buckets: { b5, b10, b15 }, total: aktive.length };
  }, [orders]);

  if (total === 0) return null;

  const cfg = STUFEN[stufe];

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${cfg.ring} inline-block shrink-0`} />
          <p className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>
            Warteschlangen-Druck
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-stone-400 hover:text-stone-600 text-xs">
          {open ? '▲' : '▼'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-base font-black ${cfg.text}`}>{total}</span>
        <span className="text-xs text-stone-500">Bestellungen in Queue</span>
        <span className={`ml-auto text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
      </div>

      {open && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className={`rounded-xl bg-white/60 p-2 text-center ${buckets.b5 > 0 ? 'ring-1 ring-amber-300' : ''}`}>
            <p className={`text-lg font-black ${buckets.b5 > 0 ? 'text-amber-700' : 'text-stone-400'}`}>{buckets.b5}</p>
            <p className="text-stone-500 mt-0.5">5–10 Min</p>
          </div>
          <div className={`rounded-xl bg-white/60 p-2 text-center ${buckets.b10 > 0 ? 'ring-1 ring-orange-400' : ''}`}>
            <p className={`text-lg font-black ${buckets.b10 > 0 ? 'text-orange-700' : 'text-stone-400'}`}>{buckets.b10}</p>
            <p className="text-stone-500 mt-0.5">10–15 Min</p>
          </div>
          <div className={`rounded-xl bg-white/60 p-2 text-center ${buckets.b15 > 0 ? 'ring-1 ring-rose-400' : ''}`}>
            <p className={`text-lg font-black ${buckets.b15 > 0 ? 'text-rose-700' : 'text-stone-400'}`}>{buckets.b15}</p>
            <p className="text-stone-500 mt-0.5">&gt;15 Min</p>
          </div>
        </div>
      )}

      {open && stufe !== 'niedrig' && (
        <p className={`text-xs rounded-xl bg-white/60 p-2 ${cfg.text}`}>
          {stufe === 'kritisch'
            ? 'Achtung: Mehrere Bestellungen überschreiten Prep-Ziel. Kapazität sofort erhöhen!'
            : stufe === 'hoch'
            ? 'Warnung: Queue läuft heiß — priorisieren und Zubereitung beschleunigen.'
            : 'Leichter Rückstand — aktuelle Geschwindigkeit halten.'}
        </p>
      )}
    </div>
  );
}
