'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerTrend {
  fahrer_id: string;
  name: string;
  aktuell_pct: number;
  trend: Trend;
  abweichung_pct: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrend[];
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max M.',  aktuell_pct: 93, trend: 'steigend', abweichung_pct:  13.4, alert: false },
    { fahrer_id: 'f2', name: 'Sara K.', aktuell_pct: 60, trend: 'fallend',  abweichung_pct: -31.8, alert: true  },
    { fahrer_id: 'f3', name: 'Luca P.', aktuell_pct: 75, trend: 'stabil',   abweichung_pct:   0.0, alert: false },
  ],
  alert_count: 1,
};

function ampel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= 90) return 'gruen';
  if (pct >= 70) return 'gelb';
  return 'rot';
}

export function FahrerPhase3940MeinePuenktlichkeitTrend({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 text-gray-400">
        <WifiOff className="w-5 h-5 shrink-0" />
        <span className="text-sm">Pünktlichkeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  const sorted = [...data.fahrer].sort((a, b) => b.aktuell_pct - a.aktuell_pct);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  const rang = sorted.indexOf(me) + 1;
  const gesamt = sorted.length;
  const a = ampel(me?.aktuell_pct ?? 0);

  const tColor = a === 'gruen' ? 'text-gray-700' : a === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = me?.trend === 'steigend'
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me?.trend === 'fallend'
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coachMsg = a === 'gruen'
    ? 'Exzellente Pünktlichkeit – weiter so!'
    : a === 'gelb'
      ? 'Routenplanung verbessern für mehr Pünktlichkeit.'
      : 'Dringende Maßnahmen für bessere Pünktlichkeit nötig.';
  const coachColor = a === 'gruen' ? 'bg-gray-50 text-gray-600' : a === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Meine Pünktlichkeit</h3>
        {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex flex-col items-center py-2 gap-1">
        <span className={`text-5xl font-black ${tColor}`}>{me?.aktuell_pct ?? 0}<span className="text-xl font-bold ml-1">%</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold text-gray-400">Rang {rang}</span>
          <span className="text-xl text-gray-300">/ {gesamt}</span>
          {DeltaIcon}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥90% pünktlich</span>
      </div>

      {/* Coaching */}
      <div className={`rounded-lg px-3 py-2 text-xs ${coachColor}`}>
        {coachMsg}
      </div>

      {/* Mini-Liste */}
      <div className="space-y-0.5">
        {sorted.map((f, i) => {
          const isMe = f.fahrer_id === driverId;
          const fa = ampel(f.aktuell_pct);
          const fColor = fa === 'gruen' ? 'text-gray-700' : fa === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          return (
            <div
              key={f.fahrer_id}
              className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${isMe ? 'bg-gray-100 font-semibold' : ''}`}
            >
              <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{f.name}</span>
              <span className={`font-bold ${fColor}`}>{f.aktuell_pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
