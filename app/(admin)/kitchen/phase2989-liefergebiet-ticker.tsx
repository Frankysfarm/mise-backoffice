'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  radius_km: number;
  auslastung_pct: number;
  trend: string;
  alert_ueberlastet: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_auslastung: number;
  alert_count: number;
}

const ZIEL_AUSL  = 80;
const ALERT_AUSL = 90;

function dotCls(radius: number, ausl: number): string {
  if (radius > 6 || ausl > 90) return 'bg-red-500';
  if (radius > 4 || ausl > 80) return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Tim B.',   radius_km: 7.1, auslastung_pct: 93, trend: 'steigend', alert_ueberlastet: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  radius_km: 4.8, auslastung_pct: 82, trend: 'steigend', alert_ueberlastet: false },
    { fahrer_id: 'f3', fahrer_name: 'Julia F.', radius_km: 3.9, auslastung_pct: 71, trend: 'stabil',   alert_ueberlastet: false },
    { fahrer_id: 'f4', fahrer_name: 'Max M.',   radius_km: 3.2, auslastung_pct: 65, trend: 'fallend',  alert_ueberlastet: false },
  ],
  team_avg_auslastung: 78,
  alert_count: 1,
};

export function KitchenPhase2989LiefergebietTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefergebiet-auslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.auslastung_pct - a.auslastung_pct);
  const alerts   = data.fahrer.filter(f => f.alert_ueberlastet);
  const hasAlert = alerts.length > 0;
  const avgAusl  = data.team_avg_auslastung;
  const teamText = avgAusl > ALERT_AUSL ? 'text-red-600' : avgAusl > ZIEL_AUSL ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Liefergebiet-Ticker
            <span className={`ml-2 font-black ${teamText}`}>{avgAusl}%</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Team-Ø Ausl.</span>
          </span>
          {hasAlert && <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Gebiet überlastet! ({f.auslastung_pct}% / {f.radius_km.toFixed(1)} km)
              </span>
            </div>
          ))}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map(f => {
              const cls = f.auslastung_pct > ALERT_AUSL ? 'text-red-600' : f.auslastung_pct > ZIEL_AUSL ? 'text-amber-600' : 'text-green-600';
              return (
                <div key={f.fahrer_id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotCls(f.radius_km, f.auslastung_pct)} shrink-0`} />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                    <span className="text-xs text-gray-400">{f.radius_km.toFixed(1)} km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendIcon trend={f.trend} />
                    <span className={`text-xs font-bold ${cls}`}>{f.auslastung_pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-400 pt-1">Ziel &lt;{ZIEL_AUSL}% Auslastung | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
