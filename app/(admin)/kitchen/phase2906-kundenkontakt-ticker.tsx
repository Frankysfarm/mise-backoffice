'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  kundenkontakt_score: number;
  sub_trinkgeld: number;
  sub_wiederbestellung: number;
  sub_beschwerden: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg: number;
  alert_count: number;
}

const ZIEL = 80;
const WARN = 60;

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
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   kundenkontakt_score: 90, sub_trinkgeld: 88, sub_wiederbestellung: 91, sub_beschwerden: 95, trend: 'steigend', alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', kundenkontakt_score: 86, sub_trinkgeld: 82, sub_wiederbestellung: 87, sub_beschwerden: 90, trend: 'stabil',   alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  kundenkontakt_score: 73, sub_trinkgeld: 70, sub_wiederbestellung: 72, sub_beschwerden: 80, trend: 'fallend',  alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   kundenkontakt_score: 52, sub_trinkgeld: 45, sub_wiederbestellung: 52, sub_beschwerden: 55, trend: 'fallend',  alert_niedrig: true  },
  ],
  team_avg: 75,
  alert_count: 1,
};

export function KitchenPhase2906KundenkontaktTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-kundenkontakt?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.kundenkontakt_score) }));
  const sorted   = [...enriched].sort((a, b) => b.kundenkontakt_score - a.kundenkontakt_score);
  const alerts   = enriched.filter(f => f.alert_niedrig);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Heart size={14} className="text-pink-500" />
          <span className="font-semibold text-xs text-gray-800">Kundenkontakt</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <span className={`w-2 h-2 rounded-full ${dotCls(teamAmpel)}`} />
            Ø {data.team_avg} Pkt
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-1.5 space-y-0.5">
              {alerts.map(f => (
                <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-red-700">
                  <AlertTriangle size={10} />
                  <span className="font-medium">{f.fahrer_name}</span>
                  <span>— Niedriger Kundenkontakt-Score! ({f.kundenkontakt_score} Pkt)</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between text-[11px] text-gray-700">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(f.ampel)}`} />
                  <span className="truncate max-w-[90px]">{f.fahrer_name}</span>
                  <TrendIcon trend={f.trend} />
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <span className="text-[10px]">💰{f.sub_trinkgeld} 🔄{f.sub_wiederbestellung} ✓{f.sub_beschwerden}</span>
                  <span className="font-medium">{f.kundenkontakt_score} Pkt</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 text-right">Ziel ≥{ZIEL} Pkt</div>
        </div>
      )}
    </div>
  );
}
