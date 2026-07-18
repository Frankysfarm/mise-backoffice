'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

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
  fahrer_single: FahrerAuslastung;
  team_avg_pct: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-yellow-50 border-yellow-200 text-yellow-800';
  return 'bg-red-50 border-red-200 text-red-700';
}

function ampelRing(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-yellow-600';
  return 'text-red-600';
}

function coachingTipp(f: FahrerAuslastung): string {
  if (f.alert_typ === 'over') return 'Du bist sehr stark ausgelastet — melde dich beim Dispatcher, Pause einplanen!';
  if (f.alert_typ === 'under') return 'Wenig Auslastung heute — beim Dispatcher melden für mehr Touren.';
  if (f.ampel === 'gruen' && f.trend === 'up') return 'Top! Deine Auslastung steigt — im grünen Bereich und auf Kurs.';
  if (f.ampel === 'gruen') return 'Im optimalen Bereich! Weiter so — gleichmäßige Auslastung schont und bringt Ertrag.';
  if (f.ampel === 'gelb') return 'Auslastung im Mittelfeld — schaue ob mehr Touren möglich sind.';
  return 'Auslastung prüfen — beim Dispatcher nach Touren fragen.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-500" />;
  return <Minus size={14} className="text-gray-400" />;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2375MeineAuslastung({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-auslastung?location_id=${locationId}&driver_id=${driverId}`
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
    <div className={`rounded-xl border mb-3 ${f ? ampelBg(f.ampel) : 'border-blue-200 bg-blue-50'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Activity size={16} className={f ? ampelRing(f.ampel) : 'text-blue-600'} />
          <span className="font-semibold text-sm">
            Meine Auslastung {f ? `— ${f.rate_pct}%` : ''}
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
              {/* Main rate display */}
              <div className="text-center py-2">
                <div className={`text-4xl font-bold ${ampelRing(f.ampel)}`}>{f.rate_pct}%</div>
                <div className="text-xs text-gray-500 mt-1">Auslastung heute</div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="relative h-4 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                      f.ampel === 'gruen' ? 'bg-green-500' : f.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(f.rate_pct, 100)}%` }}
                  />
                  {/* Zielbereich marker */}
                  <div className="absolute top-0 h-full border-l-2 border-green-700 border-dashed opacity-60" style={{ left: '60%' }} />
                  <div className="absolute top-0 h-full border-l-2 border-green-700 border-dashed opacity-60" style={{ left: '85%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0%</span>
                  <span className="text-green-600">60% Ziel</span>
                  <span className="text-green-600">85% Max</span>
                  <span>100%</span>
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.fahrzeit_min} Min</div>
                  <div className="text-xs text-gray-500">Fahrzeit</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{f.schichtdauer_min} Min</div>
                  <div className="text-xs text-gray-500">Schichtdauer</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon trend={f.trend} />
                    <span className="text-sm font-bold">{f.rate_pct_vw}%</span>
                  </div>
                  <div className="text-xs text-gray-500">Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white bg-opacity-60 p-2 text-center">
                  <div className="text-sm font-bold">{data?.team_avg_pct ?? '—'}%</div>
                  <div className="text-xs text-gray-500">Team-Ø</div>
                </div>
              </div>

              {/* Coaching tip */}
              <div className="rounded-lg bg-white bg-opacity-70 border px-3 py-2">
                <p className="text-xs text-gray-700">{coachingTipp(f)}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
