'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  rang: number;
  score: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  touren_pro_stunde: number;
  km_pro_stopp: number;
  wartezeit_min: number;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  name: 'Max Müller',
  rang: 1,
  score: 88,
  trend_delta: 5,
  ampel: 'gruen',
  touren_pro_stunde: 2.1,
  km_pro_stopp: 1.8,
  wartezeit_min: 4,
};

export function FahrerPhase3850MeinSchichtEffizienzScore({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(68);
  const [gesamt, setGesamt] = useState(3);
  const [loading, setLoading] = useState(false);

  const ziel = 70;

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_durchschnitt);
          setGesamt(d.fahrer.length);
        }
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-400">
        <Wifi className="w-4 h-4" />
        <span>Offline — Effizienz-Score nicht verfügbar</span>
      </div>
    );
  }

  const scoreColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1 ? 'text-yellow-500' : fahrer.rang <= Math.ceil(gesamt / 3) ? 'text-emerald-600' : fahrer.rang > Math.floor(gesamt * 0.75) ? 'text-red-500' : 'text-gray-700';
  const istGut = fahrer.score >= ziel;

  const coaching = fahrer.score < 50
    ? 'Dein Effizienz-Score ist niedrig. Achte auf kürzere Wartezeiten und mehr Touren pro Schicht.'
    : fahrer.score < ziel
      ? 'Guter Ansatz! Optimiere deine Routenplanung für einen besseren Score.'
      : 'Hervorragende Effizienz! Halte dieses Tempo und teile deine Tipps im Team.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-900">Mein Effizienz-Score</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥{ziel}</span>
      </div>

      {/* Score + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${scoreColor}`}>{fahrer.score}</div>
          <div className="flex items-center gap-1 mt-1">
            {fahrer.trend_delta > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : fahrer.trend_delta < 0
                ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                : <Minus className="w-3.5 h-3.5 text-gray-400" />
            }
            <span className="text-xs text-gray-500">
              {fahrer.trend_delta > 0 ? '+' : ''}{fahrer.trend_delta} Punkte
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black ${rangColor}`}>#{fahrer.rang}</div>
          <div className="text-[10px] text-gray-400">von {gesamt}</div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Score</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${ziel - fahrer.score} Punkte fehlen`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${fahrer.score}%` }}
          />
        </div>
      </div>

      {/* Detail-Metriken */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-1.5">
          <div className="text-[10px] text-gray-400">Touren/h</div>
          <div className="text-sm font-bold text-gray-800">{fahrer.touren_pro_stunde}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5">
          <div className="text-[10px] text-gray-400">km/Stopp</div>
          <div className="text-sm font-bold text-gray-800">{fahrer.km_pro_stopp}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5">
          <div className="text-[10px] text-gray-400">Wartezeit</div>
          <div className="text-sm font-bold text-gray-800">{fahrer.wartezeit_min} min</div>
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg} Punkte</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 text-[11px] text-violet-800">
        {coaching}
      </div>
    </div>
  );
}
