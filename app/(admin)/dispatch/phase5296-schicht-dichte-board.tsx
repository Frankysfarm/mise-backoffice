'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  schichten_pro_woche: number;
  rank_delta: number;
  ampel: string;
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  dichteste_name: string | null;
  niedrigste_name: string | null;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, schichten_pro_woche: 5.8, rank_delta: 1,  ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, schichten_pro_woche: 4.9, rank_delta: -1, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, schichten_pro_woche: 3.2, rank_delta: 0,  ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, schichten_pro_woche: 1.5, rank_delta: 0,  ampel: 'rot',   alert_low: true  },
  ],
  team_avg: 3.85,
  dichteste_name: 'Julia F.',
  niedrigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function AmpelColor(ampel: string): { bar: string; text: string } {
  if (ampel === 'gruen') return { bar: 'bg-blue-500', text: 'text-blue-400' };
  if (ampel === 'gelb')  return { bar: 'bg-yellow-500', text: 'text-yellow-400' };
  return { bar: 'bg-red-500', text: 'text-red-400' };
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5296SchichtDichteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(`/api/delivery/admin/fahrer-schicht-dichte-ranking?location_id=${locationId}`).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const maxVal = Math.max(...data.fahrer.map(f => f.schichten_pro_woche), 1);

  return (
    <div className="rounded-xl border border-blue-800/60 bg-blue-950/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Schicht-Dichte Ranking</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count} Niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-blue-900/30 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Häufigste</div>
          <div className="text-xs font-bold text-blue-300 truncate">{data.dichteste_name ?? '—'}</div>
        </div>
        <div className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø/Woche</div>
          <div className="text-base font-black text-gray-200 tabular-nums">{data.team_avg.toFixed(1)}</div>
        </div>
        <div className="rounded-lg bg-red-900/20 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Seltenste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.niedrigste_name ?? '—'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => {
          const { bar, text } = AmpelColor(f.ampel);
          const pct = (f.schichten_pro_woche / maxVal) * 100;
          return (
            <div key={f.fahrer_id} className="rounded-lg bg-gray-800/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-gray-500 font-mono w-4 shrink-0">#{f.rang}</span>
                  <span className="text-xs font-semibold text-gray-200 truncate">{f.fahrer_name}</span>
                  {f.alert_low && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <DeltaIcon d={f.rank_delta} />
                  <span className={`text-sm font-black tabular-nums ${text}`}>{f.schichten_pro_woche.toFixed(1)}</span>
                  <span className="text-[10px] text-gray-500">/Woche</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · letzte 30 Tage · 30-Min-Polling</div>
    </div>
  );
}
