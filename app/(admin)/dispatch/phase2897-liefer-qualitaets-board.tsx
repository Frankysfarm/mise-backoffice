'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  qualitaets_index: number;
  sub_bewertung: number;
  sub_puenktlichkeit: number;
  sub_abschlussrate: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  alert_count: number;
}

const ZIEL = 80;
const WARN = 60;

function calcAmpel(v: number): string {
  if (v >= ZIEL) return 'gruen';
  if (v >= WARN) return 'gelb';
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
    { fahrer_id: 'd4', fahrer_name: 'Julia F.',  qualitaets_index: 93, sub_bewertung: 90, sub_puenktlichkeit: 92, sub_abschlussrate: 95, trend: 'steigend', trend_delta: 2, alert_niedrig: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',    qualitaets_index: 91, sub_bewertung: 95, sub_puenktlichkeit: 88, sub_abschlussrate: 97, trend: 'stabil',   trend_delta: 0, alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',   qualitaets_index: 75, sub_bewertung: 75, sub_puenktlichkeit: 70, sub_abschlussrate: 82, trend: 'fallend',  trend_delta: -3, alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',    qualitaets_index: 55, sub_bewertung: 50, sub_puenktlichkeit: 55, sub_abschlussrate: 60, trend: 'fallend',  trend_delta: -4, alert_niedrig: true },
  ],
  team_avg: 78,
  alert_count: 1,
};

export function DispatchPhase2897LieferQualitaetsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefer-qualitaet?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.qualitaets_index) }));
  const sorted    = [...enriched].sort((a, b) => b.qualitaets_index - a.qualitaets_index);
  const alerts    = enriched.filter(f => f.alert_niedrig);
  const hasAlert  = alerts.length > 0;
  const best      = sorted[0]?.qualitaets_index ?? 0;
  const teamAmpel = calcAmpel(data.team_avg);
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Award size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Liefer-Qualitäts-Index Fahrer</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_avg} Pkt
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Niedrige Lieferqualität! ({f.qualitaets_index} Pkt / Ziel ≥{ZIEL})</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_avg} Pkt` },
              { label: 'Bester', val: `${best} Pkt` },
              { label: 'Ziel',   val: `≥${ZIEL} Pkt` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const a      = ampelCls(f.ampel);
              const barPct = Math.min(f.qualitaets_index, 100);
              const zielPct = ZIEL;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend} />
                    </div>
                    <span className={`text-xs font-bold ${a.text}`}>{f.qualitaets_index} Pkt</span>
                  </div>
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${barPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-indigo-500">Ziel {ZIEL}</span>
                    <span>100</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-gray-500 mt-1">
                    <span>★ {f.sub_bewertung}%</span>
                    <span>⏱ {f.sub_puenktlichkeit}%</span>
                    <span>✓ {f.sub_abschlussrate}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥{ZIEL} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {WARN}–{ZIEL - 1} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{WARN} Pkt</span>
          </div>
        </div>
      )}
    </div>
  );
}
