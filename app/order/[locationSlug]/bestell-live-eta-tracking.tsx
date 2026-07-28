'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, Package, CheckCircle, Bike, ChefHat, AlertCircle } from 'lucide-react';

export type EtaStatus = 'angenommen' | 'zubereitung' | 'abholbereit' | 'unterwegs' | 'geliefert';

interface EtaData {
  status: EtaStatus;
  eta_min: number | null;
  eta_updated_at: string | null;
  fahrer_name: string | null;
  fahrer_eta_min: number | null;
  prep_start_iso: string | null;
  ziel_prep_min: number;
  verzoegerung: boolean;
}

const MOCK: EtaData = {
  status: 'unterwegs',
  eta_min: 12,
  eta_updated_at: new Date().toISOString(),
  fahrer_name: 'Thomas K.',
  fahrer_eta_min: 12,
  prep_start_iso: new Date(Date.now() - 14 * 60000).toISOString(),
  ziel_prep_min: 15,
  verzoegerung: false,
};

const PHASEN: { key: EtaStatus; icon: React.ReactNode; label: string }[] = [
  { key: 'angenommen',  icon: <Package className="h-4 w-4" />,    label: 'Angenommen' },
  { key: 'zubereitung', icon: <ChefHat className="h-4 w-4" />,    label: 'Zubereitung' },
  { key: 'abholbereit', icon: <CheckCircle className="h-4 w-4" />, label: 'Abholbereit' },
  { key: 'unterwegs',   icon: <Bike className="h-4 w-4" />,        label: 'Unterwegs' },
  { key: 'geliefert',   icon: <MapPin className="h-4 w-4" />,      label: 'Geliefert' },
];

const STATUS_IDX: Record<EtaStatus, number> = {
  angenommen:  0,
  zubereitung: 1,
  abholbereit: 2,
  unterwegs:   3,
  geliefert:   4,
};

function PrepCountdown({ startIso, zielMin }: { startIso: string; zielMin: number }) {
  const [remSec, setRemSec] = useState(() => {
    const elapsed = (Date.now() - new Date(startIso).getTime()) / 1000;
    return Math.max(0, zielMin * 60 - elapsed);
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const elapsed = (Date.now() - new Date(startIso).getTime()) / 1000;
      setRemSec(Math.max(0, zielMin * 60 - elapsed));
    }, 1000);
    return () => clearInterval(iv);
  }, [startIso, zielMin]);

  const m = Math.floor(remSec / 60);
  const s = Math.floor(remSec % 60);
  const pct = Math.max(0, Math.min(100, 100 - (remSec / (zielMin * 60)) * 100));

  return (
    <div className="text-center space-y-1">
      <div className="text-2xl font-bold font-mono tabular-nums text-gray-800">
        {m}:{String(s).padStart(2, '0')}
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 transition-all duration-1000 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">noch {m} min Zubereitungszeit</p>
    </div>
  );
}

interface Props {
  orderId: string;
  locationId?: string;
}

export function BestellLiveEtaTracking({ orderId, locationId }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`, { cache: 'no-store' });
      if (res.ok) {
        const j = await res.json();
        if (j.status) setData(j);
      }
    } catch { /* Mock-Fallback */ }
  }, [orderId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const activeIdx = STATUS_IDX[data.status] ?? 0;
  const isDone = data.status === 'geliefert';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-4 py-3 ${isDone ? 'bg-emerald-600' : data.verzoegerung ? 'bg-orange-500' : 'bg-indigo-600'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">Live-Tracking</span>
          </div>
          {data.eta_min !== null && !isDone && (
            <div className="text-right">
              <div className="text-xl font-bold text-white">{data.eta_min} min</div>
              <div className="text-xs text-white/80">geschätzte Lieferzeit</div>
            </div>
          )}
          {isDone && (
            <span className="text-sm font-semibold text-white">✓ Geliefert!</span>
          )}
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {PHASEN.map((p, i) => {
            const isActive  = i === activeIdx;
            const isDonePh  = i < activeIdx;
            const isFuture  = i > activeIdx;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
                {/* Verbindungslinie links */}
                {i > 0 && (
                  <div className="absolute" />
                )}
                <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md scale-110' : isDonePh ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {isDonePh ? <CheckCircle className="h-4 w-4" /> : p.icon}
                </div>
                <span className={`text-[10px] text-center font-medium leading-tight ${isActive ? 'text-indigo-700 font-semibold' : isDonePh ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {p.label}
                </span>
                {/* Verbindungslinie */}
                {i < PHASEN.length - 1 && (
                  <div className={`absolute mt-4 ml-8 h-0.5 w-full max-w-[calc(100%/5)] ${isDonePh ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Zubereitungs-Countdown */}
      {data.status === 'zubereitung' && data.prep_start_iso && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">⏱ Zubereitungszeit</p>
          <PrepCountdown startIso={data.prep_start_iso} zielMin={data.ziel_prep_min} />
        </div>
      )}

      {/* Fahrer-Info */}
      {data.status === 'unterwegs' && data.fahrer_name && (
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bike className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">{data.fahrer_name}</p>
              <p className="text-xs text-gray-400">Dein Fahrer</p>
            </div>
          </div>
          {data.fahrer_eta_min !== null && (
            <div className="text-right">
              <p className="text-lg font-bold text-indigo-700">{data.fahrer_eta_min} min</p>
              <p className="text-xs text-gray-400">bis zur Lieferung</p>
            </div>
          )}
        </div>
      )}

      {/* Verzögerungs-Hinweis */}
      {data.verzoegerung && !isDone && (
        <div className="border-t border-orange-200 bg-orange-50 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-700">Es gibt eine leichte Verzögerung. Wir arbeiten daran!</p>
        </div>
      )}

      {/* Erfolgs-Footer */}
      {isDone && (
        <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-700">Guten Appetit! 🎉</p>
          <p className="text-xs text-emerald-600 mt-0.5">Wir freuen uns auf deine Bewertung.</p>
        </div>
      )}
    </div>
  );
}
