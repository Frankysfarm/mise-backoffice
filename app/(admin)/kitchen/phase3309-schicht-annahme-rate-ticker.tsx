'use client';
import { useEffect, useState } from 'react';
import { CheckSquare, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rate_pct: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 97, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate_pct: 88, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate_pct: 75, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 58, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 79.5,
  bester_name: 'Julia F.',
  alert_count: 1,
};

function ampelDot(a: string): string {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function ampelText(a: string): string {
  if (a === 'rot')  return 'text-red-700 dark:text-red-300';
  if (a === 'gelb') return 'text-amber-700 dark:text-amber-300';
  return 'text-green-700 dark:text-green-300';
}

export function KitchenPhase3309SchichtAnnahmeRateTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-annahme-rate?location_id=${locationId}`);
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
  const alerts = list.filter(f => f.alert_bottom);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Schicht-Annahme-Ticker
          </span>
          {bester && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              #1 {bester.fahrer_name} {bester.rate_pct}%
            </span>
          )}
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrige Annahme-Rate!
            </div>
          )}

          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-400 w-5 text-right">{f.rang}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ampelDot(f.ampel)}`} />
                <span className={`text-sm font-medium truncate ${ampelText(f.ampel)}`}>{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-sm font-bold ${ampelText(f.ampel)}`}>{f.rate_pct}%</span>
                {f.rank_delta > 0
                  ? <TrendingUp   size={11} className="text-green-500" />
                  : f.rank_delta < 0
                  ? <TrendingDown size={11} className="text-red-400"   />
                  : <Minus        size={11} className="text-gray-400"  />}
              </div>
            </div>
          ))}

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>Team-Ø: {d.team_avg_pct}%</span>
            <span>Ziel ≥90%</span>
          </div>
        </div>
      )}
    </div>
  );
}
