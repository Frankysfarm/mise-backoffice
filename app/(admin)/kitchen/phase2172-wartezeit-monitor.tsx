'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, Users } from 'lucide-react';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
  trend_7tage: number;
};

type ApiResponse = {
  drivers: FahrerWartezeit[];
  team_avg_wartezeit: number;
  location_id: string | null;
  mock?: boolean;
};

export function KitchenPhase2172WartezeitMonitor({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => null);
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  const { langwarter, teamAvg, eskalation } = useMemo(() => {
    if (!data) return { langwarter: [], teamAvg: 0, eskalation: false };
    const lw = data.drivers.filter((d) => d.avg_wartezeit_min > 8);
    return {
      langwarter: lw,
      teamAvg: data.team_avg_wartezeit,
      eskalation: lw.length >= 2,
    };
  }, [data]);

  if (!data) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Wartezeit-Monitor</span>
          {data.mock && <span className="text-[10px] text-gray-400 ml-1">Demo</span>}
        </div>
        <div className="flex items-center gap-3">
          {eskalation && <AlertTriangle className="h-4 w-4 text-red-500" />}
          <span className={`text-sm font-bold ${teamAvg <= 3 ? 'text-green-600' : teamAvg <= 8 ? 'text-yellow-600' : 'text-red-600'}`}>
            Team-Ø {teamAvg.toFixed(1)} Min.
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className={`text-xl font-bold ${teamAvg <= 3 ? 'text-green-600' : teamAvg <= 8 ? 'text-yellow-600' : 'text-red-600'}`}>
                {teamAvg.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-500">Team-Ø Min.</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className={`text-xl font-bold ${langwarter.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {langwarter.length}
              </div>
              <div className="text-[10px] text-gray-500">Fahrer &gt;8 Min.</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className="text-xl font-bold text-gray-700">{data.drivers.length}</div>
              <div className="text-[10px] text-gray-500">Fahrer aktiv</div>
            </div>
          </div>

          {eskalation && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                <span className="font-semibold">Eskalation:</span> {langwarter.length} Fahrer warten &gt;8 Min. —
                Küchen-Koordination notwendig, Vorbereitungszeiten anpassen.
              </div>
            </div>
          )}

          {langwarter.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                <Users className="h-3.5 w-3.5" />
                Langwarter
              </div>
              {langwarter.map((f) => (
                <div key={f.fahrer_id} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">{f.name}</span>
                  <span className="text-sm font-bold text-red-600">{f.avg_wartezeit_min.toFixed(1)} Min.</span>
                </div>
              ))}
            </div>
          )}

          {langwarter.length === 0 && (
            <p className="text-center text-xs text-green-600">Alle Fahrer warten unter 8 Min. ✓</p>
          )}
        </div>
      )}
    </div>
  );
}
