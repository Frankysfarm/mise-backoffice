'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp, BarChart2 } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  touren: number;
  gesamt_km: number;
  einnahmen: number;
  bewertung: number;
  schichtdauer_h: number;
  trend_einnahmen: string;
  trend_delta_einnahmen: number;
  ampel: string;
  alert_schicht: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_touren: number;
  team_einnahmen: number;
  alert_count: number;
}

const EINNAHMEN_ZIEL = 100;
const EINNAHMEN_MAX  = 200;

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
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   touren: 9, gesamt_km: 54, einnahmen: 135, bewertung: 4.7, schichtdauer_h:  7.5, trend_einnahmen: 'steigend', trend_delta_einnahmen:  15, ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', touren: 8, gesamt_km: 40, einnahmen: 112, bewertung: 4.9, schichtdauer_h:  6.5, trend_einnahmen: 'steigend', trend_delta_einnahmen:   7, ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  touren: 7, gesamt_km: 42, einnahmen:  98, bewertung: 4.2, schichtdauer_h:  8.0, trend_einnahmen: 'stabil',   trend_delta_einnahmen:   3, ampel: 'gruen', alert_schicht: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   touren: 3, gesamt_km: 22, einnahmen:  45, bewertung: 3.5, schichtdauer_h: 10.5, trend_einnahmen: 'fallend',  trend_delta_einnahmen: -25, ampel: 'rot',   alert_schicht: true  },
  ],
  team_touren: 27,
  team_einnahmen: 390,
  alert_count: 1,
};

export function DispatchPhase2822SchichtBilanzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen]   = useState(true);
  const [data, setData]   = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted    = [...data.fahrer].sort((a, b) => b.einnahmen - a.einnahmen);
  const alertList = data.fahrer.filter(f => f.alert_schicht);
  const hasAlert  = alertList.length > 0;
  const teamAvgEin = data.fahrer.length > 0
    ? Math.round(data.fahrer.reduce((s, f) => s + f.einnahmen, 0) / data.fahrer.length)
    : 0;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Schicht-Bilanz Fahrer</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">
            Ø {teamAvgEin} €
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Alert-Banner */}
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alertList.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Lange Schicht ({f.schichtdauer_h} h)!</span>
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Touren',   val: `${data.team_touren}` },
              { label: 'Team-Einnahmen', val: `${data.team_einnahmen} €` },
              { label: 'Ziel/Fahrer',    val: `≥${EINNAHMEN_ZIEL} €` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map((f, i) => {
              const a       = ampelCls(f.ampel ?? (f.einnahmen >= EINNAHMEN_ZIEL ? 'gruen' : 'rot'));
              const barPct  = Math.min((f.einnahmen / EINNAHMEN_MAX) * 100, 100);
              const zielPct = (EINNAHMEN_ZIEL / EINNAHMEN_MAX) * 100;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${a.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400">#{i + 1}</span>
                      <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                      <TrendIcon trend={f.trend_einnahmen} />
                    </div>
                    <span className={`text-xs font-bold ${a.text}`}>{f.einnahmen} €</span>
                  </div>
                  {/* Balken 0–200€ mit Ziel-Linie 100€ */}
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-visible">
                    <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${barPct}%` }} />
                    <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400" style={{ left: `${zielPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>0</span>
                    <span className="text-blue-500">Ziel {EINNAHMEN_ZIEL} €</span>
                    <span>{EINNAHMEN_MAX} €</span>
                  </div>
                  {/* 5 KPI mini-grid */}
                  <div className="grid grid-cols-5 gap-1 mt-1.5">
                    {[
                      { label: 'Touren',  val: `${f.touren}` },
                      { label: 'km',      val: `${f.gesamt_km}` },
                      { label: '★',       val: `${f.bewertung}` },
                      { label: 'h',       val: `${f.schichtdauer_h}` },
                      { label: 'Δ €',     val: `${f.trend_delta_einnahmen > 0 ? '+' : ''}${f.trend_delta_einnahmen}` },
                    ].map(k => (
                      <div key={k.label} className="bg-white/70 rounded p-1 text-center">
                        <div className="text-[9px] text-gray-400">{k.label}</div>
                        <div className="text-[10px] font-semibold text-gray-700">{k.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥{EINNAHMEN_ZIEL} €</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{EINNAHMEN_ZIEL} €</span>
            <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-red-500" /> Schicht &gt;10 h</span>
          </div>
        </div>
      )}
    </div>
  );
}
