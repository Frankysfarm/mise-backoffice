'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface DriverStorno {
  id: string;
  name: string;
  cancelRate: number;
  alert: boolean;
}

interface StornoData {
  location_id: string;
  drivers: DriverStorno[];
  teamAvgCancelRate: number;
  generiert_am: string;
}

interface Props { locationId?: string | null; }

export function KitchenPhase2333StornoTicker({ locationId }: Props) {
  const [data, setData] = useState<StornoData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-analyse?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const alertDrivers = data?.drivers.filter(d => d.cancelRate > 15) ?? [];
  const hasAlert = alertDrivers.length > 0;

  function ampel(rate: number) {
    if (rate < 5) return 'text-green-600';
    if (rate < 15) return 'text-yellow-600';
    return 'text-red-600';
  }

  return (
    <div className={`rounded-xl border shadow-sm mb-4 ${hasAlert ? 'border-red-200 bg-white' : 'border-orange-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-t-xl ${hasAlert ? 'bg-red-50' : 'bg-orange-50'}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${hasAlert ? 'text-red-500' : 'text-orange-500'}`} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-orange-800'}`}>
            Storno-Ticker (Phase 2333)
          </span>
          {hasAlert && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{alertDrivers.length} Alert</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Storno-Daten…</p>
          ) : (
            <>
              <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                <span className="text-xs text-orange-600">Team Storno-Ø heute</span>
                <span className={`text-xl font-black ${ampel(data.teamAvgCancelRate)}`}>{data.teamAvgCancelRate}%</span>
              </div>

              {hasAlert && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">⚠ Hohe Storno-Rate:</p>
                  {alertDrivers.map(d => (
                    <p key={d.id} className="text-xs text-red-600">• {d.name}: {d.cancelRate}%</p>
                  ))}
                  <p className="text-xs text-red-500 mt-1">Bitte Ursache mit Dispatch klären.</p>
                </div>
              )}

              <div className="space-y-1">
                {[...data.drivers].sort((a, b) => b.cancelRate - a.cancelRate).map(d => (
                  <div key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50">
                    <span className="text-xs text-gray-700">{d.name}</span>
                    <span className={`text-xs font-bold ${ampel(d.cancelRate)}`}>{d.cancelRate}%</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-right">
                {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
