'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_verzoegerung_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_verspaetet: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  gesamt: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_verzoegerung_min:  0, rank_delta:  1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_verzoegerung_min:  2, rank_delta: -1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_verzoegerung_min:  5, rank_delta:  0, ampel: 'gelb',  alert_verspaetet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_verzoegerung_min: 12, rank_delta:  0, ampel: 'rot',   alert_verspaetet: true  },
  ],
  team_avg_min: 4.75,
  gesamt: 4,
  ziel_min: 0,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3994MeineTourstartPuenktlichkeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tourstart-puenktlichkeit?location_id=${locationId}`);
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
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <WifiOff className="w-5 h-5 text-gray-400 shrink-0" />
        <span className="text-sm text-gray-500">Offline – Tourstart-Pünktlichkeit nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const rangColor = me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangBg = me.ampel === 'gruen' ? 'bg-emerald-50 border-emerald-200' : me.ampel === 'gelb' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';
  const barColor = me.ampel === 'gruen' ? 'bg-emerald-400' : me.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';

  const rangPct = data.gesamt > 1 ? Math.round(((data.gesamt - me.rang) / (data.gesamt - 1)) * 100) : 100;

  const DeltaIcon = me.rank_delta > 0
    ? <TrendingUp className="w-4 h-4 text-emerald-500" />
    : me.rank_delta < 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  const coaching =
    me.ampel === 'gruen'
      ? 'Pünktlicher Tourstart! Du startest zuverlässig und gibst dem Team Sicherheit.'
      : me.ampel === 'gelb'
        ? 'Leichte Verzögerungen. Frühere Vorbereitung kann deinen Rang verbessern.'
        : 'Häufige Verzögerungen beim Tourstart. Früher einloggen und Route vorbereiten hilft!';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${rangBg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Mein Tourstart</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-1">
          {DeltaIcon}
        </div>
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-3">
        <div className={`text-5xl font-black ${rangColor}`}>+{me.avg_verzoegerung_min}min</div>
        <div className={`text-3xl font-bold ${rangColor} pb-0.5`}>Rang {me.rang}</div>
      </div>

      {/* Rang-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Rang {data.gesamt}</span>
          <span>Rang 1</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${rangPct}%` }} />
        </div>
      </div>

      {/* Ziel */}
      <div className="flex items-center justify-between text-xs text-gray-600 bg-white/60 rounded-lg px-2.5 py-1.5">
        <span>Ziel</span>
        <span className="font-semibold">{data.ziel_min} min Verzögerung</span>
      </div>

      {/* Team-Avg */}
      <div className="flex items-center justify-between text-xs text-gray-600 bg-white/60 rounded-lg px-2.5 py-1.5">
        <span>Team-Ø</span>
        <span className="font-semibold">+{data.team_avg_min}min</span>
      </div>

      {/* Coaching */}
      <div className="text-[11px] text-gray-600 bg-white/60 rounded-lg px-2.5 py-1.5 leading-relaxed">
        {coaching}
      </div>
    </div>
  );
}
