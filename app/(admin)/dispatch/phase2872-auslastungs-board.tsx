'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface FahrerEntry {
  id: string;
  name: string;
  rate_pct: number;
  rate_pct_vw: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  alert_typ: 'under' | 'over' | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
}

const ZIEL_MIN = 60;
const ZIEL_MAX = 85;
const ALERT_UNDER = 40;
const ALERT_OVER = 90;

function calcAmpel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= ZIEL_MIN && pct <= ZIEL_MAX) return 'gruen';
  if ((pct >= ALERT_UNDER && pct < ZIEL_MIN) || (pct > ZIEL_MAX && pct <= ALERT_OVER)) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500"   />;
  return                       <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { id: 'd1', name: 'Anna K.',  rate_pct: 78, rate_pct_vw: 72, touren: 12, trend: 'up',      ampel: 'gruen', alert: false, alert_typ: null    },
    { id: 'd2', name: 'Ben T.',   rate_pct: 92, rate_pct_vw: 85, touren: 15, trend: 'up',      ampel: 'rot',   alert: true,  alert_typ: 'over'  },
    { id: 'd3', name: 'Chris M.', rate_pct: 35, rate_pct_vw: 42, touren:  6, trend: 'down',    ampel: 'rot',   alert: true,  alert_typ: 'under' },
    { id: 'd4', name: 'Diana P.', rate_pct: 65, rate_pct_vw: 68, touren: 11, trend: 'neutral', ampel: 'gruen', alert: false, alert_typ: null    },
    { id: 'd5', name: 'Enzo R.',  rate_pct: 52, rate_pct_vw: 48, touren:  9, trend: 'up',      ampel: 'gelb',  alert: false, alert_typ: null    },
  ],
  team_avg_pct: 64,
  alert_count: 2,
};

export function DispatchPhase2872AuslastungsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.rate_pct) }));
  const sorted   = [...enriched].sort((a, b) => b.rate_pct - a.rate_pct);
  const alerts   = enriched.filter(f => f.alert);
  const hasAlert = alerts.length > 0;
  const best     = sorted[0]?.rate_pct ?? 0;
  const teamAmpel = calcAmpel(data.team_avg_pct);
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800">Auslastung Fahrer</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_avg_pct}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.name}</span>
                  <span>
                    — {f.alert_typ === 'under' ? `Niedrige Auslastung! (${f.rate_pct}% / Ziel ≥${ZIEL_MIN}%)` : `Überlastung! (${f.rate_pct}% / Max ${ALERT_OVER}%)`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_avg_pct}%` },
              { label: 'Bester', val: `${best}%` },
              { label: 'Ziel',   val: `${ZIEL_MIN}–${ZIEL_MAX}%` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const a = ampelCls(f.ampel);
              const barPct  = Math.min(f.rate_pct, 100);
              const zielMinPct = ZIEL_MIN;
              const zielMaxPct = ZIEL_MAX;
              return (
                <div key={f.id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{f.touren} Touren</span>
                      <span className={`font-bold ${a.text}`}>{f.rate_pct}%</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div
                      className={`h-full rounded-full ${a.bar}`}
                      style={{ width: `${barPct}%` }}
                    />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielMinPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-300" style={{ left: `${zielMaxPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0%</span>
                    <span className="text-indigo-500">Ziel {ZIEL_MIN}–{ZIEL_MAX}%</span>
                    <span>100%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {ZIEL_MIN}–{ZIEL_MAX}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {ALERT_UNDER}–{ZIEL_MIN - 1}% / {ZIEL_MAX + 1}–{ALERT_OVER}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{ALERT_UNDER}% / &gt;{ALERT_OVER}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
