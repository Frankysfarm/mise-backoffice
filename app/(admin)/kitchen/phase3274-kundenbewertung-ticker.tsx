'use client';
import { useEffect, useState } from 'react';
import { Star, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  bewertung_avg: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',  bewertung_avg: 4.8, trend_delta:  0.3, ampel: 'gruen', rang: 1 },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Fuchs',  bewertung_avg: 4.6, trend_delta:  0.2, ampel: 'gruen', rang: 2 },
    { fahrer_id: 'f2', fahrer_name: 'Sara Koch',   bewertung_avg: 4.2, trend_delta:  0.0, ampel: 'gelb',  rang: 3 },
    { fahrer_id: 'f3', fahrer_name: 'Tim Becker',  bewertung_avg: 3.8, trend_delta: -0.4, ampel: 'rot',   rang: 4 },
  ],
  team_durchschnitt: 4.35,
  alert_count: 1,
};

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

export function KitchenPhase3274KundenbewertungTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { if (active) setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const list = [...d.fahrer].sort((a, b) => a.rang - b.rang);
  const bester = list.find(f => f.rang === 1);
  const alerts = list.filter(f => f.ampel === 'rot');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">Kundenbewertungs-Ticker</span>
          {bester && (
            <span className="text-xs text-yellow-700 dark:text-yellow-400 font-semibold ml-1">
              🏆 {bester.fahrer_name} {bester.bewertung_avg.toFixed(1)} ★
            </span>
          )}
          {d.alert_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={9} /> {d.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2 space-y-1.5">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-2 py-1.5">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrige Kundenbewertung!
            </div>
          )}

          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-500 dark:text-gray-400 w-5">#{f.rang}</span>
                <span className={`w-2 h-2 rounded-full ${ampelDot(f.ampel)}`} />
                <span className="font-medium text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={10} className="text-yellow-400" />
                <span className="font-bold text-gray-800 dark:text-gray-100">{f.bewertung_avg.toFixed(1)}</span>
                {f.trend_delta > 0  && <TrendingUp   size={10} className="text-green-500" />}
                {f.trend_delta < 0  && <TrendingDown size={10} className="text-red-400"   />}
                {f.trend_delta === 0 && <Minus        size={10} className="text-gray-400"  />}
              </div>
            </div>
          ))}

          <div className="flex justify-between text-xs text-gray-400 pt-1">
            <span>Team-Ø: <span className="font-semibold text-blue-600 dark:text-blue-400">{d.team_durchschnitt.toFixed(1)} ★</span></span>
            <span>Ziel: ≥4.5 ★</span>
          </div>
        </div>
      )}
    </div>
  );
}
