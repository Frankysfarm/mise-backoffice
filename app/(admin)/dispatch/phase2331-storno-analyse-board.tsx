'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface DriverStorno {
  id: string;
  name: string;
  totalOrders: number;
  cancelledOrders: number;
  cancelRate: number;
  cancelRate7d: number;
  trend: 'up' | 'down' | 'neutral';
  alert: boolean;
}

interface StornoData {
  location_id: string;
  drivers: DriverStorno[];
  teamAvgCancelRate: number;
  teamAvg7d: number;
  generiert_am: string;
}

interface Props { locationId: string | null; }

export function DispatchPhase2331StornoAnalyseBoard({ locationId }: Props) {
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

  const alertCount = data?.drivers.filter(d => d.cancelRate > 15).length ?? 0;

  function ampel(rate: number) {
    if (rate < 5) return 'text-green-600 bg-green-50';
    if (rate < 15) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }

  function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
    if (t === 'up') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (t === 'down') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  const sorted = [...(data?.drivers ?? [])].sort((a, b) => b.cancelRate - a.cancelRate);

  return (
    <div className="rounded-xl border border-orange-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-800 text-sm">Storno-Analyse (Phase 2331)</span>
          {alertCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{alertCount} Alert</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Storno-Daten…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">{data.teamAvgCancelRate}%</div>
                  <div className="text-xs text-orange-600">Team Storno heute</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700">{data.teamAvg7d}%</div>
                  <div className="text-xs text-gray-500">7-Tage-Ø</div>
                </div>
              </div>

              {alertCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">
                    <strong>{alertCount} Fahrer</strong> mit Storno-Rate &gt;15% — Teamgespräch empfohlen
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {sorted.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{d.name}</span>
                    <span className="text-xs text-gray-400">{d.totalOrders} Tour{d.totalOrders !== 1 ? 'en' : ''}</span>
                    <TrendIcon t={d.trend} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ampel(d.cancelRate)}`}>
                      {d.cancelRate}%
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-right">
                Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
