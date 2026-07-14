'use client';

import React, { useEffect, useState } from 'react';

interface FahrerBilanzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  status: 'aktiv' | 'pause' | 'offline';
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
  km_heute: number;
}

interface ApiResponse {
  fahrer: FahrerBilanzEintrag[];
  gesamt_einnahmen_eur: number;
  gesamt_stopps: number;
  aktive_fahrer: number;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  aktiv: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Aktiv' },
  pause: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pause' },
  offline: { bg: 'bg-stone-100', text: 'text-stone-500', label: 'Offline' },
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

interface Props {
  locationId?: string | null;
}

export function DispatchPhase1569FahrerSchichtBilanzWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const url = `/api/delivery/admin/fahrer-schicht-bilanz${locationId ? `?location_id=${locationId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse space-y-2">
        <div className="h-4 w-48 bg-stone-100 rounded" />
        <div className="h-24 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Schicht-Bilanz je Fahrer</p>
        <button onClick={() => setOpen((o) => !o)} className="text-stone-400 hover:text-stone-600 text-xs">
          {open ? '▲' : '▼'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/60 rounded-xl p-2 text-center">
          <p className="text-lg font-black text-blue-700">{data.aktive_fahrer}</p>
          <p className="text-stone-500">Aktiv</p>
        </div>
        <div className="bg-white/60 rounded-xl p-2 text-center">
          <p className="text-lg font-black text-blue-700">{data.gesamt_stopps}</p>
          <p className="text-stone-500">Stopps heute</p>
        </div>
        <div className="bg-white/60 rounded-xl p-2 text-center">
          <p className="text-sm font-black text-blue-700">{fmtEur(data.gesamt_einnahmen_eur)}</p>
          <p className="text-stone-500">Einnahmen</p>
        </div>
      </div>

      {open && (
        <div className="space-y-2">
          {data.fahrer.map((f) => {
            const badge = STATUS_BADGE[f.status] ?? STATUS_BADGE.offline;
            return (
              <div key={f.fahrer_id} className="bg-white/70 rounded-xl p-2 flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <p className="font-semibold text-stone-700 truncate">{f.fahrer_name}</p>
                  </div>
                  <p className="text-stone-500 mt-0.5">{f.stopps_heute} Stopps · {f.km_heute} km</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-blue-700">{fmtEur(f.einnahmen_eur)}</p>
                  {f.bewertung_avg !== null && (
                    <p className="text-stone-400 text-[10px]">★ {f.bewertung_avg.toFixed(1)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
