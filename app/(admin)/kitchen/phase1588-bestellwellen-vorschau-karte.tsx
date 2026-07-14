'use client';

import React, { useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  created_at?: string | null;
  status?: string | null;
}

interface Props {
  orders: OrderInput[];
  locationId?: string | null;
}

interface Bucket {
  label: string;
  offset_min: number;
  prognose: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const HOUR_WEIGHTS: Record<number, number> = {
  10: 0.5, 11: 0.7, 12: 1.5, 13: 1.8, 14: 1.2,
  15: 0.6, 16: 0.5, 17: 0.8, 18: 1.9, 19: 2.0,
  20: 1.7, 21: 1.2, 22: 0.6, 23: 0.3,
};

function ampelFor(count: number): 'gruen' | 'gelb' | 'rot' {
  if (count <= 4) return 'gruen';
  if (count <= 8) return 'gelb';
  return 'rot';
}

const AMPEL_STYLE = {
  gruen: { bar: 'bg-emerald-400', text: 'text-emerald-700', label: 'Ruhig' },
  gelb:  { bar: 'bg-amber-400',   text: 'text-amber-700',   label: 'Mittel' },
  rot:   { bar: 'bg-rose-500',    text: 'text-rose-700',    label: 'Hoch' },
};

export function KitchenPhase1588BestellwellenVorschauKarte({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const buckets = useMemo<Bucket[]>(() => {
    const now = new Date();
    const recentOrders = orders.filter((o) => {
      if (!o.created_at) return false;
      const age = (Date.now() - new Date(o.created_at).getTime()) / 60_000;
      return age <= 60;
    });
    const ordersPerHour = recentOrders.length;

    const baseRate = Math.max(1, ordersPerHour);

    return [
      { label: 'Jetzt +30 Min', offset_min: 30 },
      { label: '+60 Min',       offset_min: 60 },
      { label: '+90 Min',       offset_min: 90 },
    ].map(({ label, offset_min }) => {
      const futureDate = new Date(now.getTime() + offset_min * 60_000);
      const futureHour = futureDate.getUTCHours();
      const weight = HOUR_WEIGHTS[futureHour] ?? 0.5;
      const prognose = Math.round(baseRate * weight * (offset_min / 60) * 0.8);
      return { label, offset_min, prognose, ampel: ampelFor(prognose) };
    });
  }, [orders]);

  if (!open) return null;

  const peak = buckets.reduce((max: Bucket, b: Bucket) => (b.prognose > max.prognose ? b : max), buckets[0]);
  const maxPrognose = Math.max(1, ...buckets.map((bk: Bucket) => bk.prognose));

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-600 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Bestellwellen-Vorschau</span>
        <span className="text-xs font-medium bg-white/20 rounded-full px-2 py-0.5">
          Peak: {peak.prognose} Bestell.
        </span>
        <button onClick={() => setOpen(false)} className="text-lg leading-none text-white/60 hover:text-white">×</button>
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        {buckets.map((b: Bucket) => {
          const style = AMPEL_STYLE[b.ampel];
          const barH = Math.min(100, Math.round((b.prognose / maxPrognose) * 100));
          return (
            <div key={b.offset_min} className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">{b.label}</span>
              <div className="relative w-full h-16 bg-gray-100 rounded-lg overflow-hidden flex items-end">
                <div
                  className={`w-full ${style.bar} transition-all duration-500 rounded-b-lg`}
                  style={{ height: `${Math.max(8, barH)}%` }}
                />
              </div>
              <span className={`text-lg font-black ${style.text}`}>{b.prognose}</span>
              <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-3 flex gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />Ruhig ≤4</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" />Mittel 5–8</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-rose-500" />Hoch &gt;8</span>
      </div>
    </div>
  );
}
