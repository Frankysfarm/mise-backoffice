'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Palette } from 'lucide-react';

interface StationEntry {
  station_id: string;
  station_name: string;
  aktive_bestellungen: number;
  warte_minuten: number;
  auslastung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  stationen: StationEntry[];
  gesamt_auslastung: number;
  alert_count: number;
  avg_warte_min: number;
}

const MOCK: ApiData = {
  stationen: [
    { station_id: 's1', station_name: 'Grill',      aktive_bestellungen: 3,  warte_minuten: 8,  auslastung_pct: 60, ampel: 'gruen' },
    { station_id: 's2', station_name: 'Frittieuse', aktive_bestellungen: 6,  warte_minuten: 14, auslastung_pct: 80, ampel: 'gelb'  },
    { station_id: 's3', station_name: 'Salate',     aktive_bestellungen: 2,  warte_minuten: 4,  auslastung_pct: 35, ampel: 'gruen' },
    { station_id: 's4', station_name: 'Pizza',      aktive_bestellungen: 9,  warte_minuten: 21, auslastung_pct: 95, ampel: 'rot'   },
    { station_id: 's5', station_name: 'Getränke',   aktive_bestellungen: 1,  warte_minuten: 2,  auslastung_pct: 20, ampel: 'gruen' },
  ],
  gesamt_auslastung: 58,
  alert_count: 1,
  avg_warte_min: 9.8,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700',     dot: 'bg-red-500',   text: 'text-red-700 dark:text-red-400',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bar: 'bg-green-500' };
}

export function KitchenPhase3089EchtzeitFarbkodierungsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/queue?location_id=${locationId ?? ''}&view=stationen`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [locationId]);

  const stationen = data?.stationen ?? [];
  const alertStationen = stationen.filter(s => s.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-purple-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Echtzeit Farbkodierungs-Board</span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* KPI */}
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Gesamt-Auslastung</div>
              <div className={`font-bold text-base ${(data?.gesamt_auslastung ?? 0) >= 80 ? 'text-red-600' : (data?.gesamt_auslastung ?? 0) >= 60 ? 'text-amber-600' : 'text-green-600'}`}>
                {data?.gesamt_auslastung ?? 0} %
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Ø Wartezeit</div>
              <div className={`font-bold text-base ${(data?.avg_warte_min ?? 0) > 15 ? 'text-red-600' : (data?.avg_warte_min ?? 0) > 10 ? 'text-amber-600' : 'text-green-600'}`}>
                {data?.avg_warte_min?.toFixed(1) ?? '—'} min
              </div>
            </div>
          </div>

          {alertStationen.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alertStationen.map(s => s.station_name).join(', ')} — Überlastung!
            </div>
          )}

          <div className="space-y-2">
            {stationen.map(station => {
              const cls = ampelCls(station.ampel);
              return (
                <div key={station.station_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{station.station_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={`font-semibold ${cls.text}`}>{station.aktive_bestellungen} Best.</span>
                      <span className={`font-bold ${cls.text}`}>{station.auslastung_pct} %</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${station.auslastung_pct}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">Ø {station.warte_minuten} min Wartezeit</div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Normal (&lt;60%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Erhöht (60–80%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Überlastet (&gt;80%)</span>
          </div>
        </div>
      )}
    </div>
  );
}
