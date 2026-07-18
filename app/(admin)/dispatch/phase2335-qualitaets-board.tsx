'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface DriverQualitaet {
  id: string;
  name: string;
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
  teamAvgScoreVW: number;
  alertCount: number;
  generatedAt: string;
}

interface Props { locationId: string | null; }

export function DispatchPhase2335QualitaetsBoard({ locationId }: Props) {
  const [data, setData] = useState<QualitaetData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-touren-qualitaet?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setData(d))
        .catch(() => null);
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  function ampel(score: number) {
    if (score >= 80) return 'text-green-700 bg-green-50';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  }

  function scoreBorder(score: number) {
    if (score >= 80) return 'border-green-200';
    if (score >= 60) return 'border-yellow-200';
    return 'border-red-200';
  }

  function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
    if (t === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (t === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }

  const sorted = [...(data?.drivers ?? [])].sort((a, b) => b.qualitaetScore - a.qualitaetScore);
  const alertCount = data?.alertCount ?? 0;

  return (
    <div className="rounded-xl border border-orange-200 bg-white shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-orange-50 rounded-t-xl"
      >
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-800 text-sm">Touren-Qualität (Phase 2335)</span>
          {alertCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{alertCount} Alert</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-orange-500" /> : <ChevronDown className="w-4 h-4 text-orange-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Qualitätsdaten…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className={`text-3xl font-bold ${data.teamAvgScore >= 80 ? 'text-green-700' : data.teamAvgScore >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                    {data.teamAvgScore}
                  </div>
                  <div className="text-xs text-orange-600">Team-Ø Qualität heute</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-3xl font-bold text-gray-700">{data.teamAvgScoreVW}</div>
                  <div className="text-xs text-gray-500">Vorwoche (gleicher Tag)</div>
                </div>
              </div>

              {alertCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">
                    <strong>{alertCount} Fahrer</strong> mit Qualitäts-Score &lt;60 — Coaching oder Schicht-Review empfohlen
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {sorted.map((d, i) => (
                  <div key={d.id} className={`p-3 rounded-lg border ${scoreBorder(d.qualitaetScore)} bg-white`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{d.name}</span>
                      <span className="text-xs text-gray-400">{d.touren} Tour{d.touren !== 1 ? 'en' : ''}</span>
                      <TrendIcon t={d.trend} />
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${ampel(d.qualitaetScore)}`}>
                        {d.qualitaetScore}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                      <div className="text-xs">
                        <div className="font-medium text-gray-700">{d.puenktlichkeitScore}%</div>
                        <div className="text-gray-400">Pünktl.</div>
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-700">{d.stornoScore}</div>
                        <div className="text-gray-400">Storno</div>
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-700">{d.bewertungScore}</div>
                        <div className="text-gray-400">Bewert.</div>
                      </div>
                      <div className="text-xs">
                        <div className="font-medium text-gray-700">{d.wartezeitScore}</div>
                        <div className="text-gray-400">Wartezt.</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-right">
                Stand: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
