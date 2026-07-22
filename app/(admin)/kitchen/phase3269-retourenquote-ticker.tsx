'use client';
import { useEffect, useState } from 'react';
import { XCircle, AlertTriangle, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retouren_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, retouren_pct: 2.0,  rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, retouren_pct: 5.0,  rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, retouren_pct: 8.3,  rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, retouren_pct: 15.0, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 7.6,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

function fmtPct(v: number): string {
  return `${v.toFixed(1)} %`;
}

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

export function KitchenPhase3269RetourenquoteTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-retourenquote${params}`);
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
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-red-500" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">Retourenquote-Ticker</span>
          {bester && (
            <span className="text-xs text-green-700 dark:text-green-400 font-semibold ml-1">
              🏆 {bester.fahrer_name} {fmtPct(bester.retouren_pct)}
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
              {alerts.map(f => f.fahrer_name).join(', ')} — Hohe Retourenquote!
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
                <span className="font-bold text-gray-800 dark:text-gray-100">{fmtPct(f.retouren_pct)}</span>
                {f.rank_delta > 0 && <TrendingUp   size={10} className="text-green-500" />}
                {f.rank_delta < 0 && <TrendingDown size={10} className="text-red-400"   />}
                {f.rank_delta === 0 && <Minus       size={10} className="text-gray-400"  />}
              </div>
            </div>
          ))}

          <div className="flex justify-between text-xs text-gray-400 pt-1">
            <span>Team-Ø: <span className="font-semibold text-blue-600 dark:text-blue-400">{fmtPct(d.team_avg_pct)}</span></span>
            <span>Ziel: 0 %</span>
          </div>
        </div>
      )}
    </div>
  );
}
