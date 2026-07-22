'use client';
import { useEffect, useState } from 'react';
import { Timer, AlertTriangle, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sec: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sec: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sec:  45, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sec:  72, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sec: 120, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sec: 195, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_sec: 108,
  bester_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function fmtSek(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

function ampelDot(a: string) {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb')  return 'bg-amber-400';
  return 'bg-red-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingDown size={10} className="text-green-500" />;
  if (delta > 0) return <TrendingUp   size={10} className="text-red-400"   />;
  return               <Minus         size={10} className="text-gray-400"  />;
}

export function KitchenPhase3249StoppdauerTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-stoppdauer-ranking${params}`);
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
  const alerts = list.filter(f => f.alert_bottom);
  const bester = list.find(f => f.rang === 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-3 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Timer size={14} className="text-blue-500 flex-shrink-0" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100 truncate">
            Stoppdauer-Ranking
          </span>
          {bester && (
            <span className="text-xs text-gray-500 truncate hidden sm:block">
              — #1: {bester.fahrer_name} ({fmtSek(bester.avg_sec)})
            </span>
          )}
          {d.alert_count > 0 && (
            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5">
              <AlertTriangle size={9} /> {d.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-2.5 py-1.5">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Hohe Stoppdauer!
            </div>
          )}

          <div className="space-y-1.5">
            {list.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-300 flex-shrink-0">
                  {f.rang}
                </span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex-1 truncate">{f.fahrer_name}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Timer size={10} className="text-blue-400" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{fmtSek(f.avg_sec)}</span>
                  <DeltaIcon delta={f.rank_delta} />
                  {f.rank_delta !== 0 && (
                    <span className="text-xs text-gray-400">
                      {f.rank_delta > 0 ? `+${f.rank_delta}` : `${f.rank_delta}`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 pt-1">
            Team-Ø: {fmtSek(Math.round(d.team_avg_sec))} · Ziel: &lt;90s
          </div>
        </div>
      )}
    </div>
  );
}
