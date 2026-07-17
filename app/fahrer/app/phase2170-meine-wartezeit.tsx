'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Lightbulb } from 'lucide-react';

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

function tipp(avg: number): string {
  if (avg <= 2) return 'Ausgezeichnet! Deine Abholzeiten sind optimal.';
  if (avg <= 5) return 'Gut. Versuche 5 Min. vor ETA am Restaurant zu sein.';
  if (avg <= 8) return 'Informiere die Küche vorab, damit das Essen rechtzeitig fertig ist.';
  return 'Bitte sprich mit deinem Dispatcher — regelmäßige Langwartezeiten belasten die Tour.';
}

export function FahrerPhase2170MeineWartezeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => null);
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = data.drivers.find((d) => d.fahrer_id === driverId) ?? data.drivers[0];
  if (!me) return null;

  const avg = me.avg_wartezeit_min;
  const teamAvg = data.team_avg_wartezeit;
  const diff = avg - teamAvg;
  const color = avg <= 3 ? 'text-green-600' : avg <= 8 ? 'text-yellow-600' : 'text-red-600';
  const bgColor = avg <= 3 ? 'bg-green-50' : avg <= 8 ? 'bg-yellow-50' : 'bg-red-50';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Wartezeit</span>
          {data.mock && <span className="text-[10px] text-gray-400 ml-1">Demo</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${color}`}>{avg.toFixed(1)} Min.</span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <div className={`rounded-lg ${bgColor} px-4 py-3 text-center`}>
            <div className={`text-3xl font-bold ${color}`}>{avg.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Ø Wartezeit beim Restaurant (Min.)</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className="text-lg font-bold text-gray-800">{teamAvg.toFixed(1)}</div>
              <div className="text-[10px] text-gray-500">Team-Ø (Min.)</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className={`text-lg font-bold ${diff <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-500">vs. Team-Ø</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className="text-base font-bold text-gray-800">{me.auftraege_gesamt}</div>
              <div className="text-[10px] text-gray-500">Aufträge heute</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center">
              <div className={`text-base font-bold ${me.auftraege_ueber5min > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {me.auftraege_ueber5min}
              </div>
              <div className="text-[10px] text-gray-500">&gt;5 Min. gewartet</div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">{tipp(avg)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
