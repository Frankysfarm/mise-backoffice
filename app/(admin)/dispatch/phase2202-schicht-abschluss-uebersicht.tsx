'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, MapPin, Star, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerBilanzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  status: 'aktiv' | 'pause' | 'offline';
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
  km_heute: number;
  schicht_start: string | null;
}

interface ApiData {
  fahrer: FahrerBilanzEintrag[];
  gesamt_einnahmen_eur: number;
  gesamt_stopps: number;
  aktive_fahrer: number;
}

function statusColor(s: 'aktiv' | 'pause' | 'offline') {
  if (s === 'aktiv') return 'bg-green-500';
  if (s === 'pause') return 'bg-yellow-500';
  return 'bg-gray-400';
}

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function DispatchPhase2202SchichtAbschlussUebersicht({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-bilanz';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.einnahmen_eur - a.einnahmen_eur);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Schicht-Abschluss Übersicht</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> {data.aktive_fahrer} aktiv
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Euro className="w-3 h-3" /> {fmt(data.gesamt_einnahmen_eur)}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Gesamt', value: fmt(data.gesamt_einnahmen_eur) },
              { label: 'Stopps', value: String(data.gesamt_stopps) },
              { label: 'Aktiv', value: String(data.aktive_fahrer) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-center">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>

          {/* Fahrer list sorted by earnings */}
          <div className="space-y-2">
            {sorted.map((f, idx) => (
              <div key={f.fahrer_id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', statusColor(f.status))} />
                    {idx === 0 && <span className="text-xs text-yellow-500 font-bold">★</span>}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{f.fahrer_name}</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">
                    {f.einnahmen_eur > 0 ? fmt(f.einnahmen_eur) : '–'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {f.stopps_heute} Stopps · {f.km_heute} km
                  </span>
                  {f.bewertung_avg && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {f.bewertung_avg.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
