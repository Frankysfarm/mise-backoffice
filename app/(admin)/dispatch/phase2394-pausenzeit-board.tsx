'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Coffee } from 'lucide-react';

interface FahrerPause {
  fahrer_id: string;
  fahrer_name: string;
  avg_pause_min: number;
  avg_pause_min_vw: number;
  pausen_anzahl: number;
  touren_heute: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
  alert_kurz: boolean;
  rang: number;
}

interface ApiData {
  fahrer: FahrerPause[];
  team_avg_pause_min: number;
  team_avg_pause_min_vw: number;
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
  if (trend === 'steigend') return <TrendingUp size={12} className="text-orange-500" />;
  if (trend === 'fallend') return <TrendingDown size={12} className="text-green-600" />;
  return <Minus size={12} className="text-gray-400" />;
}

function fmtMin(min: number) {
  return `${min.toFixed(1)} Min`;
}

export function DispatchPhase2394PausenzeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-pausenzeit?location_id=${locationId}`);
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
    <div className={`rounded-xl border mb-3 ${hasAlert ? 'border-orange-300 bg-orange-50' : 'border-indigo-200 bg-indigo-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} className={hasAlert ? 'text-orange-600' : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${hasAlert ? 'text-orange-800' : 'text-indigo-800'}`}>
            Pausenzeit-Board {data ? `— Ø ${fmtMin(data.team_avg_pause_min)}` : ''}
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
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-indigo-700">{fmtMin(data.team_avg_pause_min)}</div>
                  <div className="text-xs text-gray-500">Ø heute</div>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-gray-700">{fmtMin(data.team_avg_pause_min_vw)}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white border border-indigo-100 p-2 text-center">
                  <div className="text-lg font-bold text-green-700">5–20 Min</div>
                  <div className="text-xs text-gray-500">Zielbereich</div>
                </div>
              </div>

              {/* Alert banners */}
              {data.fahrer.filter(f => f.alert_lang).length > 0 && (
                <div className="flex items-start gap-2 bg-orange-100 border border-orange-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-800">
                    Lange Wartezeit (&gt;30 Min): {data.fahrer.filter(f => f.alert_lang).map(f => f.fahrer_name).join(', ')} — Fahrer kontaktieren oder Tour zuweisen.
                  </p>
                </div>
              )}
              {data.fahrer.filter(f => f.alert_kurz).length > 0 && (
                <div className="flex items-start gap-2 bg-red-100 border border-red-200 rounded-lg p-2">
                  <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    Keine Pause (&lt;5 Min): {data.fahrer.filter(f => f.alert_kurz).map(f => f.fahrer_name).join(', ')} — Pausen einplanen!
                  </p>
                </div>
              )}

              {/* Driver list */}
              <div className="space-y-1.5">
                {data.fahrer.map(f => (
                  <div
                    key={f.fahrer_id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ampelColor(f.ampel)}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                      <span className="text-sm font-medium truncate">{f.fahrer_name}</span>
                      {(f.alert_lang || f.alert_kurz) && <AlertTriangle size={12} className="text-orange-600" />}
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <TrendIcon trend={f.trend} />
                      <span className="font-semibold">{fmtMin(f.avg_pause_min)}</span>
                      <span className="text-gray-400">{f.pausen_anzahl}P/{f.touren_heute}T</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ampel legend */}
              <div className="relative h-3 rounded-full bg-gray-200 overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-red-400" style={{ width: '12.5%' }} />
                <div className="absolute left-[12.5%] top-0 h-full bg-green-400" style={{ width: '37.5%' }} />
                <div className="absolute left-[50%] top-0 h-full bg-yellow-400" style={{ width: '25%' }} />
                <div className="absolute left-[75%] top-0 h-full bg-red-400" style={{ width: '25%' }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span className="text-red-500">&lt;5 Min</span>
                <span className="text-green-600">5–20 Min Ziel</span>
                <span className="text-yellow-600">20–30</span>
                <span className="text-red-500">&gt;30 Min</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
