'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface StationData {
  id: string;
  name: string;
  aktive_bestellungen: number;
  max_kapazitaet: number;
  avg_wartezeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  auslastung_pct: number;
}

interface ApiData {
  stationen: StationData[];
  gesamt_auslastung: number;
  avg_wartezeit_gesamt: number;
  ueberlastet_count: number;
}

const MOCK: ApiData = {
  stationen: [
    { id: 's1', name: 'Pizza-Station', aktive_bestellungen: 4, max_kapazitaet: 6, avg_wartezeit_min: 8, ampel: 'gelb', auslastung_pct: 67 },
    { id: 's2', name: 'Burger-Grill',  aktive_bestellungen: 6, max_kapazitaet: 6, avg_wartezeit_min: 14, ampel: 'rot', auslastung_pct: 100 },
    { id: 's3', name: 'Salat-Bar',     aktive_bestellungen: 1, max_kapazitaet: 4, avg_wartezeit_min: 3, ampel: 'gruen', auslastung_pct: 25 },
    { id: 's4', name: 'Pasta-Kocher',  aktive_bestellungen: 5, max_kapazitaet: 5, avg_wartezeit_min: 11, ampel: 'rot', auslastung_pct: 100 },
    { id: 's5', name: 'Getränke',      aktive_bestellungen: 2, max_kapazitaet: 8, avg_wartezeit_min: 2, ampel: 'gruen', auslastung_pct: 25 },
  ],
  gesamt_auslastung: 63,
  avg_wartezeit_gesamt: 7.6,
  ueberlastet_count: 2,
};

function stationStyle(a: string) {
  if (a === 'rot')   return { border: 'border-red-500', bg: 'bg-red-900/30', text: 'text-red-400', bar: 'bg-red-500', dot: 'bg-red-500' };
  if (a === 'gelb')  return { border: 'border-amber-500', bg: 'bg-amber-900/20', text: 'text-amber-400', bar: 'bg-amber-400', dot: 'bg-amber-400' };
  return                    { border: 'border-green-600', bg: 'bg-green-900/20', text: 'text-green-400', bar: 'bg-green-500', dot: 'bg-green-500' };
}

export function KitchenPhase3174EchtzeitFarbkodierungUltra({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/station-load?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold text-white">Echtzeit-Farbkodierung Stationen</span>
          {d.ueberlastet_count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />{d.ueberlastet_count} überlastet
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">Auslastung: <span className={d.gesamt_auslastung >= 85 ? 'text-red-400' : d.gesamt_auslastung >= 65 ? 'text-amber-400' : 'text-green-400'} style={{fontWeight: 700}}>{d.gesamt_auslastung}%</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {/* Stations-Grid */}
          <div className="space-y-1.5">
            {d.stationen.map(st => {
              const s = stationStyle(st.ampel);
              return (
                <div key={st.id} className={`rounded-lg border p-2.5 ${s.border} ${s.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      <span className="text-xs font-semibold text-white">{st.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-gray-400">Ø Wartezeit: <span className={s.text} style={{fontWeight:700}}>{st.avg_wartezeit_min} Min</span></span>
                      <span className="text-gray-400">{st.aktive_bestellungen}/{st.max_kapazitaet}</span>
                      <span className={`font-bold ${s.text}`}>{st.auslastung_pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                      style={{ width: `${st.auslastung_pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gesamt-Statistik */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2 text-center">
              <div className={`text-lg font-black tabular-nums ${d.gesamt_auslastung >= 85 ? 'text-red-400' : d.gesamt_auslastung >= 65 ? 'text-amber-400' : 'text-green-400'}`}>{d.gesamt_auslastung}%</div>
              <div className="text-[9px] text-gray-500 mt-0.5">Gesamt-Auslastung</div>
            </div>
            <div className="rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2 text-center">
              <div className={`text-lg font-black tabular-nums ${d.avg_wartezeit_gesamt > 10 ? 'text-red-400' : d.avg_wartezeit_gesamt > 6 ? 'text-amber-400' : 'text-green-400'}`}>{d.avg_wartezeit_gesamt.toFixed(1)} Min</div>
              <div className="text-[9px] text-gray-500 mt-0.5">Ø Wartezeit Gesamt</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
