'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerKilometer {
  id: string;
  name: string;
  km_gesamt: number;
  km_gesamt_vw: number;
  km_pro_tour: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerKilometer[];
  team_km_gesamt: number;
  team_km_gesamt_vw: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function fmtKm(km: number) {
  return `${km.toFixed(1)} km`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function DispatchPhase2389KilometerBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kilometer?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={hasAlert ? 'text-orange-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-blue-800'}`}>
            Kilometer-Board {data ? `— Ø ${fmtKm(data.team_km_gesamt)}` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} Alert{data!.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{fmtKm(data.team_km_gesamt)}</div>
                  <div className="text-xs text-gray-500">Ø km heute</div>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{fmtKm(data.team_km_gesamt_vw)}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">&lt;100 km</div>
                  <div className="text-xs text-gray-500">Ziel</div>
                </div>
              </div>

              {/* Alert banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    {data.fahrer.filter(f => f.alert).map(f => f.name).join(', ')} — über 150 km. Entlastung empfohlen.
                  </p>
                </div>
              )}

              {/* Podium Top-3 (lowest km = most efficient) */}
              {data.fahrer.length >= 3 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {data.fahrer.slice(0, 3).map((f, i) => (
                    <div key={f.id} className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                      <div className="text-base">{MEDALS[i]}</div>
                      <div className="text-xs font-semibold text-gray-700 truncate">{f.name}</div>
                      <div className="text-sm font-bold text-blue-700">{fmtKm(f.km_gesamt)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Driver list */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                      <span className="text-sm font-medium truncate">{f.name}</span>
                      {f.alert && <AlertTriangle size={12} className="text-orange-600" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <TrendIcon trend={f.trend} />
                      <span className="font-semibold">{fmtKm(f.km_gesamt)}</span>
                      <span className="text-gray-400">{f.km_pro_tour.toFixed(1)} km/T</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ampel legend */}
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: '33%' }} />
                <div className="absolute left-[33%] top-0 h-full bg-yellow-400" style={{ width: '34%' }} />
                <div className="absolute left-[67%] top-0 h-full bg-red-400" style={{ width: '33%' }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span className="text-green-600">&lt;100 km Ziel</span>
                <span className="text-yellow-600">100–150 km</span>
                <span className="text-red-500">&gt;150 km Alert</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
