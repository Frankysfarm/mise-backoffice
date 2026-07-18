'use client';
import { useEffect, useState } from 'react';
import { Star, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface DriverQualitaet {
  id: string;
  name: string;
  qualitaetScore: number;
  alert: boolean;
}

interface QualitaetData {
  drivers: DriverQualitaet[];
  teamAvgScore: number;
  alertCount: number;
  generatedAt: string;
}

interface Props { locationId?: string | null; }

export function KitchenPhase2338QualitaetsTicker({ locationId }: Props) {
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

  const hasAlert = (data?.alertCount ?? 0) > 0;
  const headerColor = hasAlert ? 'bg-red-50' : 'bg-orange-50';
  const iconColor = hasAlert ? 'text-red-500' : 'text-orange-500';
  const titleColor = hasAlert ? 'text-red-800' : 'text-orange-800';
  const borderColor = hasAlert ? 'border-red-200' : 'border-orange-200';

  function ampel(score: number) {
    if (score >= 80) return 'text-green-700 bg-green-100';
    if (score >= 60) return 'text-yellow-700 bg-yellow-100';
    return 'text-red-700 bg-red-100';
  }

  const sorted = [...(data?.drivers ?? [])].sort((a, b) => b.qualitaetScore - a.qualitaetScore);

  return (
    <div className={`rounded-xl border ${borderColor} bg-white shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${headerColor} rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <Star className={`w-4 h-4 ${iconColor}`} />
          <span className={`font-semibold ${titleColor} text-sm`}>Qualitäts-Ticker (Phase 2338)</span>
          {hasAlert && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{data?.alertCount} Alert</span>
          )}
        </div>
        {open
          ? <ChevronUp className={`w-4 h-4 ${iconColor}`} />
          : <ChevronDown className={`w-4 h-4 ${iconColor}`} />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-400 text-center py-4">Lade Qualitätsdaten…</p>
          ) : (
            <>
              <div className="text-center">
                <div className={`text-3xl font-black ${data.teamAvgScore >= 80 ? 'text-green-700' : data.teamAvgScore >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                  {data.teamAvgScore}
                </div>
                <div className="text-xs text-gray-500">Team-Ø Qualitäts-Score</div>
              </div>

              {hasAlert && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-700">
                    <strong>{data.alertCount} Fahrer</strong> unter Score 60 — Küchenprozesse prüfen
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                {sorted.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100">
                    {d.alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="flex-1 text-xs font-medium text-gray-700 truncate">{d.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ampel(d.qualitaetScore)}`}>
                      {d.qualitaetScore}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-right">
                {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 30 Min
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
