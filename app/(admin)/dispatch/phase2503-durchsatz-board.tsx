'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerDurchsatz {
  fahrer_id: string;
  fahrer_name: string;
  bph: number;
  bph_vorwoche: number | null;
  bestellungen_heute: number;
  stunden_aktiv: number;
  trend: string;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer: FahrerDurchsatz[];
  team_avg_bph: number;
  alert_count: number;
}

function ampelClass(bph: number) {
  if (bph >= 3) return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' };
  if (bph >= 2) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700' };
}

function DurchsatzBar({ bph }: { bph: number }) {
  const max = 5;
  const w = Math.min(100, (bph / max) * 100);
  const color = bph >= 3 ? 'bg-green-500' : bph >= 2 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '40%' }} title="Alert <2/h" />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-green-600" style={{ left: '60%' }} title="Ziel ≥3/h" />
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
    { fahrer_id: 'mock-f3', fahrer_name: 'Tim B.',   bph: 1.6, bph_vorwoche: 2.4, bestellungen_heute: 6,  stunden_aktiv: 3.8, trend: 'fallend',  trend_delta: -0.8, ampel: 'rot',   rang: 1 },
    { fahrer_id: 'mock-f2', fahrer_name: 'Sara K.',  bph: 3.8, bph_vorwoche: 3.9, bestellungen_heute: 15, stunden_aktiv: 3.9, trend: 'stabil',   trend_delta: -0.1, ampel: 'gelb',  rang: 2 },
    { fahrer_id: 'mock-f4', fahrer_name: 'Julia F.', bph: 4.5, bph_vorwoche: 4.2, bestellungen_heute: 18, stunden_aktiv: 4.0, trend: 'steigend', trend_delta: 0.3,  ampel: 'gruen', rang: 3 },
    { fahrer_id: 'mock-f1', fahrer_name: 'Max M.',   bph: 5.2, bph_vorwoche: 4.8, bestellungen_heute: 21, stunden_aktiv: 4.0, trend: 'steigend', trend_delta: 0.4,  ampel: 'gruen', rang: 4 },
  ],
  team_avg_bph: 3.8,
  alert_count: 1,
};

export function DispatchPhase2503DurchsatzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-durchsatz?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.bph - b.bph);
  const hasAlert = data.alert_count > 0;
  const teamCls = ampelClass(data.team_avg_bph);
  const alertFahrer = data.fahrer.filter(f => f.ampel === 'rot').map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={hasAlert ? 'text-red-600' : 'text-emerald-600'} />
          <span className="text-sm font-bold text-gray-800">Durchsatz-Board</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${teamCls.text} ${teamCls.bg}`}>
            Ø {data.team_avg_bph.toFixed(1)}/h
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
              { label: 'Team-Ø heute', val: `${data.team_avg_bph.toFixed(1)}/h`, col: teamCls.text },
              { label: 'Ziel', val: '≥3/h', col: 'text-green-700' },
              { label: 'Alerts (<2/h)', val: `${data.alert_count}`, col: hasAlert ? 'text-red-700' : 'text-gray-500' },
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
              Durchsatz &lt;2/h: {alertFahrer.join(', ')} — Route optimieren!
            </div>
          )}

          <div className="space-y-2">
            {sorted.map(f => {
              const cls = ampelClass(f.bph);
              return (
                <div key={f.fahrer_id} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${cls.dot}`} />
                  <span className="text-[11px] text-gray-700 w-16 truncate">{f.fahrer_name}</span>
                  <DurchsatzBar bph={f.bph} />
                  <span className={`text-[11px] font-black tabular-nums w-10 text-right ${cls.text}`}>
                    {f.bph.toFixed(1)}/h
                  </span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-[9px] text-gray-400 w-8 text-right">
                    {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)}
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {f.bestellungen_heute}×
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />≥3/h Ziel</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />2–2.9/h OK</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />&lt;2/h Alert</span>
            <span className="ml-auto">30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
