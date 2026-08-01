'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, TrendingUp, TrendingDown, Minus, AlertTriangle, WifiOff } from 'lucide-react';

// Phase 5391 — Vollständigkeits-Board (Dispatch)
// vollstaendigkeit_pct (Lieferungsabschlussrate); ABSTEIGEND Rang 1=höchste Rate=bester;
// CheckCircle emerald-400; 3-KPI-Grid Beste/Team-Ø/Niedrigste; Balken farbkodiert;
// DeltaIcons; Niedrig-Alert <88%; ABSTEIGEND; 30-Min-Polling; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  vollstaendigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  beste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, vollstaendigkeit_pct: 97.0, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, vollstaendigkeit_pct: 94.0, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, vollstaendigkeit_pct: 91.0, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, vollstaendigkeit_pct: 84.0, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 91.5,
  beste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function deltaIcon(delta: number) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-zinc-500" />;
}

function barColor(ampel: FahrerRow['ampel']): string {
  if (ampel === 'gruen') return 'bg-emerald-500';
  if (ampel === 'gelb')  return 'bg-amber-400';
  return 'bg-red-500';
}

export function DispatchPhase5391VollstaendigkeitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [offline, setOffline] = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      const url = locationId
        ? `/api/delivery/admin/fahrer-vollstaendigkeit-ranking?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-vollstaendigkeit-ranking';
      fetch(url, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setData(d); setOffline(false); } })
        .catch(() => setOffline(true));
    };
    poll();
    ivRef.current = setInterval(poll, 30 * 60_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [locationId]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3 text-sm font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Vollständigkeit</span>
        </div>
        {offline && <WifiOff className="w-3.5 h-3.5 text-zinc-600" />}
      </div>

      {/* 3-KPI Grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded-lg bg-zinc-900 p-2 text-center">
          <div className="text-[9px] text-zinc-500 mb-0.5">Beste/r</div>
          <div className="text-xs font-bold text-emerald-400 truncate">{data.beste_name.split(' ')[0]}</div>
          <div className="text-base font-bold text-emerald-300">{data.fahrer[0]?.vollstaendigkeit_pct ?? 0}%</div>
        </div>
        <div className="rounded-lg bg-zinc-900 p-2 text-center">
          <div className="text-[9px] text-zinc-500 mb-0.5">Team-Ø</div>
          <div className="text-base font-bold text-zinc-300">{data.team_avg_pct}%</div>
        </div>
        <div className="rounded-lg bg-zinc-900 p-2 text-center">
          <div className="text-[9px] text-zinc-500 mb-0.5">Niedrigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.niedrigste_name.split(' ')[0]}</div>
          <div className="text-base font-bold text-red-300">{data.fahrer[data.fahrer.length - 1]?.vollstaendigkeit_pct ?? 0}%</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="text-[11px] text-red-300">
            {data.alert_count} Fahrer unter 88% Vollständigkeit
          </span>
        </div>
      )}

      {/* Rangliste */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 w-4">#{f.rang}</span>
                <span className="text-xs text-zinc-200">{f.fahrer_name}</span>
                {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
              <div className="flex items-center gap-1.5">
                {deltaIcon(f.rank_delta)}
                <span className={`text-xs font-bold ${f.ampel === 'gruen' ? 'text-emerald-400' : f.ampel === 'gelb' ? 'text-amber-400' : 'text-red-400'}`}>
                  {f.vollstaendigkeit_pct}%
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(f.ampel)}`}
                style={{ width: `${Math.min(100, f.vollstaendigkeit_pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9px] text-zinc-600 text-right">
        <CheckCircle2 className="w-3 h-3 inline mr-1" />
        30-Min-Poll · {data.gesamt} Fahrer
      </div>
    </div>
  );
}
