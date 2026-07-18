'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Coffee } from 'lucide-react';

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
}

interface ApiData {
  fahrer_single: FahrerPause;
  team_avg_pause_min: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function ampelText(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function ampelBar(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerPause): string {
  if (f.alert_kurz) return 'Du machst kaum Pausen zwischen den Touren — plane kurze Stopps ein. Das erhöht deine Konzentration und Sicherheit.';
  if (f.alert_lang) return 'Deine Wartezeit zwischen den Touren ist sehr lang. Melde dich beim Dispatcher — vielleicht gibt es freie Touren für dich.';
  if (f.ampel === 'gruen') return 'Perfektes Pausenverhalten! Du nutzt die Zeit zwischen Touren optimal.';
  if (f.ampel === 'gelb') return 'Etwas längere Pausen als ideal. Versuche, die Wartezeit auf 5–20 Minuten zu halten.';
  return 'Pausenzeiten außerhalb des Zielbereichs. Sprich mit dem Dispatcher.';
}

function fmtMin(min: number) {
  return `${min.toFixed(1)} Min`;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-orange-500" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-green-600" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2395MeinePausenzeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-pausenzeit?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const f = data?.fahrer_single;

  return (
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'bg-indigo-50 border-indigo-200'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Coffee size={16} className={f ? ampelText(f.ampel) : 'text-indigo-600'} />
          <span className={`font-semibold text-sm ${f ? ampelText(f.ampel) : 'text-indigo-800'}`}>
            Meine Pausenzeit {f ? `— ${fmtMin(f.avg_pause_min)}` : ''}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!f ? (
            <p className="text-xs text-gray-500">Lade…</p>
          ) : (
            <>
              {/* Hero value */}
              <div className="text-center py-2">
                <div className={`text-4xl font-bold ${ampelText(f.ampel)}`}>{fmtMin(f.avg_pause_min)}</div>
                <div className="text-xs text-gray-500 mt-1">Ø Pause zwischen Touren heute</div>
              </div>

              {/* Progress bar 0–40min, marks at 5 and 20 */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${Math.min((f.avg_pause_min / 40) * 100, 100)}%` }}
                  />
                  {/* target zone markers */}
                  <div className="absolute top-0 h-full border-l-2 border-green-700 opacity-60" style={{ left: '12.5%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-700 opacity-60" style={{ left: '50%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0</span>
                  <span className="text-green-700">5 Min</span>
                  <span className="text-yellow-700">20</span>
                  <span>30</span>
                  <span className="text-red-500">40+</span>
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.pausen_anzahl}</div>
                  <div className="text-xs text-gray-500">Pausen heute</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.touren_heute}</div>
                  <div className="text-xs text-gray-500">Touren heute</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold text-gray-800">
                      {f.trend_delta > 0 ? '+' : ''}{fmtMin(f.trend_delta)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">Trend vs. VW</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{fmtMin(data!.team_avg_pause_min)}</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white/50 border border-white p-3 text-xs text-gray-700">
                💡 {coachingTipp(f)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
