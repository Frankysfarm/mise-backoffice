'use client';

import React, { useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  status: string;
  created_at?: string;
  accepted_at?: string | null;
}

interface Props {
  orders: OrderInput[];
  kapazitaet_schwelle?: number;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

const ACTIVE_STATUSES = ['in_zubereitung', 'preparing', 'in_kitchen', 'angenommen', 'accepted'];

const AMPEL_CFG: Record<Ampel, { bg: string; border: string; text: string; dot: string; label: string }> = {
  gruen: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400', label: 'Kapazität frei' },
  gelb:  { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400',   label: 'Auslastung hoch' },
  rot:   { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-400',    label: 'Überlast!' },
};

export function KitchenPhase1578ZubereitungsParallelitaetsAnzeige({
  orders,
  kapazitaet_schwelle = 6,
}: Props) {
  const [open, setOpen] = useState(true);

  const { ampel, parallelCount, auslastungPct } = useMemo(() => {
    const now = Date.now();
    const aktive = orders.filter(
      (o) =>
        ACTIVE_STATUSES.includes(o.status) &&
        (o.accepted_at != null || o.created_at != null),
    );

    const inZubereitung = aktive.filter((o) => {
      const start = o.accepted_at ?? o.created_at;
      if (!start) return false;
      const minElapsed = (now - new Date(start).getTime()) / 60_000;
      return minElapsed >= 0 && minElapsed < 30;
    });

    const count = inZubereitung.length;
    const auslastungPct = Math.min(100, Math.round((count / kapazitaet_schwelle) * 100));

    let ampel: Ampel = 'gruen';
    if (count >= kapazitaet_schwelle) ampel = 'rot';
    else if (count >= kapazitaet_schwelle * 0.67) ampel = 'gelb';

    return { ampel, parallelCount: count, auslastungPct };
  }, [orders, kapazitaet_schwelle]);

  if (!open || parallelCount === 0) return null;

  const cfg = AMPEL_CFG[ampel];

  return (
    <div className={`rounded-xl border p-3 mb-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${cfg.dot} ${ampel === 'rot' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${cfg.text}`}>
            Parallelzubereitung
          </div>
          <div className={`text-sm font-bold ${cfg.text}`}>
            {parallelCount} Bestellung{parallelCount !== 1 ? 'en' : ''} gleichzeitig
            {ampel === 'rot' && ' — Küche überlastet'}
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                ampel === 'rot' ? 'bg-rose-400' : ampel === 'gelb' ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${auslastungPct}%` }}
            />
          </div>
          <div className={`mt-1 text-xs ${cfg.text} opacity-80`}>
            {auslastungPct}% Kapazität · Schwelle {kapazitaet_schwelle} Bestellungen · {cfg.label}
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className={`text-lg leading-none opacity-40 hover:opacity-70 ${cfg.text} shrink-0`}
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
    </div>
  );
}
