'use client';

import { useState, useEffect, useCallback } from 'react';
import { Grid3x3, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MatrixZelle { station: string; zeitfenster: string; status: 'ok' | 'warnung' | 'kritisch' | 'leer'; avg_min: number | null; bestellungen: number; }
interface ApiData { zellen: MatrixZelle[]; stationen: string[]; zeitfenster: string[]; kritisch_count: number; warnung_count: number; ok_count: number; }

const STATIONEN = ['Warm', 'Kalt', 'Grill', 'Pasta'];
const FENSTER = ['12-13', '13-14', '14-15', '17-18', '18-19', '19-20'];

const MOCK: ApiData = {
  stationen: STATIONEN,
  zeitfenster: FENSTER,
  kritisch_count: 3,
  warnung_count: 5,
  ok_count: 16,
  zellen: [
    ...STATIONEN.flatMap((s, si) => FENSTER.map((z, zi) => {
      const idx = si * FENSTER.length + zi;
      const status: MatrixZelle['status'] = [2, 7, 14].includes(idx) ? 'kritisch' : [1, 5, 8, 11, 17].includes(idx) ? 'warnung' : idx === 3 ? 'leer' : 'ok';
      return { station: s, zeitfenster: z, status, avg_min: status === 'leer' ? null : 8 + si * 2 + zi, bestellungen: status === 'leer' ? 0 : 3 + zi };
    })),
  ],
};

interface Props { locationId: string | null; }

export function KitchenPhase4120TimingFarbkodierungsMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-timing-matrix?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  const getColor = (s: MatrixZelle['status']) => {
    if (s === 'kritisch') return 'bg-red-400 text-white';
    if (s === 'warnung') return 'bg-yellow-300 text-gray-800';
    if (s === 'ok') return 'bg-emerald-200 text-emerald-800';
    return 'bg-gray-100 text-gray-300';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Grid3x3 className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-bold text-gray-900">Timing-Farbkodierungs-Matrix</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.kritisch_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {data.kritisch_count}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex items-center gap-1 bg-emerald-50 rounded-lg p-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <div><div className="text-[9px] text-gray-500">OK</div><div className="text-xs font-bold text-emerald-600">{data.ok_count}</div></div>
        </div>
        <div className="flex items-center gap-1 bg-yellow-50 rounded-lg p-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
          <div><div className="text-[9px] text-gray-500">Warnung</div><div className="text-xs font-bold text-yellow-500">{data.warnung_count}</div></div>
        </div>
        <div className="flex items-center gap-1 bg-red-50 rounded-lg p-1.5">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <div><div className="text-[9px] text-gray-500">Kritisch</div><div className="text-xs font-bold text-red-500">{data.kritisch_count}</div></div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[9px]">
          <thead>
            <tr>
              <th className="text-left text-gray-400 pr-1 w-10 font-normal">Station</th>
              {data.zeitfenster.map(z => (
                <th key={z} className="text-gray-400 font-normal px-0.5 min-w-[32px]">{z}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.stationen.map(station => (
              <tr key={station}>
                <td className="text-gray-600 pr-1 py-0.5 font-medium">{station}</td>
                {data.zeitfenster.map(z => {
                  const zelle = data.zellen.find(c => c.station === station && c.zeitfenster === z);
                  return (
                    <td key={z} className="px-0.5 py-0.5">
                      <div className={`rounded text-center py-0.5 px-1 ${getColor(zelle?.status ?? 'leer')}`}>
                        {zelle?.avg_min ?? '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-0.5">
        <span>Station × Zeitfenster · Werte in Minuten</span>
        <span>30-Sek-Polling</span>
      </div>
    </div>
  );
}
