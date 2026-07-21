'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  effizienz_score: number;
  effizienz_score_vw: number;
  touren_pro_stunde: number;
  puenktlichkeit_pct: number;
  bewertung_sterne: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_niedrig: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
}

const ZIEL = 80;
const WARN = 60;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
  return 'rot';
}

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
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   effizienz_score: 88, effizienz_score_vw: 83, touren_pro_stunde: 4.2, puenktlichkeit_pct: 94, bewertung_sterne: 4.7, trend: 'steigend', trend_delta: 5,   ampel: 'gruen', alert_niedrig: false, rang: 1 },
    { fahrer_id: 'd2', fahrer_name: 'Julia F.',  effizienz_score: 82, effizienz_score_vw: 80, touren_pro_stunde: 3.8, puenktlichkeit_pct: 91, bewertung_sterne: 4.5, trend: 'stabil',   trend_delta: 2,   ampel: 'gruen', alert_niedrig: false, rang: 2 },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',   effizienz_score: 71, effizienz_score_vw: 74, touren_pro_stunde: 3.1, puenktlichkeit_pct: 78, bewertung_sterne: 4.1, trend: 'fallend',  trend_delta: -3,  ampel: 'gelb',  alert_niedrig: false, rang: 3 },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',    effizienz_score: 55, effizienz_score_vw: 59, touren_pro_stunde: 2.4, puenktlichkeit_pct: 65, bewertung_sterne: 3.6, trend: 'fallend',  trend_delta: -4,  ampel: 'rot',   alert_niedrig: true,  rang: 4 },
  ],
  team_avg_score: 74,
  team_avg_score_vw: 74,
  alert_count: 1,
};

export function DispatchPhase2858EffizienzBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen]  = useState(true);
  const [data, setData]  = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-effizienz-index?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.effizienz_score) }));
  const sorted   = [...enriched].sort((a, b) => b.effizienz_score - a.effizienz_score);
  const alerts   = enriched.filter(f => f.effizienz_score < WARN);
  const hasAlert = alerts.length > 0;
  const best     = sorted[0]?.effizienz_score ?? 0;
  const teamAmpel = calcAmpel(data.team_avg_score);
  const { text: teamText } = ampelCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Effizienz-Board Fahrer</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${teamText}`}>
            Ø {data.team_avg_score} Pkt
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={12} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Effizienz zu niedrig! ({f.effizienz_score} Pkt / Ziel ≥{ZIEL})</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø', val: `${data.team_avg_score} Pkt` },
              { label: 'Bester', val: `${best} Pkt` },
              { label: 'Ziel',   val: `≥${ZIEL} Pkt` },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500">{k.label}</div>
                <div className="text-sm font-semibold text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {sorted.map(f => {
              const cls    = ampelCls(f.ampel);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2.5 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                      <span className="text-xs font-medium text-gray-800">{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendIcon trend={f.trend} />
                      <span className={`text-sm font-bold ${cls.text}`}>{f.effizienz_score} Pkt</span>
                    </div>
                  </div>
                  {/* 3 Sub-Score-Balken */}
                  <div className="space-y-1">
                    {[
                      { label: 'Touren/h', val: f.touren_pro_stunde, max: 4, unit: '/h',  pct: Math.min((f.touren_pro_stunde / 4) * 100, 100) },
                      { label: 'Pünktlich', val: f.puenktlichkeit_pct, max: 100, unit: '%', pct: f.puenktlichkeit_pct },
                      { label: 'Bewertung', val: f.bewertung_sterne, max: 5, unit: '★', pct: (f.bewertung_sterne / 5) * 100 },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{s.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-600 w-10 text-right">{s.val}{s.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥{ZIEL} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {WARN}–{ZIEL - 1} Pkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;{WARN} Pkt</span>
          </div>
        </div>
      )}
    </div>
  );
}
