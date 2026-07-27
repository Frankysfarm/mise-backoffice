'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Flame, CheckCircle, AlertTriangle, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bestellung {
  id: string;
  bestellnummer: string | null;
  status: string;
  kochstart_soll?: string | null;
  fertig_soll?: string | null;
  items_count?: number;
}

interface ApiData {
  bestellungen: Bestellung[];
  kochstart_score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ueberfallig_count: number;
  aktiv_count: number;
}

function sekundenBis(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 1000);
}

function Ampel({ sek }: { sek: number | null }) {
  if (sek === null) return <span className="text-gray-400 text-[10px]">—</span>;
  if (sek > 120) return <span className="text-emerald-600 text-xs font-bold">{Math.floor(sek / 60)}m {sek % 60}s</span>;
  if (sek > 0) return <span className="text-amber-500 text-xs font-bold animate-pulse">{sek}s</span>;
  return <span className="text-red-600 text-xs font-bold animate-pulse">{Math.abs(sek)}s über</span>;
}

function ampelBg(sek: number | null): string {
  if (sek === null) return 'bg-gray-50 border-gray-200';
  if (sek > 120) return 'bg-emerald-50 border-emerald-200';
  if (sek > 30) return 'bg-amber-50 border-amber-200';
  if (sek > 0) return 'bg-orange-50 border-orange-300';
  return 'bg-red-50 border-red-300';
}

const MOCK: ApiData = {
  bestellungen: [
    { id: '1', bestellnummer: '#1042', status: 'zubereitung', kochstart_soll: new Date(Date.now() + 45000).toISOString(), fertig_soll: new Date(Date.now() + 8 * 60000).toISOString(), items_count: 2 },
    { id: '2', bestellnummer: '#1043', status: 'zubereitung', kochstart_soll: new Date(Date.now() - 30000).toISOString(), fertig_soll: new Date(Date.now() + 4 * 60000).toISOString(), items_count: 3 },
    { id: '3', bestellnummer: '#1044', status: 'neu', kochstart_soll: new Date(Date.now() + 3 * 60000).toISOString(), fertig_soll: new Date(Date.now() + 15 * 60000).toISOString(), items_count: 1 },
    { id: '4', bestellnummer: '#1045', status: 'zubereitung', kochstart_soll: new Date(Date.now() - 120000).toISOString(), fertig_soll: new Date(Date.now() - 60000).toISOString(), items_count: 4 },
  ],
  kochstart_score: 74,
  on_time_pct: 82,
  avg_prep_min: 11.4,
  ueberfallig_count: 1,
  aktiv_count: 3,
};

interface Props { locationId: string | null; }

export function KitchenPhase4150SmartCountdownFarbkodierungLive({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-smart-countdown?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); if (tickRef.current) clearInterval(tickRef.current); };
  }, [load]);

  const scoreColor = data.kochstart_score >= 80 ? 'text-emerald-600' : data.kochstart_score >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = data.kochstart_score >= 80 ? 'bg-emerald-500' : data.kochstart_score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-gray-900">Smart-Countdown · Farbkodierung Live</span>
        </div>
        {data.ueberfallig_count > 0 && (
          <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            <Flame className="w-3 h-3" /> {data.ueberfallig_count} überfällig
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-indigo-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Score</div>
          <div className={cn('text-sm font-black', scoreColor)}>{data.kochstart_score}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Pünktl.</div>
          <div className="text-sm font-black text-emerald-600">{data.on_time_pct}%</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Ø Prep</div>
          <div className="text-sm font-black text-blue-600">{data.avg_prep_min}m</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Aktiv</div>
          <div className="text-sm font-black text-gray-700">{data.aktiv_count}</div>
        </div>
      </div>

      {/* Score-Balken */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[9px] text-gray-500">
          <span>Kochstart-Score</span><span className={scoreColor}>{data.kochstart_score}/100</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-500', scoreBg)} style={{ width: `${data.kochstart_score}%` }} />
        </div>
      </div>

      {/* Countdown-Kacheln */}
      <div className="space-y-1.5">
        <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Aktive Bestellungen</div>
        <div className="grid grid-cols-1 gap-1">
          {data.bestellungen.slice(0, 6).map(b => {
            const fertigSek = sekundenBis(b.fertig_soll);
            const kochSek = sekundenBis(b.kochstart_soll);
            return (
              <div key={b.id} className={cn('flex items-center justify-between rounded-lg border px-2.5 py-1.5', ampelBg(fertigSek))}>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-800">{b.bestellnummer ?? `#${b.id.slice(-4)}`}</span>
                  {b.items_count && <span className="text-[9px] text-gray-400">×{b.items_count}</span>}
                  <span className="text-[9px] text-gray-500 capitalize">{b.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  {kochSek !== null && (
                    <div className="text-right">
                      <div className="text-[8px] text-gray-400">Kochstart</div>
                      <Ampel sek={kochSek} />
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-[8px] text-gray-400">Fertig</div>
                    <Ampel sek={fertigSek} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legende */}
      <div className="flex gap-2 flex-wrap">
        {[
          { col: 'bg-emerald-400', label: '>2min OK' },
          { col: 'bg-amber-400', label: '30s–2min' },
          { col: 'bg-orange-400', label: '<30s' },
          { col: 'bg-red-500', label: 'Überfällig' },
        ].map(({ col, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', col)} />
            <span className="text-[9px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
