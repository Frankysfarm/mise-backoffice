'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Navigation } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_km_lieferung: number;
  total_km: number;
  lieferungen: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_km: number;
  alert_count: number;
}

const ZIEL_KM = 4;
const WARN_KM = 6;
const MAX_KM  = 10;

function calcAmpel(km: number): string {
  if (km <= ZIEL_KM) return 'gruen';
  if (km <= WARN_KM) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend, invert }: { trend: string; invert?: boolean }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className={invert ? 'text-red-500'   : 'text-green-600'} />;
  if (trend === 'fallend')  return <TrendingDown size={12} className={invert ? 'text-green-600' : 'text-red-500'  } />;
  return                           <Minus        size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Anna B.',  avg_km_lieferung: 2.8, total_km: 28.0, lieferungen: 10, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.3, alert: false, rang: 1 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_km_lieferung: 3.2, total_km: 35.2, lieferungen: 11, ampel: 'gruen', trend: 'stabil',   trend_delta:  0.0, alert: false, rang: 2 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_km_lieferung: 5.1, total_km: 40.8, lieferungen:  8, ampel: 'gelb',  trend: 'steigend', trend_delta:  0.3, alert: false, rang: 3 },
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   avg_km_lieferung: 7.3, total_km: 58.4, lieferungen:  8, ampel: 'rot',   trend: 'steigend', trend_delta:  0.4, alert: true,  rang: 4 },
  ],
  team_avg_km: 4.6,
  alert_count: 1,
};

export function DispatchPhase2798KilometerEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kilometer-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  // Aufsteigend (niedrigste km/Lieferung zuerst = effizienteste oben)
  const sorted   = [...data.fahrer].sort((a, b) => a.avg_km_lieferung - b.avg_km_lieferung);
  const alerts   = data.fahrer.filter(f => f.alert || f.avg_km_lieferung > WARN_KM);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_km);
  const best      = sorted[0]?.avg_km_lieferung ?? 0;
  const { bg: teamBg, text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Kilometer-Effizienz</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamBg} ${teamText}`}>
            Ø {data.team_avg_km} km
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert-Banner */}
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Hohe Kilometerleistung! ({f.avg_km_lieferung} km/Lief.)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_avg_km} km` },
              { label: 'Bester', val: `${best} km` },
              { label: 'Ziel',   val: `≤${ZIEL_KM} km` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel || calcAmpel(f.avg_km_lieferung));
              const barPct = Math.min((f.avg_km_lieferung / MAX_KM) * 100, 100);
              const zielPct = (ZIEL_KM / MAX_KM) * 100;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      {/* steigend = schlechter, fallend = besser → invertiert */}
                      <TrendIcon trend={f.trend} invert />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.lieferungen} Lief.</span>
                      <span className={`font-bold ${a.text}`}>{f.avg_km_lieferung} km</span>
                    </div>
                  </div>
                  {/* Balken 0–10 km mit Ziel-Linie 4 km */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${barPct}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0 km</span>
                    <span className="text-blue-500">Ziel {ZIEL_KM} km</span>
                    <span>{MAX_KM} km</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≤{ZIEL_KM} km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ZIEL_KM}–{WARN_KM} km</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &gt;{WARN_KM} km</span>
          </div>
        </div>
      )}
    </div>
  );
}
