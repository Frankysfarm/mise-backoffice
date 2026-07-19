'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEffizienz {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  effizienz_score_vw: number;
  touren_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_sterne: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEffizienz[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function scoreBarColor(s: number) {
  if (s >= 80) return 'bg-green-500';
  if (s >= 60) return 'bg-amber-400';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div className={`absolute left-0 top-0 h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${Math.min(100, score)}%` }} />
      <div className="absolute top-0 h-full border-l border-dashed border-amber-400" style={{ left: '60%' }} title="60 Alert" />
      <div className="absolute top-0 h-full border-l border-dashed border-green-500" style={{ left: '80%' }} title="80 Ziel" />
    </div>
  );
}

export function DispatchPhase2457EffizienzIndexBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-effizienz-index?location_id=${locationId}`)
        .then(r => r.json())
        .then(setData)
        .catch(console.error);
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !data) return null;

  const hasAlerts = (data.alert_count ?? 0) > 0;
  const headerColor = hasAlerts ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200';
  const headerText = hasAlerts ? 'text-red-700' : 'text-green-700';

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${headerColor}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-2 font-semibold text-sm ${headerText}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2">
          <Zap size={14} />
          Effizienz-Index-Board
          {hasAlerts && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="bg-white px-4 pb-3 pt-2 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Ø heute', val: data.team_avg_score.toFixed(1), color: data.team_avg_score >= 80 ? 'text-green-600' : data.team_avg_score >= 60 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Ø Vorwoche', val: (data.team_avg_score_vw ?? 0).toFixed(1), color: 'text-gray-600' },
              { label: 'Ziel', val: '≥80', color: 'text-green-600' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg py-1.5 px-2">
                <div className="text-xs text-gray-400">{k.label}</div>
                <div className={`font-bold text-base ${k.color}`}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Alert Banner */}
          {hasAlerts && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                <strong>Niedriger Effizienz-Index:</strong>{' '}
                {data.fahrer.filter(f => f.alert_niedrig).map(f => f.fahrer_name).join(', ')} — Index unter 60!
              </span>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border ${ampelColor(f.ampel)}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="flex-1 font-medium truncate">{f.fahrer_name}</span>
                <span className="text-gray-400 text-[10px]">{f.touren_pro_stunde.toFixed(1)}/h · {f.puenktlichkeit_pct.toFixed(0)}% · {f.bewertung_sterne.toFixed(1)}★</span>
                <ScoreBar score={f.effizienz_score} />
                <span className="w-8 text-right font-semibold">{f.effizienz_score.toFixed(0)}</span>
                <TrendIcon trend={f.trend} />
              </div>
            ))}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≥80</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />60–80</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&lt;60</span>
          </div>
        </div>
      )}
    </div>
  );
}
