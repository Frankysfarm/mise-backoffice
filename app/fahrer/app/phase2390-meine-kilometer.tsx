'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

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
  fahrer_single: FahrerKilometer;
  team_km_gesamt: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-orange-50 border-orange-200 text-orange-800';
}

function ampelRing(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-orange-600';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-orange-500';
}

function coachingTipp(f: FahrerKilometer): string {
  if (f.alert) return 'Über 150 km heute — bitte dem Dispatcher Bescheid geben. Pause einplanen und ggf. Route optimieren.';
  if (f.ampel === 'gruen' && f.trend === 'up') return 'Sehr effiziente Routen! Weniger als 100 km — top Kilometerstand.';
  if (f.ampel === 'gruen') return 'Guter Kilometerstand — Routen sind effizient. Weiter so!';
  if (f.ampel === 'gelb') return 'Kilometerstand im mittleren Bereich — versuche unter 100 km zu bleiben.';
  return 'Hoher Kilometerstand — Route überprüfen oder Dispatcher kontaktieren.';
}

function fmtKm(km: number) {
  return `${km.toFixed(1)} km`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-orange-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2390MeineKilometer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-kilometer?location_id=${locationId}&driver_id=${driverId}`
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;
  // Bar shows 0–200 km range
  const barPct = f ? Math.min(Math.round((f.km_gesamt / 200) * 100), 100) : 0;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route size={16} className={f ? ampelRing(f.ampel) : 'text-blue-600'} />
          <span className="font-semibold text-sm">
            Meine Kilometer {f ? `— ${fmtKm(f.km_gesamt)}` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Main value */}
              <div className="text-center py-2">
                <div className={`text-4xl font-bold ${ampelRing(f.ampel)}`}>{fmtKm(f.km_gesamt)}</div>
                <div className="text-xs text-gray-500 mt-1">gefahren heute</div>
              </div>

              {/* Progress bar 0–200 km with goal lines at 100 and 150 */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 border-dashed opacity-70" style={{ left: '50%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-600 border-dashed opacity-70" style={{ left: '75%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0</span>
                  <span className="text-green-600">100 km Ziel</span>
                  <span className="text-yellow-600">150 km</span>
                  <span>200+</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{fmtKm(f.km_pro_tour)}</div>
                  <div className="text-xs text-gray-500">Ø km/Tour</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.touren}</div>
                  <div className="text-xs text-gray-500">Touren</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold">{fmtKm(f.km_gesamt_vw)}</span>
                  </div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{fmtKm(data?.team_km_gesamt ?? 0)}</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white bg-opacity-70 border px-3 py-2">
                <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
