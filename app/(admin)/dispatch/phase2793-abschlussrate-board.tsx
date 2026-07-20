'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  rate_pct: number;
  abgeschlossen: number;
  gesamt: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  alert: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
}

const ZIEL_PCT = 95;
const WARN_PCT = 80;

function calcAmpel(p: number): string {
  if (p >= ZIEL_PCT) return 'gruen';
  if (p >= WARN_PCT) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Anna B.',  rate_pct: 100, abgeschlossen: 10, gesamt: 10, ampel: 'gruen', trend: 'stabil',   trend_delta:  0,   alert: false, rang: 1 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rate_pct:  97, abgeschlossen: 11, gesamt: 11, ampel: 'gruen', trend: 'steigend', trend_delta:  2,   alert: false, rang: 2 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rate_pct:  88, abgeschlossen:  7, gesamt:  8, ampel: 'gelb',  trend: 'fallend',  trend_delta: -3,   alert: false, rang: 3 },
    { fahrer_id: 'f3', fahrer_name: 'Tim W.',   rate_pct:  75, abgeschlossen:  6, gesamt:  8, ampel: 'rot',   trend: 'fallend',  trend_delta: -5,   alert: true,  rang: 4 },
  ],
  team_avg_pct: 90,
  alert_count: 1,
};

export function DispatchPhase2793AbschlussrateBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tour-abschlussrate?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.rate_pct - a.rate_pct);
  const alerts   = data.fahrer.filter(f => f.alert);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_pct);
  const best      = sorted[0]?.rate_pct ?? 0;
  const { bg: teamBg, text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800">Tour-Abschlussrate</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamBg} ${teamText}`}>
            Ø {data.team_avg_pct}%
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
                  <span>— Niedrige Abschlussrate! ({f.rate_pct}%)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',  val: `${data.team_avg_pct}%` },
              { label: 'Bester',  val: `${best}%` },
              { label: 'Ziel',    val: `≥${ZIEL_PCT}%` },
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
              const a   = ampelCls(f.ampel || calcAmpel(f.rate_pct));
              const pct = f.rate_pct;
              const zielPct = ZIEL_PCT;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.abgeschlossen}/{f.gesamt}</span>
                      <span className={`font-bold ${a.text}`}>{f.rate_pct}%</span>
                    </div>
                  </div>
                  {/* Balken 0–100% mit Ziel-Linie 95% */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Ziel-Linie */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-400"
                      style={{ left: `${zielPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0%</span>
                    <span className="text-blue-500">Ziel {ZIEL_PCT}%</span>
                    <span>100%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥95%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 80–94%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;80%</span>
          </div>
        </div>
      )}
    </div>
  );
}
