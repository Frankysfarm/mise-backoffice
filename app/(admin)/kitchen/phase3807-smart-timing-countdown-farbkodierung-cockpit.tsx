'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Timer, Zap, TrendingUp } from 'lucide-react';

interface BestellungRow {
  bestell_id: string;
  bestell_nr: string;
  artikel_count: number;
  kochstart_empfohlen_sek: number;   // Sekunden bis empfohlener Kochstart (negativ = überfällig)
  restzeit_sek: number;               // Restzeit bis Lieferversprechen (negativ = überfällig)
  fortschritt_pct: number;            // 0–100
  status: 'wartend' | 'in_zubereitung' | 'fertig';
}

interface ApiData {
  bestellungen: BestellungRow[];
  kochstart_score: number;           // 0–100
  on_time_rate_pct: number;
  ueberfallig_count: number;
  avg_prep_min: number;
}

const MOCK: ApiData = {
  bestellungen: [
    { bestell_id: 'b1', bestell_nr: '#1042', artikel_count: 3, kochstart_empfohlen_sek: 120, restzeit_sek: 840, fortschritt_pct: 0,  status: 'wartend' },
    { bestell_id: 'b2', bestell_nr: '#1041', artikel_count: 2, kochstart_empfohlen_sek: -60, restzeit_sek: 480, fortschritt_pct: 55, status: 'in_zubereitung' },
    { bestell_id: 'b3', bestell_nr: '#1040', artikel_count: 4, kochstart_empfohlen_sek: -180,restzeit_sek: 90,  fortschritt_pct: 85, status: 'in_zubereitung' },
    { bestell_id: 'b4', bestell_nr: '#1039', artikel_count: 1, kochstart_empfohlen_sek: -300,restzeit_sek: -30, fortschritt_pct: 100,status: 'fertig' },
  ],
  kochstart_score: 78,
  on_time_rate_pct: 84,
  ueberfallig_count: 1,
  avg_prep_min: 14.2,
};

function formatCountdown(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sek < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function ampelColor(restzeit_sek: number): { bar: string; text: string; bg: string; border: string } {
  if (restzeit_sek < 0)    return { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' };
  if (restzeit_sek < 120)  return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
  if (restzeit_sek < 360)  return { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' };
  return                          { bar: 'bg-emerald-500', text: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200' };
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

export function KitchenPhase3807SmartTimingCountdownFarbkodierungCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1_000); return () => clearInterval(id); }, []);

  const aktive = data.bestellungen.filter(b => b.status !== 'fertig');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-900">Smart-Timing</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`font-bold ${scoreColor(data.kochstart_score)}`}>Score {data.kochstart_score}</span>
          <span className="text-gray-500">⏱ Ø {data.avg_prep_min.toFixed(1)} min</span>
        </div>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[10px] text-gray-400">On-Time</span>
          <span className={`text-sm font-bold ${data.on_time_rate_pct >= 85 ? 'text-emerald-700' : 'text-yellow-600'}`}>
            {data.on_time_rate_pct}%
          </span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[10px] text-gray-400">Aktiv</span>
          <span className="text-sm font-bold text-gray-800">{aktive.length}</span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[10px] text-gray-400">Überfällig</span>
          <span className={`text-sm font-bold ${data.ueberfallig_count > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {data.ueberfallig_count}
          </span>
        </div>
      </div>

      {/* Überfällig-Alert */}
      {data.ueberfallig_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{data.ueberfallig_count} Bestellung{data.ueberfallig_count > 1 ? 'en' : ''} überfällig!</span>
        </div>
      )}

      {/* Bestellungen-Liste mit Countdown & Farbkodierung */}
      <div className="space-y-2">
        {data.bestellungen.map(b => {
          const c = ampelColor(b.restzeit_sek - tick);
          const restSek = b.restzeit_sek - tick;
          const kochSek = b.kochstart_empfohlen_sek - tick;
          return (
            <div key={b.bestell_id} className={`rounded-lg border ${c.border} ${c.bg} p-2 space-y-1.5`}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  {b.status === 'fertig'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    : b.status === 'in_zubereitung'
                    ? <Zap className="w-3.5 h-3.5 text-indigo-500" />
                    : <Clock className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="font-semibold text-gray-800">{b.bestell_nr}</span>
                  <span className="text-gray-400 text-[10px]">{b.artikel_count} Artikel</span>
                </div>
                <div className="flex items-center gap-2">
                  {b.status !== 'fertig' && (
                    <span className={`font-mono font-bold text-xs ${c.text}`}>
                      {formatCountdown(restSek)}
                    </span>
                  )}
                  {b.status === 'wartend' && kochSek > 0 && (
                    <span className="text-[10px] text-indigo-600 font-medium">
                      Koch in {formatCountdown(kochSek)}
                    </span>
                  )}
                  {b.status === 'wartend' && kochSek <= 0 && (
                    <span className="text-[10px] text-orange-600 font-bold">Jetzt kochen!</span>
                  )}
                  {b.status === 'fertig' && (
                    <span className="text-[10px] text-emerald-600 font-medium">Fertig</span>
                  )}
                </div>
              </div>
              {/* Fortschrittsbalken */}
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${c.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, b.fortschritt_pct))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Kochstart-Score {data.kochstart_score}/100</span>
        <span>Live · 1-Sek-Tick</span>
      </div>
    </div>
  );
}
