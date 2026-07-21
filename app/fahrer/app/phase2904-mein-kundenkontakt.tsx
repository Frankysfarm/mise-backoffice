'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react';

interface DriverData {
  kundenkontakt_score: number;
  sub_trinkgeld: number;
  sub_wiederbestellung: number;
  sub_beschwerden: number;
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
  if (ampel === 'rot')  return 'Kundenkontakt verbessern — mehr Lächeln, pünktlich liefern und Beschwerden vermeiden!';
  if (ampel === 'gelb') return 'Gut! Kleine Extras wie Freundlichkeit können deinen Score weiter steigern.';
  return 'Toller Kundenkontakt! Kunden lieben dich — keep it up!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  kundenkontakt_score: 73, sub_trinkgeld: 70, sub_wiederbestellung: 72, sub_beschwerden: 80,
  trend: 'steigend', trend_delta: 3, alert_niedrig: false, rang: 3, team_avg: 75,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2904MeinKundenkontakt({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenkontakt?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: { fahrer?: Array<{ fahrer_id: string; kundenkontakt_score: number; sub_trinkgeld: number; sub_wiederbestellung: number; sub_beschwerden: number; trend: 'steigend' | 'stabil' | 'fallend'; trend_delta: number; alert_niedrig: boolean }>; team_avg?: number }) => {
          const sorted = d.fahrer ? [...d.fahrer].sort((a, b) => b.kundenkontakt_score - a.kundenkontakt_score) : [];
          const rang = sorted.findIndex(f => f.fahrer_id === driverId) + 1;
          const me = d.fahrer?.find(f => f.fahrer_id === driverId) ?? d.fahrer?.[0];
          if (me) setData({ ...me, rang: rang || 1, team_avg: d.team_avg ?? me.kundenkontakt_score });
          else setData(MOCK);
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;
  if (!data) return null;

  const ampel = calcAmpel(data.kundenkontakt_score);
  const { text, bar, bg } = ampelColors(ampel);
  const barPct = Math.min(data.kundenkontakt_score, 100);

  const subScores = [
    { label: 'Trinkgeld',      val: data.sub_trinkgeld,       weight: '35%' },
    { label: 'Wiederbestellung', val: data.sub_wiederbestellung, weight: '40%' },
    { label: 'Beschwerden',    val: data.sub_beschwerden,     weight: '25%' },
  ];

  return (
    <div className={`rounded-xl border p-4 mb-4 ${data.alert_niedrig ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-pink-500" />
          <span className="font-semibold text-sm text-gray-800">Mein Kundenkontakt</span>
          {data.alert_niedrig && <AlertTriangle size={14} className="text-red-500" />}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data.alert_niedrig && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={12} />
              Niedriger Kundenkontakt-Score! ({data.kundenkontakt_score} Pkt / Ziel ≥{ZIEL} Pkt)
            </div>
          )}

          <div className={`rounded-xl p-4 text-center ${bg}`}>
            <div className={`text-4xl font-black ${text}`}>{data.kundenkontakt_score}</div>
            <div className="text-xs text-gray-500 mt-0.5">Kundenkontakt-Score (0–100 Pkt)</div>
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
              <div className="absolute top-0 bottom-0 w-0.5 bg-pink-400" style={{ left: `${ZIEL}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0</span>
              <span className="text-pink-500">Ziel {ZIEL} Pkt</span>
              <span>100</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Trend',  val: data.trend === 'steigend' ? '↗ besser' : data.trend === 'fallend' ? '↘ schlechter' : '→ stabil' },
              { label: 'Ziel',   val: `≥${ZIEL} Pkt` },
              { label: 'Ampel',  val: ampel === 'gruen' ? '🟢 Gut' : ampel === 'gelb' ? '🟡 Ok' : '🔴 Alert' },
              { label: 'Rang',   val: `#${data.rang} im Team` },
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
