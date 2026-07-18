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

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2332MeineStornoRate({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<StornoData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-analyse?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const me = data?.drivers.find(d => d.id === driverId) ?? null;
  const teamAvg = data?.teamAvgCancelRate ?? 0;

  function ampel(rate: number) {
    if (rate < 5) return { text: 'text-green-700', bg: 'bg-green-50', label: 'Sehr gut' };
    if (rate < 15) return { text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Im Blick behalten' };
    return { text: 'text-red-700', bg: 'bg-red-50', label: 'Aufmerksamkeit nötig' };
  }

  const a = ampel(me?.cancelRate ?? 0);

  function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
    if (t === 'up') return <TrendingUp className="w-4 h-4 text-red-500" />;
    if (t === 'down') return <TrendingDown className="w-4 h-4 text-green-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  function coaching(rate: number) {
    if (rate < 5) return 'Hervorragende Storno-Quote! Weiter so.';
    if (rate < 15) return 'Storno-Quote im gelben Bereich — bitte Probleme an Dispatch melden.';
    return 'Bitte kurz mit Dispatch sprechen — hohe Storno-Rate heute.';
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-800 text-sm">Meine Storno-Rate (Phase 2332)</span>
          {me?.alert && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">Alert</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!data || !me ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Storno-Daten…</p>
          ) : (
            <>
              <div className={`rounded-xl p-4 text-center ${a.bg}`}>
                <div className={`text-4xl font-black ${a.text}`}>{me.cancelRate}%</div>
                <div className={`text-sm font-medium mt-1 ${a.text}`}>Storno-Rate heute</div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{me.cancelledOrders}</div>
                  <div className="text-xs text-gray-500">Stornos</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{me.totalOrders}</div>
                  <div className="text-xs text-gray-500">Touren</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center flex items-center justify-center gap-1">
                  <TrendIcon t={me.trend} />
                  <div className="text-xs text-gray-500">Trend</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">7-Tage-Ø (ich)</span>
                <span className="text-sm font-bold text-gray-700">{me.cancelRate7d}%</span>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">Team-Ø heute</span>
                <span className="text-sm font-bold text-gray-700">{teamAvg}%</span>
              </div>

              <div className={`rounded-lg p-3 border ${me.alert ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-xs ${me.alert ? 'text-red-700' : 'text-blue-700'}`}>{coaching(me.cancelRate)}</p>
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
