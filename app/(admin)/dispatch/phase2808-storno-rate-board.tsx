'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  angebotene_touren: number;
  stornierte_touren: number;
  ampel: string;
  trend: string;
  trend_delta: number;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_storno_rate_pct: number;
  alert_count: number;
}

const ZIEL_PCT = 5;
const WARN_PCT = 15;
const MAX_PCT  = 30;

function calcAmpel(pct: number): string {
  if (pct > WARN_PCT) return 'rot';
  if (pct > ZIEL_PCT) return 'gelb';
  return 'gruen';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  // steigend = schlechter (rot), fallend = besser (grün) — invertiert
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-green-600" />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    storno_rate_pct:  2.1, angebotene_touren: 48, stornierte_touren: 1, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.9, alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    storno_rate_pct:  3.2, angebotene_touren: 31, stornierte_touren: 1, ampel: 'gruen', trend: 'fallend',  trend_delta: -0.8, alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   storno_rate_pct:  8.7, angebotene_touren: 23, stornierte_touren: 2, ampel: 'gelb',  trend: 'steigend', trend_delta:  1.2, alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  storno_rate_pct: 18.5, angebotene_touren: 27, stornierte_touren: 5, ampel: 'rot',   trend: 'steigend', trend_delta:  6.5, alert: true  },
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   storno_rate_pct: 21.4, angebotene_touren: 14, stornierte_touren: 3, ampel: 'rot',   trend: 'steigend', trend_delta:  3.4, alert: true  },
  ],
  team_avg_storno_rate_pct: 10.8,
  alert_count: 2,
};

export function DispatchPhase2808StornoRateBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  // Aufsteigend (niedrigste Rate oben = beste zuerst)
  const sorted   = [...data.fahrer].sort((a, b) => a.storno_rate_pct - b.storno_rate_pct);
  const alerts   = data.fahrer.filter(f => f.alert || f.storno_rate_pct > WARN_PCT);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_storno_rate_pct);
  const best      = sorted[0]?.storno_rate_pct ?? 0;
  const { bg: teamBg, text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-orange-500" />
          <span className="font-semibold text-sm text-gray-800">Storno-Rate</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${teamBg} ${teamText}`}>
            Ø {data.team_avg_storno_rate_pct}%
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
                  <span>— Hohe Storno-Rate! ({f.storno_rate_pct}%)</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_avg_storno_rate_pct}%` },
              { label: 'Bester', val: `${best}%` },
              { label: 'Ziel',   val: `≤${ZIEL_PCT}%` },
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
              const a      = ampelCls(f.ampel || calcAmpel(f.storno_rate_pct));
              const barPct = Math.min((f.storno_rate_pct / MAX_PCT) * 100, 100);
              const zielPct = (ZIEL_PCT / MAX_PCT) * 100;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.stornierte_touren}/{f.angebotene_touren} Stornos</span>
                      <span className={`font-bold ${a.text}`}>{f.storno_rate_pct}%</span>
                    </div>
                  </div>
                  {/* Balken 0–30% mit Ziel-Linie 5% */}
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
                    <span>0%</span>
                    <span className="text-blue-500">Ziel ≤{ZIEL_PCT}%</span>
                    <span>{MAX_PCT}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ampel-Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≤{ZIEL_PCT}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ZIEL_PCT}–{WARN_PCT}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &gt;{WARN_PCT}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
