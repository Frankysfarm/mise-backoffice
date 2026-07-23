'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bestellung {
  order_id: string;
  bestellnummer: string;
  status: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  kunde_name: string;
}

interface ApiResponse {
  bestellungen: Bestellung[];
  on_time_rate: number;
  avg_prep_min: number;
  kochstart_score: number;
  empfehlung: string | null;
}

const MOCK: ApiResponse = {
  bestellungen: [
    { order_id: '1', bestellnummer: '#1051', status: 'in_zubereitung', cook_start_at: new Date(Date.now() - 7 * 60_000).toISOString(), ready_target: new Date(Date.now() + 7 * 60_000).toISOString(), prep_min: 14, kunde_name: 'A. Bauer' },
    { order_id: '2', bestellnummer: '#1052', status: 'in_zubereitung', cook_start_at: new Date(Date.now() - 11 * 60_000).toISOString(), ready_target: new Date(Date.now() + 3 * 60_000).toISOString(), prep_min: 14, kunde_name: 'S. Koch' },
    { order_id: '3', bestellnummer: '#1053', status: 'neu', cook_start_at: null, ready_target: new Date(Date.now() + 22 * 60_000).toISOString(), prep_min: 14, kunde_name: 'T. Maier' },
  ],
  on_time_rate: 91,
  avg_prep_min: 13.2,
  kochstart_score: 88,
  empfehlung: 'Jetzt mit #1053 starten – Fahrer kommt in ~8 Min.',
};

function secsLeft(target: string | null): number {
  if (!target) return 0;
  return Math.floor((new Date(target).getTime() - Date.now()) / 1000);
}

function farbzone(secs: number, prepMin: number): 'gruen' | 'gelb' | 'rot' {
  const total = (prepMin || 14) * 60;
  const pct = secs / total;
  if (secs <= 0) return 'rot';
  if (pct > 0.4) return 'gruen';
  if (pct > 0.15) return 'gelb';
  return 'rot';
}

const COLOR = {
  gruen: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', bar: 'bg-green-500' },
  gelb:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  bar: 'bg-amber-400'  },
  rot:   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-300',    bar: 'bg-red-500'    },
};

export function KitchenPhase3565SmartTimingKochstartScoreCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.bestellungen?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const aktiv = data.bestellungen.filter(b => b.status === 'in_zubereitung' && b.ready_target);
  const pending = data.bestellungen.filter(b => b.status !== 'in_zubereitung' || !b.ready_target);

  const scoreColor = data.kochstart_score >= 85 ? 'text-green-600' : data.kochstart_score >= 65 ? 'text-amber-600' : 'text-red-600';
  const otColor = data.on_time_rate >= 85 ? 'text-green-600' : data.on_time_rate >= 65 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold text-orange-800">Kochstart-Score Cockpit</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={cn('font-bold', scoreColor)}>Score {data.kochstart_score}/100</span>
          <span className={cn('font-semibold', otColor)}>{data.on_time_rate}% on-time</span>
        </div>
      </div>

      {/* Aktive Bestellungen */}
      {aktiv.length > 0 && (
        <div className="space-y-2">
          {aktiv.map(b => {
            const secs = secsLeft(b.ready_target);
            const zone = farbzone(secs, b.prep_min ?? 14);
            const c = COLOR[zone];
            const total = (b.prep_min ?? 14) * 60;
            const elapsed = total - secs;
            const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
            const mins = Math.floor(Math.abs(secs) / 60);
            const sec2 = Math.abs(secs) % 60;
            return (
              <div key={b.order_id} className={cn('rounded-lg border p-2.5', c.bg, c.border)}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-xs font-semibold">{b.bestellnummer}</span>
                    <span className="text-xs text-gray-500">{b.kunde_name}</span>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', c.text)}>
                    {secs <= 0 ? '–' : `${mins}:${String(sec2).padStart(2, '0')}`}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', c.bar)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empfehlung */}
      {data.empfehlung && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-2">
          <TrendingUp className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">{data.empfehlung}</p>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Ausstehend ({pending.length})</p>
          {pending.map(b => (
            <div key={b.order_id} className="flex items-center gap-2 rounded bg-white border border-gray-200 px-2 py-1.5">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium">{b.bestellnummer}</span>
              <span className="text-xs text-gray-500">{b.kunde_name}</span>
              {b.ready_target && (
                <span className="ml-auto text-xs text-gray-400">
                  Ziel {new Date(b.ready_target).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* KPI Footer */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-200">
        <div className="text-center">
          <p className="text-xs text-gray-500">Ø Prepzeit</p>
          <p className="text-sm font-bold text-gray-800">{data.avg_prep_min.toFixed(1)} min</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500">Aktiv</p>
          <p className="text-sm font-bold text-gray-800">{aktiv.length} / {data.bestellungen.length}</p>
        </div>
      </div>
    </div>
  );
}
