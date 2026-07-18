'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerAbbruchquote {
  id: string;
  name: string;
  quote_pct: number;
  quote_pct_vw: number;
  abbrueche: number;
  touren: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerAbbruchquote[];
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

function fmtPct(pct: number) {
  return `${pct.toFixed(1)}%`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function DispatchPhase2384AbbruchquotenBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-abbruchquote?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const hasAlert = (data?.alert_count ?? 0) > 0;

  return (
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-rose-200 bg-rose-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <XCircle size={16} className={hasAlert ? 'text-red-600' : 'text-rose-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-red-800' : 'text-rose-800'}`}>
            Abbruchquote {data ? `— Ø ${fmtPct(data.team_avg_pct)}` : ''}
          </span>
          {hasAlert && (
            <span className="text-xs bg-red-200 text-red-800 rounded-full px-2 py-0.5">
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
                <div className="rounded-lg bg-white border border-rose-100 p-2 text-center">
                  <div className="text-lg font-bold text-rose-700">{fmtPct(data.team_avg_pct)}</div>
                  <div className="text-xs text-gray-500">Ø Abbruchquote</div>
                </div>
                <div className="rounded-lg bg-white border border-rose-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{fmtPct(data.team_avg_pct_vw)}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-rose-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">&lt;5%</div>
                  <div className="text-xs text-gray-500">Ziel</div>
                </div>
              </div>

              {/* Alert banner */}
              {hasAlert && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    {data.fahrer.filter(f => f.alert).map(f => f.name).join(', ')} — Abbruchquote &gt;10%. Ursache klären.
                  </p>
                </div>
              )}

              {/* Podium Top-3 (lowest abort rate = best) */}
              {data.fahrer.length >= 3 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {data.fahrer.slice(0, 3).map((f, i) => (
                    <div key={f.id} className="rounded-lg bg-white border border-rose-100 p-2 text-center">
                      <div className="text-base">{MEDALS[i]}</div>
                      <div className="text-xs font-semibold text-gray-700 truncate">{f.name}</div>
                      <div className="text-sm font-bold text-rose-700">{fmtPct(f.quote_pct)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Driver list */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                      <span className="text-sm font-medium truncate">{f.name}</span>
                      {f.alert && <AlertTriangle size={12} className="text-red-600" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <TrendIcon trend={f.trend} />
                      <span className="font-semibold">{fmtPct(f.quote_pct)}</span>
                      <span className="text-gray-400">{f.abbrueche}/{f.touren}T</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ampel legend */}
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-green-400" style={{ width: '33%' }} />
                <div className="absolute left-[33%] top-0 h-full bg-yellow-400" style={{ width: '34%' }} />
                <div className="absolute left-[67%] top-0 h-full bg-red-400" style={{ width: '33%' }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span className="text-green-600">0–5% Ziel</span>
                <span className="text-yellow-600">5–10%</span>
                <span className="text-red-500">&gt;10% Alert</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
