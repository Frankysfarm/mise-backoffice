'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Euro } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerEinnahmenPerf {
  fahrer_id: string;
  name: string;
  verdienst_eur: number;
  trinkgeld_eur: number;
  touren_heute: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEinnahmenPerf[];
  team_durchschnitt_eur: number;
}

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function KitchenPhase2197EinnahmenMonitor({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-einnahmen-performance?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-einnahmen-performance';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const { alertFahrer, gesamtVerdienst, gesamtTrinkgeld, gesamtTouren } = useMemo(() => {
    if (!data) return { alertFahrer: [], gesamtVerdienst: 0, gesamtTrinkgeld: 0, gesamtTouren: 0 };
    const alertFahrer = data.fahrer.filter((f) => f.alert);
    const gesamtVerdienst = Math.round(data.fahrer.reduce((s, f) => s + f.verdienst_eur, 0) * 100) / 100;
    const gesamtTrinkgeld = Math.round(data.fahrer.reduce((s, f) => s + f.trinkgeld_eur, 0) * 100) / 100;
    const gesamtTouren = data.fahrer.reduce((s, f) => s + f.touren_heute, 0);
    return { alertFahrer, gesamtVerdienst, gesamtTrinkgeld, gesamtTouren };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Einnahmen-Monitor</span>
        <div className="flex items-center gap-2">
          {alertFahrer.length > 0 && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
              {alertFahrer.length} unter 50%
            </span>
          )}
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Euro className="w-3 h-3" />
            {fmt(gesamtVerdienst)} gesamt
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Verdienst', value: fmt(gesamtVerdienst) },
              { label: 'Trinkgeld', value: fmt(gesamtTrinkgeld) },
              { label: 'Touren', value: String(gesamtTouren) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-center">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>

          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {alertFahrer.map((f) => f.name).join(', ')} unter 50% des Team-Ø — Dispatcher informieren!
              </span>
            </div>
          )}

          <div className="space-y-1">
            {[...data.fahrer]
              .filter((f) => f.alert)
              .map((f) => (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-xs',
                    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  )}
                >
                  <span className="font-medium">{f.name}</span>
                  <span className="font-bold">
                    {f.verdienst_eur > 0 ? fmt(f.verdienst_eur) : '–'}
                    <span className="text-gray-400 ml-1">({f.touren_heute} Touren)</span>
                  </span>
                </div>
              ))}
            {alertFahrer.length === 0 && (
              <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                Alle Fahrer performen über 50% des Team-Ø ✓
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
