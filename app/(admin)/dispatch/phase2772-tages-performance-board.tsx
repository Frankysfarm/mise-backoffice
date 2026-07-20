'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface Teilscores {
  touren: number;
  puenktlichkeit: number;
  fehlerquote: number;
  abschluss: number;
}

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  teilscores: Teilscores;
  touren_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_score: number;
}

const ZIEL = 80;
const WARN = 60;

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function calcAmpel(s: number): 'gruen' | 'gelb' | 'rot' {
  if (s >= ZIEL) return 'gruen';
  if (s >= WARN) return 'gelb';
  return 'rot';
}

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" title={`+${delta} Pkt`} />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   title={`${delta} Pkt`}  />;
  return                           <Minus        size={12} className="text-gray-400" />;
}

function ScoreBalken({ score, barClass }: { score: number; barClass: string }) {
  const fill    = Math.min(100, score);
  const zielPct = ZIEL;
  return (
    <div className="relative h-3 rounded-full bg-gray-200 flex-1">
      <div
        className="absolute top-0 h-full w-0.5 bg-green-500 z-10"
        style={{ left: `${zielPct}%` }}
        title={`Ziel: ≥${ZIEL} Pkt`}
      />
      <div
        className={`absolute top-0 left-0 h-full rounded-full ${barClass}`}
        style={{ width: `${fill}%` }}
      />
    </div>
  );
}

function TeilscoreBar({ label, val, max }: { label: string; val: number; max: number }) {
  const fill = Math.min(100, (val / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-gray-400 w-12 shrink-0">{label}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-gray-200">
        <div className="absolute top-0 left-0 h-full rounded-full bg-indigo-400" style={{ width: `${fill}%` }} />
      </div>
      <span className="text-[9px] text-gray-500 w-6 text-right">{val}</span>
    </div>
  );
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   score: 88, trend: 'steigend', trend_delta:  6, teilscores: { touren: 30, puenktlichkeit: 28, fehlerquote: 18, abschluss: 12 }, touren_heute: 9, ampel: 'gruen', alert: null,                        rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  score: 74, trend: 'fallend',  trend_delta: -2, teilscores: { touren: 20, puenktlichkeit: 24, fehlerquote: 18, abschluss: 12 }, touren_heute: 6, ampel: 'gelb',  alert: null,                        rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   score: 61, trend: 'fallend',  trend_delta: -2, teilscores: { touren: 10, puenktlichkeit: 20, fehlerquote: 18, abschluss: 13 }, touren_heute: 4, ampel: 'gelb',  alert: null,                        rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', score: 45, trend: 'fallend',  trend_delta: -5, teilscores: { touren: 10, puenktlichkeit: 10, fehlerquote:  5, abschluss: 20 }, touren_heute: 3, ampel: 'rot',   alert: 'Tagesleistung zu niedrig!', rang: 4 },
  ],
  team_avg_score: 67,
};

export function DispatchPhase2772TagesPerformanceBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tages-performance-index?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.score - a.score);
  const alerts   = data.fahrer.filter(f => f.alert !== null);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_score);
  const best     = sorted[0]?.score ?? 0;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={hasAlert ? 'text-red-500' : 'text-indigo-600'} />
          <span className="font-semibold text-sm text-gray-800">Tages-Performance-Index</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-xs text-red-700 font-medium">
              <AlertTriangle size={13} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.score} Pkt)
            </div>
          ))}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {(() => { const c = ampelCls(teamAmpel); return (
              <div className={`rounded-lg border ${c.bg} px-2 py-2`}>
                <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
                <div className={`text-base font-bold ${c.text}`}>{data.team_avg_score} Pkt</div>
              </div>
            ); })()}
            <div className="rounded-lg bg-green-50 border border-green-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
              <div className="text-base font-bold text-green-700">{best} Pkt</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-2 py-2">
              <div className="text-[10px] text-gray-500 mb-0.5">Ziel</div>
              <div className="text-base font-bold text-gray-700">≥{ZIEL} Pkt</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {sorted.map(f => {
              const a   = calcAmpel(f.score);
              const cls = ampelCls(a);
              const isExpanded = expanded === f.fahrer_id;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border ${cls.bg} px-3 py-2`}>
                  <button
                    className="w-full text-left"
                    onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                        <span className="text-xs font-semibold text-gray-800">{f.fahrer_name}</span>
                        <span className="text-[10px] text-gray-400">#{f.rang} · {f.touren_heute} Touren</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendIcon trend={f.trend} delta={f.trend_delta} />
                        <span className={`text-sm font-bold ${cls.text}`}>{f.score} Pkt</span>
                      </div>
                    </div>
                    <ScoreBalken score={f.score} barClass={cls.bar} />
                  </button>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      <TeilscoreBar label="Touren"   val={f.teilscores.touren}        max={30} />
                      <TeilscoreBar label="Pünktl."  val={f.teilscores.puenktlichkeit} max={30} />
                      <TeilscoreBar label="Fehler"   val={f.teilscores.fehlerquote}    max={20} />
                      <TeilscoreBar label="Abschl."  val={f.teilscores.abschluss}      max={20} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥{ZIEL} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />{WARN}–{ZIEL-1} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&lt;{WARN} Pkt</span>
            <span className="ml-auto text-gray-400">Tippen für Teilscores</span>
          </div>
        </div>
      )}
    </div>
  );
}
