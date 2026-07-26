'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reklamations_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
  ziel_pct: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  fahrer_name: 'Julia F.',
  rang: 1,
  reklamations_pct: 1,
  rank_delta: -1,
  ampel: 'gruen',
  alert_hoch: false,
};

export function FahrerPhase3885MeineReklamationsquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(6);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const ziel = 3;

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reklamations-quote?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_avg_pct);
          setGesamt(d.gesamt ?? d.fahrer.length);
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
        <span>Offline — Reklamationsquote nicht verfügbar</span>
      </div>
    );
  }

  const valColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1
    ? 'text-yellow-500'
    : fahrer.rang <= Math.ceil(gesamt / 4)
      ? 'text-emerald-600'
      : fahrer.rang > Math.floor(gesamt * 0.75)
        ? 'text-red-500'
        : 'text-gray-700';
  const istGut = fahrer.reklamations_pct <= ziel;

  const coaching = fahrer.reklamations_pct > 10
    ? 'Deine Reklamationsquote ist sehr hoch. Überprüfe Verpackung und Liefersorgfalt, und kommuniziere offen mit Kunden.'
    : fahrer.reklamations_pct > ziel
      ? 'Die Reklamationsquote kann verbessert werden. Achte auf korrekte Übergabe und sorgsamen Umgang mit Bestellungen.'
      : 'Ausgezeichnete Qualität! Du hast kaum Reklamationen und hältst die Kundenzufriedenheit hoch.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Reklamationsquote</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{ziel}%</span>
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${valColor}`}>{fahrer.reklamations_pct}%</div>
          <div className="text-xs text-gray-400 mt-0.5">Reklamationen</div>
          <div className="flex items-center gap-1 mt-1">
            {fahrer.rank_delta < 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : fahrer.rank_delta > 0
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
          <span>Reklamationsquote</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${(fahrer.reklamations_pct - ziel).toFixed(1)}% über Ziel`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, fahrer.reklamations_pct * 5)}%` }}
          />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg}%</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[11px] text-red-800">
        {coaching}
      </div>
    </div>
  );
}
