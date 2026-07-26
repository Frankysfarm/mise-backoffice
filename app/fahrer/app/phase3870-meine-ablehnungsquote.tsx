'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  ablehnungsquote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_ablehnungsquote_pct: number;
  alert_count: number;
  ziel_pct: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  fahrer_name: 'Julia F.',
  rang: 1,
  ablehnungsquote_pct: 0.5,
  rank_delta: -0.2,
  ampel: 'gruen',
};

export function FahrerPhase3870MeineAblehnungsquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(4.9);
  const [ziel, setZiel] = useState(3);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-ablehnungsquote?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_avg_ablehnungsquote_pct);
          setZiel(d.ziel_pct);
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
        <span>Offline — Ablehnungsquote nicht verfügbar</span>
      </div>
    );
  }

  const valColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1 ? 'text-yellow-500' : fahrer.rang <= Math.ceil(gesamt / 4) ? 'text-emerald-600' : fahrer.rang > Math.floor(gesamt * 0.75) ? 'text-red-500' : 'text-gray-700';
  const istGut = fahrer.ablehnungsquote_pct <= ziel;

  const coaching = fahrer.ablehnungsquote_pct > 8
    ? 'Deine Ablehnungsquote ist sehr hoch. Prüfe die Ursachen und sprich mit deinem Dispatcher.'
    : fahrer.ablehnungsquote_pct > ziel
      ? 'Die Quote kann reduziert werden. Akzeptiere Touren zügig und informiere bei Problemen früh.'
      : 'Sehr niedrige Ablehnungsquote! Du bist sehr zuverlässig.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Ablehnungsquote</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{ziel}%</span>
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${valColor}`}>{fahrer.ablehnungsquote_pct}%</div>
          <div className="text-xs text-gray-400 mt-0.5">Ablehnungen</div>
          <div className="flex items-center gap-1 mt-1">
            {fahrer.rank_delta < 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : fahrer.rank_delta > 0
                ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                : <Minus className="w-3.5 h-3.5 text-gray-400" />
            }
            <span className="text-xs text-gray-500">
              {fahrer.rank_delta > 0 ? '+' : ''}{fahrer.rank_delta}%
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
          <span>Ablehnungsquote</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${(fahrer.ablehnungsquote_pct - ziel).toFixed(1)}% über Ziel`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, (fahrer.ablehnungsquote_pct / Math.max(fahrer.ablehnungsquote_pct, ziel)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg}%</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-[11px] text-orange-800">
        {coaching}
      </div>
    </div>
  );
}
