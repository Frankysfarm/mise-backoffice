'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerR {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  touren_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  vw_avg_min: number;
}

interface ApiData {
  fahrer: FahrerR[];
  team_durchschnitt: number;
}

function ampelBg(a: string) {
  if (a === 'gruen') return 'bg-green-50 border-green-200 text-green-800';
  if (a === 'gelb') return 'bg-amber-50 border-amber-200 text-amber-800';
  return 'bg-red-50 border-red-200 text-red-800';
}

function ampelTextColor(a: string) {
  if (a === 'gruen') return 'text-green-600';
  if (a === 'gelb') return 'text-amber-500';
  return 'text-red-600';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-red-500';
}

function coachingTipp(f: FahrerR): string {
  if (f.avg_min > 7) return `${f.avg_min.toFixed(1)} Min Reaktionszeit — bitte direkt nach Zuweisung losfahren, Ziel ist unter 3 Min!`;
  if (f.ampel === 'gruen' && f.trend === 'steigend') return `Super! ${f.avg_min.toFixed(1)} Min — du bist einer der schnellsten im Team!`;
  if (f.ampel === 'gruen') return `Sehr gut! ${f.avg_min.toFixed(1)} Min Reaktionszeit — Küche und Kunden danken dir.`;
  return `${f.avg_min.toFixed(1)} Min — Ziel ist unter 3 Min. Bestellung direkt nach Zuweisung abholen hilft!`;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2437MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [mein, setMein] = useState<FahrerR | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
      if (!r.ok) return;
      const d: ApiData = await r.json();
      setTeamAvg(d.team_durchschnitt);
      const found = driverId
        ? (d.fahrer.find(f => f.fahrer_id === driverId) ?? d.fahrer[0] ?? null)
        : (d.fahrer[0] ?? null);
      setMein(found);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !mein) return null;

  const maxMin = 10;
  const pct = Math.min(100, (mein.avg_min / maxMin) * 100);

  return (
    <div className={`rounded-xl border mb-3 ${ampelBg(mein.ampel)}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={ampelTextColor(mein.ampel)} />
          <span className="font-semibold text-sm">
            Meine Reaktionszeit — {mein.avg_min.toFixed(1)} Min
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center py-2">
            <p className={`text-4xl font-black ${ampelTextColor(mein.ampel)}`}>
              {mein.avg_min.toFixed(1)} <span className="text-2xl font-bold">Min</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Ø Zeit bis Abfahrt nach Zuweisung ({mein.touren_heute} Touren heute)
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {mein.trend === 'steigend' ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : mein.trend === 'fallend' ? (
                <TrendingDown size={14} className="text-red-500" />
              ) : (
                <Minus size={14} className="text-gray-400" />
              )}
              <span className="text-xs text-gray-600">
                {mein.trend_delta !== 0
                  ? `${mein.trend_delta > 0 ? '+' : ''}${mein.trend_delta} Min ggü. VW`
                  : 'Wie Vorwoche'}
              </span>
            </div>
          </div>

          <div className="relative h-3 rounded-full bg-gray-200">
            <div
              className={`absolute left-0 top-0 h-full rounded-full ${barColor(mein.ampel)}`}
              style={{ width: `${pct}%` }}
            />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-500" style={{ left: '30%' }} title="3 Min" />
            <div className="absolute top-0 h-full border-l-2 border-dashed border-gray-700" style={{ left: '70%' }} title="7 Min" />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0</span><span>3 Min</span><span>7 Min</span><span>10 Min</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Vorwoche', value: `${mein.vw_avg_min.toFixed(1)} Min` },
              { label: 'Trend', value: mein.trend === 'steigend' ? '↓ besser' : mein.trend === 'fallend' ? '↑ schlechter' : '→' },
              { label: 'Ziel', value: '<3 Min' },
              { label: 'Team-Ø', value: teamAvg !== null ? `${teamAvg.toFixed(1)} Min` : '—' },
            ].map(k => (
              <div key={k.label} className="bg-white/60 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xs font-bold text-gray-800">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2">
            <Zap size={12} className={`${ampelTextColor(mein.ampel)} mt-0.5 shrink-0`} />
            <p className="text-xs text-gray-700">{coachingTipp(mein)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
