'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Package } from 'lucide-react';

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  touren_heute: number;
  touren_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
  alert_high: boolean;
}

interface ApiData {
  fahrer_single: FahrerTour;
  team_avg_touren: number;
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

function coachingTipp(f: FahrerTour): string {
  if (f.alert_low) return 'Bisher wenige Touren heute. Melde dich beim Dispatcher — vielleicht gibt es freie Touren für dich.';
  if (f.alert_high) return 'Du hast heute sehr viele Touren gefahren! Achte auf deine Pausen und informiere den Dispatcher, falls du eine Pause brauchst.';
  if (f.ampel === 'gruen') return 'Super Tempo! Deine Touren-Anzahl liegt perfekt im Zielbereich (6–10 Touren/Schicht).';
  if (f.ampel === 'gelb') return 'Touren-Anzahl leicht außerhalb des Zielbereichs. Ziel sind 6–10 Touren pro Schicht.';
  return 'Touren-Anzahl außerhalb des Normalbereichs. Sprich mit dem Dispatcher.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'fallend') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2400MeineTourenAnzahl({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-touren-anzahl?location_id=${locationId}&driver_id=${driverId}`,
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
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'bg-blue-50 border-blue-200'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Package size={16} className={f ? ampelText(f.ampel) : 'text-blue-600'} />
          <span className={`font-semibold text-sm ${f ? ampelText(f.ampel) : 'text-blue-800'}`}>
            Meine Touren {f ? `— ${f.touren_heute} heute` : ''}
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
                <div className={`text-5xl font-bold ${ampelText(f.ampel)}`}>{f.touren_heute}</div>
                <div className="text-xs text-gray-500 mt-1">Touren heute abgeschlossen</div>
              </div>

              {/* Progress bar 0–14 tours, target zone 6–10 */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${ampelBar(f.ampel)}`}
                    style={{ width: `${Math.min((f.touren_heute / 14) * 100, 100)}%` }}
                  />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 opacity-60" style={{ left: `${(6 / 14) * 100}%` }} />
                  <div className="absolute top-0 h-full border-l-2 border-yellow-700 opacity-60" style={{ left: `${(10 / 14) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0</span>
                  <span className="text-yellow-600">4</span>
                  <span className="text-green-700">6</span>
                  <span className="text-green-700">10</span>
                  <span className="text-yellow-600">12</span>
                  <span className="text-red-500">14+</span>
                </div>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{f.touren_vw}</div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">6–10</div>
                  <div className="text-xs text-gray-500">Zielbereich</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold text-gray-800">
                      {f.trend_delta > 0 ? '+' : ''}{f.trend_delta}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">Trend vs. VW</div>
                </div>
                <div className="rounded-lg bg-white/60 border border-white p-2 text-center">
                  <div className="text-lg font-bold text-gray-800">{data!.team_avg_touren.toFixed(1)}</div>
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
