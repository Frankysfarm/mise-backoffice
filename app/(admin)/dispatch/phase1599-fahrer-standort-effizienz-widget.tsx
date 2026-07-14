'use client';

import React, { useEffect, useState } from 'react';

interface ZoneRow {
  zone: string;
  avg_fahrzeit_min: number;
  lieferungen: number;
  status: 'optimal' | 'normal' | 'ungünstig';
}

interface FahrerRow {
  driver_id: string;
  driver_name: string;
  beste_zone: string;
  schlechteste_zone: string;
  zonen: ZoneRow[];
  hotspot_vorschlag: string;
  gesamt_status: 'optimal' | 'normal' | 'ungünstig';
}

interface Props {
  locationId: string | null;
}

const STATUS_STYLE = {
  optimal:   { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', label: 'Optimal' },
  normal:    { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400',   label: 'Normal' },
  'ungünstig': { badge: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-500',    label: 'Ungünstig' },
};

export function DispatchPhase1599FahrerStandortEffizienzWidget({ locationId }: Props) {
  const [data, setData] = useState<FahrerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const loc = locationId ?? '';
        const res = await fetch(`/api/delivery/admin/fahrer-standort-effizienz${loc ? `?location_id=${loc}` : ''}`);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) setData(json as FahrerRow[]);
        }
      } catch {
        // Mock-Fallback via API
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 20 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!open) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden mb-4 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-matcha-800 text-white">
        <span className="text-sm font-bold uppercase tracking-wider flex-1">Fahrer-Standort-Effizienz</span>
        {loading && <span className="text-white/60 text-xs animate-pulse">…</span>}
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{data.length} Fahrer</span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white text-lg leading-none">×</button>
      </div>

      {data.length === 0 ? (
        <div className="p-4 text-sm text-gray-400 text-center">Lade Effizienz-Daten…</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {data.map((f) => {
            const style = STATUS_STYLE[f.gesamt_status];
            return (
              <div key={f.driver_id} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  <span className="font-semibold text-sm text-gray-800 flex-1">{f.driver_name}</span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${style.badge}`}>{style.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-emerald-50 px-3 py-2">
                    <div className="text-[9px] text-emerald-600 font-bold uppercase mb-0.5">Beste Zone</div>
                    <div className="font-semibold text-emerald-800">{f.beste_zone}</div>
                  </div>
                  <div className="rounded-lg bg-rose-50 px-3 py-2">
                    <div className="text-[9px] text-rose-500 font-bold uppercase mb-0.5">Schwächste Zone</div>
                    <div className="font-semibold text-rose-700">{f.schlechteste_zone}</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-matcha-700 bg-matcha-50 rounded-lg px-3 py-1.5">
                  Hotspot-Empfehlung: <span className="font-bold">{f.hotspot_vorschlag}</span>
                </div>
                {f.zonen.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.zonen.map((z) => {
                      const zs = STATUS_STYLE[z.status];
                      return (
                        <span key={z.zone} className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${zs.badge}`}>
                          {z.zone} · {z.avg_fahrzeit_min} min
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 pb-3 text-[10px] text-gray-400">
        7-Tage-Aggregat · Aktualisierung alle 20 Min.
      </div>
    </div>
  );
}
