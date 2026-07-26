'use client';

import { useState, useEffect, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
  alert_count: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  fahrer_name: 'Julia F.',
  rang: 1,
  umsatz_pro_stunde: 42,
  rank_delta: 1,
  ampel: 'gruen',
};

export function FahrerPhase3885MeinUmsatzProStunde({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(35.8);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const ziel = 30;

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_avg_umsatz);
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
        <span>Offline — Umsatz/Stunde nicht verfügbar</span>
      </div>
    );
  }

  const valColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1 ? 'text-yellow-500' : fahrer.rang <= Math.ceil(gesamt / 4) ? 'text-emerald-600' : fahrer.rang > Math.floor(gesamt * 0.75) ? 'text-red-500' : 'text-gray-700';
  const istGut = fahrer.umsatz_pro_stunde >= ziel;

  const coaching = fahrer.umsatz_pro_stunde < 20
    ? 'Dein Umsatz/h ist sehr niedrig. Akzeptiere mehr Touren und optimiere deine Route.'
    : fahrer.umsatz_pro_stunde < ziel
      ? 'Du bist unter dem Ziel. Halte kurze Pausenzeiten und priorisiere nahe Stopps.'
      : 'Toller Umsatz pro Stunde! Bleib effizient und halte dein Tempo.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Euro className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-gray-900">Mein Umsatz/Stunde</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥{ziel}€/h</span>
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${valColor}`}>{fahrer.umsatz_pro_stunde}</div>
          <div className="text-sm font-semibold text-gray-500 mt-0.5">€ / Stunde</div>
          <div className="flex items-center gap-1 mt-1">
            {fahrer.rank_delta > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : fahrer.rank_delta < 0
                ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                : <Minus className="w-3.5 h-3.5 text-gray-400" />
            }
            <span className="text-xs text-gray-500">
              {fahrer.rank_delta > 0 ? '+' : ''}{fahrer.rank_delta} Rang
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
          <span>Umsatz/h</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${(ziel - fahrer.umsatz_pro_stunde).toFixed(0)}€ unter Ziel`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, (fahrer.umsatz_pro_stunde / Math.max(ziel * 1.5, fahrer.umsatz_pro_stunde)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg}€/h</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 text-[11px] text-teal-800">
        {coaching}
      </div>
    </div>
  );
}
