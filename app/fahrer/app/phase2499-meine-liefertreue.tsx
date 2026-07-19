'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, ShieldCheck } from 'lucide-react';

interface FahrerLiefertreue {
  fahrer_id: string;
  fahrer_name: string;
  liefertreue_heute: number;
  liefertreue_vw: number;
  puenktlich_heute: number;
  gesamt_heute: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerLiefertreue[];
  team_avg_liefertreue: number;
  team_avg_liefertreue_vw: number;
  alert_count: number;
}

function ampelStyle(pct: number) {
  if (pct >= 95) return { bg: 'bg-green-50 border-green-200', text: 'text-green-700', val: 'text-green-600' };
  if (pct >= 85) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', val: 'text-amber-600' };
  return { bg: 'bg-red-50 border-red-200', text: 'text-red-700', val: 'text-red-600' };
}

function LiefertreueBar({ pct }: { pct: number }) {
  const w = Math.min(100, pct);
  const color = pct >= 95 ? 'bg-green-500' : pct >= 85 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-3 rounded-full bg-gray-200 w-full">
      <div className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-amber-500" style={{ left: '85%' }} title="Alert: 85%" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '95%' }} title="Ziel: 95%" />
    </div>
  );
}

function coachingTipp(pct: number, puenktlich: number, gesamt: number): string {
  if (pct >= 95) return `${pct}% Liefertreue — ausgezeichnet! ${puenktlich} von ${gesamt} Lieferungen pünktlich. Weiter so!`;
  if (pct >= 85) return `${pct}% Liefertreue — fast am Ziel! Noch ${Math.ceil(gesamt * 0.95) - puenktlich} Lieferungen pünktlicher für 95%. Tempo halten!`;
  return `${pct}% Liefertreue — unter dem Ziel von 85%! Route prüfen, Stoppzeiten reduzieren und Dispatcher informieren.`;
}

const MOCK: ApiData = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', liefertreue_heute: 95, liefertreue_vw: 92, puenktlich_heute: 19, gesamt_heute: 20, trend: 'steigend', trend_delta: 3, ampel: 'gruen', alert: false }],
  team_avg_liefertreue: 90.8,
  team_avg_liefertreue_vw: 90.0,
  alert_count: 0,
};

export function FahrerPhase2499MeineLiefertreue({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefertreue-heute?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId ? data.fahrer.find(f => f.fahrer_id === driverId) : data.fahrer[0];
  if (!me) return null;

  const style = ampelStyle(me.liefertreue_heute);
  const tipp = coachingTipp(me.liefertreue_heute, me.puenktlich_heute, me.gesamt_heute);

  return (
    <div className={`rounded-xl border ${style.bg} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className={style.text} />
          <span className="text-sm font-bold text-gray-800">Meine Liefertreue</span>
          <span className={`text-sm font-black tabular-nums ${style.val}`}>
            {me.liefertreue_heute}%
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="flex items-end gap-3">
            <div className={`text-4xl font-black tabular-nums ${style.val}`}>
              {me.liefertreue_heute}%
            </div>
            <div className="pb-1">
              <div className="text-xs font-bold text-gray-500">Liefertreue heute</div>
              <div className="flex items-center gap-1 text-[10px] text-gray-400">
                {me.trend === 'steigend' ? <TrendingUp size={11} className="text-green-600" /> :
                 me.trend === 'fallend'  ? <TrendingDown size={11} className="text-red-500" /> :
                 <Minus size={11} className="text-gray-400" />}
                {me.trend_delta !== 0 ? `${me.trend_delta > 0 ? '+' : ''}${me.trend_delta}% vs. VW` : 'Stabil vs. VW'}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <LiefertreueBar pct={me.liefertreue_heute} />
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
              <span>0%</span>
              <span className="text-amber-500">85% Alert</span>
              <span className="text-green-600">95% Ziel</span>
              <span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'VW', val: `${me.liefertreue_vw}%` },
              { label: 'Team-Ø', val: `${data.team_avg_liefertreue.toFixed(0)}%` },
              { label: 'Pünktlich', val: `${me.puenktlich_heute}` },
              { label: 'Gesamt', val: `${me.gesamt_heute}` },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-white/60 px-2 py-1.5 text-center border border-white/80">
                <div className="text-sm font-black text-gray-700">{k.val}</div>
                <div className="text-[9px] text-gray-500">{k.label}</div>
              </div>
            ))}
          </div>

          <div className={`rounded-lg px-3 py-2 text-[10px] font-medium ${style.bg} ${style.text} border`}>
            {tipp}
          </div>

          <div className="text-[8px] text-gray-400">30-Min-Polling · Ziel: ≥95% Liefertreue</div>
        </div>
      )}
    </div>
  );
}
