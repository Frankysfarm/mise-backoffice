'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface FahrerAuslastung {
  id: string;
  name: string;
  rate_pct: number;
  rate_pct_vw: number;
  fahrzeit_min: number;
  schichtdauer_min: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  alert_typ: 'under' | 'over' | null;
}

interface ApiData {
  fahrer: FahrerAuslastung[];
  team_avg_pct: number;
  team_avg_pct_vw: number;
  alert_count: number;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-700 bg-green-50 border-green-200';
  if (a === 'gelb') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={12} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

function rebalancingTipp(fahrer: FahrerAuslastung[]): string | null {
  const over = fahrer.filter(f => f.alert_typ === 'over');
  const under = fahrer.filter(f => f.alert_typ === 'under');
  if (over.length > 0 && under.length > 0) {
    return `${over.map(f => f.name).join(', ')} überlastet — Touren auf ${under.map(f => f.name).join(', ')} umverteilen.`;
  }
  if (over.length > 0) return `${over.map(f => f.name).join(', ')} überlastet (>90%) — Pausen einplanen oder Touren abgeben.`;
  if (under.length > 0) return `${under.map(f => f.name).join(', ')} unterausgelastet (<40%) — mehr Touren zuweisen.`;
  return null;
}

export function DispatchPhase2374AuslastungsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-auslastung?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;
  const tipp = data ? rebalancingTipp(data.fahrer) : null;

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-blue-200 bg-blue-50'} mb-3`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className={hasAlert ? 'text-orange-600' : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-blue-800'}`}>
            Fahrer-Auslastung {data ? `— Ø ${data.team_avg_pct}%` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-orange-200 text-orange-800 rounded-full px-2 py-0.5">
              {data!.alert_count} Alert{data!.alert_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{data.team_avg_pct}%</div>
                  <div className="text-xs text-gray-500">Ø Auslastung heute</div>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{data.team_avg_pct_vw}%</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">60–85%</div>
                  <div className="text-xs text-gray-500">Zielbereich</div>
                </div>
              </div>

              {/* Rebalancing tip */}
              {tipp && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">{tipp}</p>
                </div>
              )}

              {/* Fahrer list */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                      <span className="text-sm font-medium truncate">{f.name}</span>
                      {f.alert && (
                        <AlertTriangle size={12} className={f.alert_typ === 'over' ? 'text-red-600' : 'text-orange-500'} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <TrendIcon trend={f.trend} />
                      <span className="font-semibold">{f.rate_pct}%</span>
                      <span className="text-gray-400">{f.touren}T</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar legend */}
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-red-400" style={{ width: '40%' }} />
                <div className="absolute left-[40%] top-0 h-full bg-yellow-400" style={{ width: '20%' }} />
                <div className="absolute left-[60%] top-0 h-full bg-green-400" style={{ width: '25%' }} />
                <div className="absolute left-[85%] top-0 h-full bg-yellow-400" style={{ width: '5%' }} />
                <div className="absolute left-[90%] top-0 h-full bg-red-400" style={{ width: '10%' }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>40%</span>
                <span>60%</span>
                <span>85%</span>
                <span>90%</span>
                <span>100%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
