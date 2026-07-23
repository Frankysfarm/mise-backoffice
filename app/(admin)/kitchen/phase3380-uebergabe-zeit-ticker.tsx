'use client';
import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  sek: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sek: number;
  schnellster_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, sek:  80, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, sek: 105, rank_delta: -1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, sek: 150, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, sek: 250, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_sek: 146,
  schnellster_name: 'Julia F.',
  alert_count: 1,
};

function fmtSek(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

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

function RankBadge({ rang }: { rang: number }) {
  const colors =
    rang === 1 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
    rang === 2 ? 'bg-gray-100 text-gray-600 border-gray-300' :
    rang === 3 ? 'bg-orange-100 text-orange-600 border-orange-300' :
    'bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs font-bold ${colors}`}>
      {rang}
    </span>
  );
}

export function KitchenPhase3380UebergabeZeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-uebergabe-zeit?location_id=${locationId}`);
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
  const schnellster = list.find(f => f.rang === 1);
  const alerts = list.filter(f => f.alert_top);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-purple-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Übergabe-Zeit
          </span>
          {schnellster && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              #1 {schnellster.fahrer_name} {fmtSek(schnellster.sek)}
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
              {alerts.map(f => f.fahrer_name).join(', ')} — Lange Übergabezeit!
            </div>
          )}

          {list.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <RankBadge rang={f.rang} />
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ampelDot(f.ampel)}`} />
                <span className={`text-sm font-medium truncate ${ampelText(f.ampel)}`}>{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className={`text-sm font-bold tabular-nums ${ampelText(f.ampel)}`}>{fmtSek(f.sek)}</span>
                {f.rank_delta < 0
                  ? <TrendingUp   size={11} className="text-green-500" />
                  : f.rank_delta > 0
                  ? <TrendingDown size={11} className="text-red-400"   />
                  : <Minus        size={11} className="text-gray-400"  />}
                {f.rank_delta !== 0 && (
                  <span className={`text-xs ${f.rank_delta < 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {f.rank_delta > 0 ? '+' : ''}{f.rank_delta}
                  </span>
                )}
              </div>
            </div>
          ))}

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>Team-Ø: {fmtSek(d.team_avg_sek)}</span>
            <span>letzte 30 Tage</span>
          </div>
        </div>
      )}
    </div>
  );
}
