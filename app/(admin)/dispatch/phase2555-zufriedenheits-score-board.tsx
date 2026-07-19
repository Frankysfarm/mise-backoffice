'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Smile } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  bewertung_avg: number;
  trinkgeld_quote_pct: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  team_avg_vw: number | null;
  alert_count: number;
}

function scoreClass(score: number) {
  if (score >= 80) return { bg: 'bg-green-50 border-green-200',  dot: 'bg-green-500',  text: 'text-green-700',  bar: 'bg-green-500'  };
  if (score >= 60) return { bg: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-400',  text: 'text-amber-700',  bar: 'bg-amber-400'  };
  return              { bg: 'bg-red-50 border-red-200',      dot: 'bg-red-500',    text: 'text-red-700',    bar: 'bg-red-500'    };
}

function ScoreBar({ score }: { score: number }) {
  const cls = scoreClass(score);
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-20">
      <div className={`absolute left-0 top-0 h-full rounded-full ${cls.bar}`} style={{ width: `${score}%` }} />
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-400"   style={{ left: '60%' }} title="Alert <60" />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500"   style={{ left: '80%' }} title="Ziel ≥80" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'steigend' | 'fallend' | 'stabil' }) {
  if (trend === 'steigend') return <TrendingUp  size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"  />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   score: 51, score_vw: 55, trend: 'fallend',  trend_delta: -4, ampel: 'rot',   alert: true,  bewertung_avg: 3.5, trinkgeld_quote_pct:  6.5 },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   score: 57, score_vw: 61, trend: 'fallend',  trend_delta: -4, ampel: 'rot',   alert: true,  bewertung_avg: 3.9, trinkgeld_quote_pct:  9.0 },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  score: 74, score_vw: 78, trend: 'fallend',  trend_delta: -4, ampel: 'gelb',  alert: false, bewertung_avg: 4.2, trinkgeld_quote_pct: 15.0 },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    score: 83, score_vw: 80, trend: 'steigend', trend_delta:  3, ampel: 'gruen', alert: false, bewertung_avg: 4.6, trinkgeld_quote_pct: 22.0 },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    score: 88, score_vw: 82, trend: 'steigend', trend_delta:  6, ampel: 'gruen', alert: false, bewertung_avg: 4.8, trinkgeld_quote_pct: 28.5 },
  ],
  team_avg: 71,
  team_avg_vw: 71,
  alert_count: 2,
};

export function DispatchPhase2555ZufriedenheitsScoreBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-zufriedenheits-score-v2?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.score - b.score);
  const hasAlert = data.alert_count > 0;
  const teamCls = scoreClass(data.team_avg);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);
  const trendDelta = data.team_avg_vw != null ? data.team_avg - data.team_avg_vw : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Smile size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Zufriedenheits-Score</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>Ø {data.team_avg}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{data.team_avg}</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-500">{data.team_avg_vw ?? '–'}</div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≥80</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Trend vs. VW */}
          {trendDelta !== null && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {trendDelta > 0
                ? <TrendingUp size={12} className="text-green-600" />
                : trendDelta < 0
                  ? <TrendingDown size={12} className="text-red-500" />
                  : <Minus size={12} className="text-gray-400" />}
              <span>{trendDelta > 0 ? '+' : ''}{trendDelta} vs. Vorwoche</span>
            </div>
          )}

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Zufriedenheit kritisch (&lt;60): {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = scoreClass(f.score);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <ScoreBar score={f.score} />
                  <span className={`text-xs font-bold w-8 text-right ${cls.text}`}>{f.score}</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-14 text-right">★{f.bewertung_avg.toFixed(1)}</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥80</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />60–79</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;60</span>
          </div>
        </div>
      )}
    </div>
  );
}
