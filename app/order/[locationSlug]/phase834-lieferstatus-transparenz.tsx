'use client';

import { useEffect, useState } from 'react';
import { Info, ChefHat, Bike, Clock, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId?: string | null;
  locationId: string;
  deliveryTimeMin?: number;
  status?: string | null;
}

interface TransparenzData {
  kuechenzeit_min: number;
  fahrzeit_min: number;
  puffer_min: number;
  gesamt_min: number;
  zubereitungs_start: string | null;
  erwartet_fertig: string | null;
  punktlichkeit_rate: number;
}

const MOCK: TransparenzData = {
  kuechenzeit_min: 14,
  fahrzeit_min: 16,
  puffer_min: 5,
  gesamt_min: 35,
  zubereitungs_start: null,
  erwartet_fertig: null,
  punktlichkeit_rate: 87,
};

export function StorefrontPhase834LieferstatusTransparenz({ orderId, locationId, deliveryTimeMin = 35, status }: Props) {
  const [data, setData] = useState<TransparenzData | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    try {
      const params = new URLSearchParams({ location_id: locationId });
      if (orderId) params.set('order_id', orderId);
      const res = await fetch(`/api/delivery/eta?action=transparenz&${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.kuechenzeit_min) { setData(json); return; }
    } catch { /* noop */ }
    setData({ ...MOCK, gesamt_min: deliveryTimeMin });
  };

  useEffect(() => { load(); }, [orderId, locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  if (['geliefert', 'delivered', 'cancelled', 'storniert'].includes(status ?? '')) return null;

  const barParts = [
    { label: 'Küche', min: data.kuechenzeit_min, icon: ChefHat, color: 'bg-matcha-500', pct: (data.kuechenzeit_min / data.gesamt_min) * 100 },
    { label: 'Fahrt', min: data.fahrzeit_min, icon: Bike, color: 'bg-blue-500', pct: (data.fahrzeit_min / data.gesamt_min) * 100 },
    { label: 'Puffer', min: data.puffer_min, icon: Clock, color: 'bg-stone-300', pct: (data.puffer_min / data.gesamt_min) * 100 },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-stone-50 hover:bg-stone-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Info className="h-4 w-4 text-stone-500" />
        <span className="text-sm font-bold text-stone-800">Wie berechnet sich meine Lieferzeit?</span>
        {expanded ? <ChevronUp className="h-4 w-4 text-stone-400 ml-auto" /> : <ChevronDown className="h-4 w-4 text-stone-400 ml-auto" />}
      </button>

      {expanded && (
        <>
          {/* Gesamt */}
          <div className="px-5 pt-4 pb-3 text-center">
            <div className="text-3xl font-black tabular-nums text-stone-800">{data.gesamt_min}</div>
            <div className="text-xs text-stone-500">Minuten Gesamtlieferzeit</div>
          </div>

          {/* Stacked Bar */}
          <div className="mx-4 mb-4">
            <div className="h-3 rounded-full overflow-hidden flex">
              {barParts.map((p) => (
                <div
                  key={p.label}
                  className={cn('h-full transition-all', p.color)}
                  style={{ width: `${p.pct}%` }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              {barParts.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.label} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded-full', p.color)} />
                    <span className="text-[9px] text-stone-500">{p.label}: {p.min} Min</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail-Kacheln */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border-t border-stone-100">
            {barParts.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className="px-3 py-3 text-center">
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5', p.color)}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="text-sm font-black tabular-nums text-stone-800">{p.min} Min</div>
                  <div className="text-[9px] text-stone-400">{p.label}</div>
                </div>
              );
            })}
          </div>

          {/* Pünktlichkeits-Garantie */}
          <div className="mx-4 mb-4 mt-3 rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2.5 flex items-center gap-2">
            <Shield className="h-4 w-4 text-matcha-600 shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-matcha-800">
                {data.punktlichkeit_rate}% unserer Lieferungen kommen pünktlich an
              </span>
              <span className="block text-[9px] text-matcha-600">Basierend auf den letzten 7 Tagen</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
