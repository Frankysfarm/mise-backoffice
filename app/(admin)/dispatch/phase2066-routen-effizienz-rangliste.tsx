'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, AlertTriangle, Lightbulb } from 'lucide-react';

interface FahrerRoutenEffizienz {
  driver_id: string;
  name: string;
  km_gesamt: number;
  touren_count: number;
  avg_km_pro_bestellung: number;
  effizienz_score: number;
  alert: boolean;
}

interface RoutenEffizienzData {
  fahrer: FahrerRoutenEffizienz[];
  team_avg_km: number;
  alert_count: number;
}

const MOCK: RoutenEffizienzData = {
  fahrer: [
    { driver_id: 'd2', name: 'Sarah K.', km_gesamt: 31, touren_count: 8, avg_km_pro_bestellung: 3.9, effizienz_score: 91, alert: false },
    { driver_id: 'd1', name: 'Max M.', km_gesamt: 42, touren_count: 7, avg_km_pro_bestellung: 6.0, effizienz_score: 82, alert: false },
    { driver_id: 'd4', name: 'Anna L.', km_gesamt: 38, touren_count: 6, avg_km_pro_bestellung: 6.3, effizienz_score: 79, alert: false },
    { driver_id: 'd3', name: 'Tom B.', km_gesamt: 67, touren_count: 5, avg_km_pro_bestellung: 13.4, effizienz_score: 54, alert: true },
  ],
  team_avg_km: 7.4,
  alert_count: 1,
};

const POLL_MS = 30 * 60 * 1000;
const KM_ALERT = 8;

function barColor(avg: number) {
  if (avg <= 5) return 'bg-green-500';
  if (avg <= 8) return 'bg-amber-400';
  return 'bg-red-500';
}

function barWidth(avg: number, max = 15) {
  return Math.min((avg / max) * 100, 100);
}

export function DispatchPhase2066RoutenEffizienzRangliste({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<RoutenEffizienzData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-routen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: RoutenEffizienzData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const alertFahrer = d.fahrer.filter(f => f.alert);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Route className="w-4 h-4 text-green-400" />
          Routen-Effizienz-Rangliste
          <span className="text-xs text-gray-400 font-normal">Ø km/Bestellung heute</span>
          {d.alert_count > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-red-950 text-red-300">
              <AlertTriangle className="w-3 h-3" />
              {d.alert_count} Alert
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className="text-lg font-black tabular-nums text-green-300">{d.team_avg_km} km</div>
              <div className="text-[10px] text-gray-400">Team-Ø km/Bestellung</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
              <div className={cn('text-lg font-black tabular-nums', d.alert_count > 0 ? 'text-red-400' : 'text-green-400')}>
                {d.alert_count}
              </div>
              <div className="text-[10px] text-gray-400">Fahrer &gt;{KM_ALERT} km/Auftrag</div>
            </div>
          </div>

          {/* Alert banner */}
          {alertFahrer.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/60 border border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div className="text-xs text-red-300">
                <strong>{alertFahrer.map(f => f.name).join(', ')}</strong> — hohe km/Bestellung.
              </div>
            </div>
          )}

          {/* Fahrer list */}
          <div className="space-y-2">
            {d.fahrer.map((f, i) => (
              <div key={f.driver_id} className="rounded-lg bg-gray-800/60 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500 font-bold w-4">#{i + 1}</span>
                    <span className="text-xs font-semibold text-gray-100">{f.name}</span>
                    {f.alert && (
                      <span className="px-1 py-0.5 rounded text-[9px] bg-red-900 text-red-300 font-bold flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Zone prüfen
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      f.avg_km_pro_bestellung > KM_ALERT ? 'text-red-400' : f.avg_km_pro_bestellung > 5 ? 'text-amber-400' : 'text-green-400',
                    )}>
                      {f.avg_km_pro_bestellung} km/Auftrag
                    </span>
                    <span className="text-[10px] text-gray-500">{f.km_gesamt} km gesamt</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barColor(f.avg_km_pro_bestellung))}
                    style={{ width: `${barWidth(f.avg_km_pro_bestellung)}%` }}
                  />
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {f.touren_count} Tour{f.touren_count !== 1 ? 'en' : ''} · Effizienz-Score {f.effizienz_score}
                </div>
              </div>
            ))}
          </div>

          {/* Zone-Optimieren Tipp */}
          {alertFahrer.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-950/40 border border-blue-900/50 px-3 py-2">
              <Lightbulb className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-200">
                Fahrer mit hohem Ø km/Auftrag in eine nähere Zone verlegen oder mit Bestellungen aus Zone A priorisieren.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
