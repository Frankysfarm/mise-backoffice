'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, ShieldCheck } from 'lucide-react';

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
  rang: number;
}

interface ApiData {
  fahrer: FahrerLiefertreue[];
  team_avg_liefertreue: number;
  team_avg_liefertreue_vw: number;
  alert_count: number;
}

function ampelClass(pct: number) {
  if (pct >= 95) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (pct >= 85) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function LiefertreueBar({ pct }: { pct: number }) {
  const max = 100;
  const w = Math.min(100, pct);
  const color = pct >= 95 ? 'bg-green-500' : pct >= 85 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '85%' }} title="Alert 85%" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '95%' }} title="Ziel 95%" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  liefertreue_heute: 80,  liefertreue_vw: 88,  puenktlich_heute: 16, gesamt_heute: 20, trend: 'fallend',  trend_delta: -8,  ampel: 'rot',   alert: true,  rang: 1 },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   liefertreue_heute: 90,  liefertreue_vw: 85,  puenktlich_heute: 18, gesamt_heute: 20, trend: 'steigend', trend_delta: 5,   ampel: 'gelb',  alert: false, rang: 2 },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', liefertreue_heute: 95,  liefertreue_vw: 92,  puenktlich_heute: 19, gesamt_heute: 20, trend: 'steigend', trend_delta: 3,   ampel: 'gruen', alert: false, rang: 3 },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   liefertreue_heute: 98,  liefertreue_vw: 95,  puenktlich_heute: 49, gesamt_heute: 50, trend: 'steigend', trend_delta: 3,   ampel: 'gruen', alert: false, rang: 4 },
  ],
  team_avg_liefertreue: 90.8,
  team_avg_liefertreue_vw: 90.0,
  alert_count: 1,
};

export function DispatchPhase2498LiefertreueBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefertreue-heute?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.liefertreue_heute - b.liefertreue_heute);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_liefertreue);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className={hasAlert ? 'text-red-600' : 'text-emerald-600'} />
          <span className="text-sm font-bold text-gray-800">Liefertreue Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {data.team_avg_liefertreue.toFixed(0)}%
          </span>
          {hasAlert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              <AlertTriangle size={10} /> {data.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø heute', val: `${data.team_avg_liefertreue.toFixed(0)}%`, col: teamCls.text },
              { label: 'Ziel', val: '≥95%', col: 'text-green-700' },
              { label: 'Alerts (<85%)', val: `${data.alert_count}`, col: hasAlert ? 'text-red-700' : 'text-gray-500' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-gray-50 px-2 py-2 text-center">
                <div className={`text-base font-black ${k.col}`}>{k.val}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {alertFahrer.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
              <AlertTriangle size={14} className="shrink-0" />
              Liefertreue &lt;85%: {alertFahrer.join(', ')} — Routen prüfen!
            </div>
          )}

          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.liefertreue_heute);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-[11px] text-gray-700 w-16 truncate">{f.fahrer_name}</span>
                  <LiefertreueBar pct={f.liefertreue_heute} />
                  <span className={`text-[11px] font-black tabular-nums w-9 text-right ${cls.text}`}>
                    {f.liefertreue_heute}%
                  </span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-[9px] text-gray-400 w-8 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}%
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {f.puenktlich_heute}/{f.gesamt_heute}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />≥95% Ziel</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />85–94% OK</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />&lt;85% Alert</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
