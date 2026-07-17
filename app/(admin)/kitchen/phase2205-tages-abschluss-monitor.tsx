'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, MapPin, Star, TrendingUp } from 'lucide-react';

interface FahrerBilanzEintrag {
  fahrer_id: string;
  fahrer_name: string;
  status: 'aktiv' | 'pause' | 'offline';
  einnahmen_eur: number;
  stopps_heute: number;
  bewertung_avg: number | null;
  km_heute: number;
}

interface ApiData {
  fahrer: FahrerBilanzEintrag[];
  gesamt_einnahmen_eur: number;
  gesamt_stopps: number;
  aktive_fahrer: number;
}

function fmt(eur: number) {
  return eur.toFixed(2).replace('.', ',') + ' €';
}

export function KitchenPhase2205TagesAbschlussMonitor({ locationId }: { locationId?: string | null }) {
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const gesamtKm = data.fahrer.reduce((s, f) => s + f.km_heute, 0);
    const mitBewertung = data.fahrer.filter((f) => f.bewertung_avg !== null);
    const avgBewertung =
      mitBewertung.length > 0
        ? Math.round((mitBewertung.reduce((s, f) => s + (f.bewertung_avg ?? 0), 0) / mitBewertung.length) * 10) / 10
        : null;
    return { gesamtKm, avgBewertung };
  }, [data]);

  if (!data || !stats) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Tages-Abschluss Monitor</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Euro className="w-3 h-3" /> {fmt(data.gesamt_einnahmen_eur)}
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Einnahmen', value: fmt(data.gesamt_einnahmen_eur), icon: <Euro className="w-3 h-3" /> },
              { label: 'Stopps', value: String(data.gesamt_stopps), icon: <MapPin className="w-3 h-3" /> },
              { label: 'km Gesamt', value: String(stats.gesamtKm), icon: <TrendingUp className="w-3 h-3" /> },
              { label: 'Ø Bewertung', value: stats.avgBewertung ? String(stats.avgBewertung) : '–', icon: <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-2 py-2 text-center">
                <div className="flex justify-center mb-0.5 text-gray-400">{icon}</div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            ))}
          </div>

          {/* Fahrer summary */}
          <div className="space-y-1">
            <div className="text-xs text-gray-500 font-medium">Fahrer-Tagesleistung:</div>
            {[...data.fahrer].sort((a, b) => b.einnahmen_eur - a.einnahmen_eur).map((f) => (
              <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{f.fahrer_name}</span>
                <div className="flex items-center gap-3 text-gray-400">
                  <span>{f.stopps_heute} Stopps</span>
                  <span>{f.km_heute} km</span>
                  {f.bewertung_avg && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {f.bewertung_avg.toFixed(1)}
                    </span>
                  )}
                  <span className="font-semibold text-green-600">{fmt(f.einnahmen_eur)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
