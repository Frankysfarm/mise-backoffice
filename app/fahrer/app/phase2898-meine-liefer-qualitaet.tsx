'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';

interface DriverData {
  qualitaets_index: number;
  sub_bewertung: number;
  sub_puenktlichkeit: number;
  sub_abschlussrate: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
  alert_niedrig: boolean;
  rang: number;
  team_avg: number;
}

const ZIEL = 80;
const WARN = 60;

function calcAmpel(v: number): string {
  if (v >= ZIEL) return 'gruen';
  if (v >= WARN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   bg: 'bg-red-50'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', bg: 'bg-amber-50' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', bg: 'bg-green-50' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Lieferqualität kritisch — Pünktlichkeit, Bewertungen und Abschlussrate verbessern!';
  if (ampel === 'gelb') return 'Solide Basis! Kleine Verbesserungen bei Bewertung oder Pünktlichkeit heben dich in den grünen Bereich.';
  return 'Hervorragende Lieferqualität! Du bist ein Vorzeigefahrer.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  qualitaets_index: 75, sub_bewertung: 75, sub_puenktlichkeit: 70, sub_abschlussrate: 82,
  trend: 'steigend', trend_delta: 2, alert_niedrig: false, rang: 3, team_avg: 78,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2898MeineLieferQualitaet({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefer-qualitaet?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: { fahrer?: Array<{ fahrer_id: string; qualitaets_index: number; sub_bewertung: number; sub_puenktlichkeit: number; sub_abschlussrate: number; trend: 'steigend' | 'stabil' | 'fallend'; trend_delta: number; alert_niedrig: boolean }>; team_avg?: number }) => {
          const sorted = d.fahrer ? [...d.fahrer].sort((a, b) => b.qualitaets_index - a.qualitaets_index) : [];
          const rang = sorted.findIndex(f => f.fahrer_id === driverId) + 1;
          const me = d.fahrer?.find(f => f.fahrer_id === driverId) ?? d.fahrer?.[0];
          if (me) setData({ ...me, rang: rang || 1, team_avg: d.team_avg ?? me.qualitaets_index });
          else setData(MOCK);
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;
  if (!data) return null;

  const ampel = calcAmpel(data.qualitaets_index);
  const { text, bar, bg } = ampelColors(ampel);
  const barPct  = Math.min(data.qualitaets_index, 100);
  const zielPct = ZIEL;

  const subScores = [
    { label: 'Bewertung',     val: data.sub_bewertung,     weight: '40%' },
    { label: 'Pünktlichkeit', val: data.sub_puenktlichkeit, weight: '30%' },
    { label: 'Abschluss',     val: data.sub_abschlussrate,  weight: '30%' },
  ];

  return (
    <div className={`rounded-xl border p-4 mb-4 ${data.alert_niedrig ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Award size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Meine Liefer-Qualität</span>
          {data.alert_niedrig && <AlertTriangle size={14} className="text-red-500" />}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data.alert_niedrig && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={12} />
              Niedrige Lieferqualität! ({data.qualitaets_index} Pkt / Ziel ≥{ZIEL} Pkt)
            </div>
          )}

          <div className={`rounded-xl p-4 text-center ${bg}`}>
            <div className={`text-4xl font-black ${text}`}>{data.qualitaets_index}</div>
            <div className="text-xs text-gray-500 mt-0.5">Liefer-Qualitäts-Index (0–100 Pkt)</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendIcon trend={data.trend} />
              <span className="text-xs text-gray-500">
                {Math.abs(data.trend_delta)} Pkt vs. gestern
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {subScores.map(s => {
              const sa = calcAmpel(s.val);
              const sc = ampelColors(sa);
              return (
                <div key={s.label} className={`rounded-lg p-2 text-center ${sc.bg}`}>
                  <div className="text-[10px] text-gray-500">{s.label} ({s.weight})</div>
                  <div className={`text-sm font-bold ${sc.text}`}>{s.val} Pkt</div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1">
            <div className="relative h-3 bg-gray-200 rounded-full overflow-visible">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${barPct}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-400" style={{ left: `${zielPct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0</span>
              <span className="text-indigo-500">Ziel {ZIEL} Pkt</span>
              <span>100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',   val: data.trend === 'steigend' ? '↗ besser' : data.trend === 'fallend' ? '↘ schlechter' : '→ stabil' },
              { label: 'Ziel',    val: `≥${ZIEL} Pkt` },
              { label: 'Ampel',   val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 Ok' : '🔴 Alert' },
              { label: 'Rang',    val: `#${data.rang} im Team` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 text-center">Team-Ø: {data.team_avg} Pkt</div>

          <div className={`rounded-lg p-2 text-xs ${bg} ${text} font-medium`}>
            💡 {coachingTipp(ampel)}
          </div>
        </div>
      )}
    </div>
  );
}
