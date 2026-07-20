'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

function calcAmpel(s: number): 'gruen' | 'gelb' | 'rot' {
  if (s >= ZIEL) return 'gruen';
  if (s >= WARN) return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',   bar: 'bg-red-500',   big: 'text-red-600'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', bar: 'bg-amber-400', big: 'text-amber-600' };
  return                   { bg: 'bg-green-50 border-green-200', text: 'text-green-700', bar: 'bg-green-500', big: 'text-green-600' };
}

function coaching(score: number, alert: string | null): string {
  if (alert) return `Dein Tages-Score liegt bei ${score} Pkt — unter dem Ziel von ${ZIEL}. Fokussiere dich auf mehr Touren und Pünktlichkeit!`;
  if (score >= ZIEL) return `Stark — ${score} Pkt heute! Du bist über dem Ziel. Weiter so!`;
  return `${score} Pkt — fast am Ziel! Noch 1–2 Touren mehr und du erreichst ≥${ZIEL} Pkt.`;
}

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" title={`+${delta} Pkt`} />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   title={`${delta} Pkt`}  />;
  return                           <Minus        size={14} className="text-gray-400" />;
}

function TeilBar({ label, val, max }: { label: string; val: number; max: number }) {
  const fill = Math.min(100, (val / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 w-16 shrink-0">{label}</span>
      <div className="relative h-2 flex-1 rounded-full bg-gray-200">
        <div className="absolute top-0 left-0 h-full rounded-full bg-indigo-400" style={{ width: `${fill}%` }} />
      </div>
      <span className="text-[10px] text-gray-600 w-10 text-right font-medium">{val}/{max}</span>
    </div>
  );
}

const MOCK_ID = 'mock-me';
const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: MOCK_ID, fahrer_name: 'Ich',     score: 74, trend: 'steigend', trend_delta: 3, teilscores: { touren: 20, puenktlichkeit: 24, fehlerquote: 18, abschluss: 12 }, touren_heute: 6, ampel: 'gelb', alert: null, rang: 2 },
    { fahrer_id: 'f1',    fahrer_name: 'Max M.',   score: 88, trend: 'steigend', trend_delta: 6, teilscores: { touren: 30, puenktlichkeit: 28, fehlerquote: 18, abschluss: 12 }, touren_heute: 9, ampel: 'gruen', alert: null, rang: 1 },
    { fahrer_id: 'f4',    fahrer_name: 'Julia F.', score: 45, trend: 'fallend',  trend_delta: -5, teilscores: { touren: 10, puenktlichkeit: 10, fehlerquote:  5, abschluss: 20 }, touren_heute: 3, ampel: 'rot',  alert: 'Tagesleistung zu niedrig!', rang: 4 },
  ],
  team_avg_score: 67,
};

export function FahrerPhase2773MeinTagesPerformanceIndex({
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
    if (!isOnline || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tages-performance-index?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const me = driverId
    ? (data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0])
    : data.fahrer[0];
  if (!me) return null;

  const ampel   = calcAmpel(me.score);
  const cls     = ampelCls(ampel);
  const fill    = Math.min(100, me.score);
  const zielPct = ZIEL;

  return (
    <div className={`rounded-xl border ${cls.bg} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className={cls.text} />
          <span className="font-semibold text-sm text-gray-800">Mein Tages-Performance-Index</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-black ${cls.big}`}>{me.score} Pkt</div>
            <div className="text-xs text-gray-500 mt-0.5">Tages-Performance-Index heute</div>
          </div>

          {/* Balken */}
          <div className="relative h-4 rounded-full bg-gray-200">
            <div
              className="absolute top-0 h-full w-0.5 bg-green-600 z-10"
              style={{ left: `${zielPct}%` }}
              title={`Ziel: ≥${ZIEL} Pkt`}
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full ${cls.bar}`}
              style={{ width: `${fill}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0</span>
            <span>Ziel ≥{ZIEL} Pkt</span>
            <span>100</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Trend</div>
              <div className="flex justify-center"><TrendIcon trend={me.trend} delta={me.trend_delta} /></div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ziel</div>
              <div className="text-xs font-bold text-gray-700">≥{ZIEL}</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Ampel</div>
              <div className={`text-xs font-bold ${cls.text}`}>●</div>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 px-1 py-2">
              <div className="text-[9px] text-gray-400 mb-0.5">Team-Ø</div>
              <div className="text-xs font-bold text-gray-700">{data.team_avg_score}</div>
            </div>
          </div>

          {/* Teilscores */}
          <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 space-y-1.5">
            <div className="text-[10px] font-semibold text-gray-500 mb-1">Teilscores</div>
            <TeilBar label="Touren (30)"  val={me.teilscores.touren}         max={30} />
            <TeilBar label="Pünktl. (30)" val={me.teilscores.puenktlichkeit} max={30} />
            <TeilBar label="Fehler (20)"  val={me.teilscores.fehlerquote}    max={20} />
            <TeilBar label="Abschl. (20)" val={me.teilscores.abschluss}      max={20} />
          </div>

          {/* Coaching-Tipp */}
          <div className={`rounded-lg px-3 py-2 text-xs ${cls.text} bg-white border ${ampel === 'rot' ? 'border-red-200' : ampel === 'gelb' ? 'border-amber-200' : 'border-green-200'}`}>
            {coaching(me.score, me.alert)}
          </div>

          {/* Rang */}
          <div className="text-center text-[10px] text-gray-400">
            Rang <span className="font-bold text-gray-600">#{me.rang}</span> · {me.touren_heute} Touren heute
          </div>
        </div>
      )}
    </div>
  );
}
