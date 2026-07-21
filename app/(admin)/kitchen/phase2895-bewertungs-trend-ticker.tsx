'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  driver_id: string;
  name: string;
  avg_bewertung: number;
  bewertungs_count: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  alert_count: number;
}

const ZIEL = 4.5;
const WARN = 3.5;

function calcAmpel(v: number): string {
  if (v >= ZIEL) return 'gruen';
  if (v >= WARN) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_bewertung: 4.8, bewertungs_count: 42, trend: 'steigend', alert_niedrig: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_bewertung: 4.5, bewertungs_count: 31, trend: 'stabil',   alert_niedrig: false },
    { driver_id: 'd4', name: 'Anna L.',  avg_bewertung: 4.1, bewertungs_count: 27, trend: 'steigend', alert_niedrig: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_bewertung: 3.2, bewertungs_count: 18, trend: 'fallend',  alert_niedrig: true  },
  ],
  team_avg: 4.15,
  alert_count: 1,
};

export function KitchenPhase2895BewertungsTrendTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-bewertungs-trend?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched   = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_bewertung) }));
  const sorted     = [...enriched].sort((a, b) => b.avg_bewertung - a.avg_bewertung);
  const alerts     = enriched.filter(f => f.alert_niedrig);
  const hasAlert   = alerts.length > 0;
  const teamAmpel  = calcAmpel(data.team_avg);
  const teamDotCls = dotCls(teamAmpel);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800">Bewertungs-Trend</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full ${teamDotCls}`} />
            Ø {data.team_avg.toFixed(1)} ★
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-1.5 space-y-0.5">
              {alerts.map(f => (
                <div key={f.driver_id} className="flex items-center gap-1 text-[10px] text-red-700">
                  <AlertTriangle size={10} />
                  <span className="font-medium">{f.name}</span>
                  <span>— Niedrige Bewertung! ({f.avg_bewertung.toFixed(1)} ★)</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.driver_id} className="flex items-center justify-between text-[11px] text-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
                  <span className="truncate max-w-[90px]">{f.name}</span>
                  <TrendIcon trend={f.trend} />
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>{f.bewertungs_count} Bew.</span>
                  <span className="font-medium">{f.avg_bewertung.toFixed(1)} ★</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 text-right">Ziel ≥{ZIEL} ★</div>
        </div>
      )}
    </div>
  );
}
