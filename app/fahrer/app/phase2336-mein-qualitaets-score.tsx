'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react';

interface DriverQualitaet {
  id: string;
  qualitaetScore: number;
  qualitaetScoreVW: number;
  trend: 'up' | 'down' | 'neutral';
  alert: boolean;
  puenktlichkeitScore: number;
  stornoScore: number;
  bewertungScore: number;
  wartezeitScore: number;
  touren: number;
}

interface QualitaetData {
  drivers: DriverQualitaet[];
  teamAvgScore: number;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2336MeinQualitaetsScore({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<QualitaetData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId || !isOnline) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-qualitaet?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline) return null;

  const me = data?.drivers.find(d => d.id === driverId) ?? data?.drivers[0] ?? null;
  const teamAvg = data?.teamAvgScore ?? null;

  function scoreColor(score: number) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  function scoreBg(score: number) {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  }

  function coachingTipp(score: number): string {
    if (score >= 80) return 'Exzellente Arbeit! Deine Qualität ist top — weiter so!';
    if (score >= 60) return 'Solide Leistung. Fokus auf Pünktlichkeit und Abholzeit verbessert deinen Score.';
    return 'Score unter 60 — bitte sprich mit deinem Teamleiter für gezieltes Coaching.';
  }

  function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
    if (t === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (t === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-800 text-sm">Mein Qualitäts-Score (Phase 2336)</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!me ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Qualitätsdaten…</p>
          ) : (
            <>
              <div className={`rounded-xl border p-4 text-center ${scoreBg(me.qualitaetScore)}`}>
                <div className={`text-5xl font-black ${scoreColor(me.qualitaetScore)}`}>
                  {me.qualitaetScore}
                </div>
                <div className="text-xs text-gray-500 mt-1">Qualitäts-Score heute</div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <TrendIcon t={me.trend} />
                  <span className="text-xs text-gray-500">
                    {me.qualitaetScoreVW} letzte Woche
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{me.puenktlichkeitScore}%</div>
                  <div className="text-xs text-gray-500">Pünktlichkeit</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{me.stornoScore}</div>
                  <div className="text-xs text-gray-500">Storno-Score</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{me.bewertungScore}</div>
                  <div className="text-xs text-gray-500">Kundenbewertung</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">{me.wartezeitScore}</div>
                  <div className="text-xs text-gray-500">Wartezeit-Score</div>
                </div>
              </div>

              {teamAvg !== null && (
                <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-blue-600">Team-Ø</span>
                  <span className="text-sm font-bold text-blue-700">{teamAvg}</span>
                  <span className="text-xs text-blue-500">
                    {me.qualitaetScore >= teamAvg ? `+${me.qualitaetScore - teamAvg} über Ø` : `${me.qualitaetScore - teamAvg} unter Ø`}
                  </span>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-800">{coachingTipp(me.qualitaetScore)}</p>
              </div>

              <p className="text-xs text-gray-400 text-right">{me.touren} Touren heute · alle 30 Min</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
