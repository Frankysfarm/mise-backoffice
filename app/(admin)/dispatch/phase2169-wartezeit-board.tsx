'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle, Phone } from 'lucide-react';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
  trend_7tage: number;
};

type ApiResponse = {
  drivers: FahrerWartezeit[];
  team_avg_wartezeit: number;
  location_id: string | null;
  mock?: boolean;
};

function ampel(avg: number): { color: string; label: string } {
  if (avg <= 3) return { color: 'text-green-600', label: 'Gut' };
  if (avg <= 8) return { color: 'text-yellow-600', label: 'Mäßig' };
  return { color: 'text-red-600', label: 'Kritisch' };
}

export function DispatchPhase2169WartezeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => null);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.drivers].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const alertFahrer = data.drivers.filter((d) => d.avg_wartezeit_min > 8);
  const { color: teamColor } = ampel(data.team_avg_wartezeit);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Wartezeit-Board</span>
          {data.mock && <span className="text-[10px] text-gray-400 ml-1">Demo</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamColor}`}>
            Team-Ø {data.team_avg_wartezeit.toFixed(1)} Min.
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {alertFahrer.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-xs text-red-700">
                <span className="font-semibold">{alertFahrer.length} Fahrer</span> warten &gt;8 Min. beim Restaurant — Kontakt aufnehmen!
              </div>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((f) => {
              const { color, label } = ampel(f.avg_wartezeit_min);
              const pct = Math.min(100, (f.avg_wartezeit_min / 10) * 100);
              const barColor = f.avg_wartezeit_min <= 3 ? 'bg-green-500' : f.avg_wartezeit_min <= 8 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={f.fahrer_id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{f.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${color}`}>{label}</span>
                      <span className={`text-sm font-bold ${color}`}>{f.avg_wartezeit_min.toFixed(1)} Min.</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                    <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500">
                    <span>{f.auftraege_gesamt} Aufträge heute</span>
                    {f.auftraege_ueber5min > 0 && (
                      <span className="text-orange-500">{f.auftraege_ueber5min}× &gt;5 Min.</span>
                    )}
                    {f.auftraege_ueber5min === 0 && (
                      <span className="text-green-500 flex items-center gap-0.5">
                        <CheckCircle className="h-3 w-3" /> Keine Langwarter
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              Restaurant kontaktieren: Abholbereitschaft klären, Vorbereitungszeit optimieren.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
