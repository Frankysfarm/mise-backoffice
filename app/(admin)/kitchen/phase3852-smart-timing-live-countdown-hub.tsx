'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Timer, Zap, TrendingUp, ChefHat, Play } from 'lucide-react';

interface BestellungRow {
  id: string;
  nr: string;
  artikel: number;
  kochstart_sek: number;
  restzeit_sek: number;
  fortschritt: number;
  status: 'wartend' | 'in_zubereitung' | 'fertig';
  tisch?: string;
}

interface ApiData {
  bestellungen: BestellungRow[];
  score: number;
  on_time_pct: number;
  ueberfallig: number;
  avg_prep_min: number;
  aktive_koeche: number;
}

const MOCK: ApiData = {
  bestellungen: [
    { id: 'b1', nr: '#1054', artikel: 3, kochstart_sek: 90,   restzeit_sek: 720,  fortschritt: 0,   status: 'wartend',         tisch: 'T7' },
    { id: 'b2', nr: '#1053', artikel: 2, kochstart_sek: -45,  restzeit_sek: 390,  fortschritt: 60,  status: 'in_zubereitung',  tisch: 'Liefer' },
    { id: 'b3', nr: '#1052', artikel: 4, kochstart_sek: -200, restzeit_sek: 110,  fortschritt: 82,  status: 'in_zubereitung',  tisch: 'Liefer' },
    { id: 'b4', nr: '#1051', artikel: 1, kochstart_sek: -310, restzeit_sek: -25,  fortschritt: 100, status: 'fertig',           tisch: 'T3' },
    { id: 'b5', nr: '#1050', artikel: 2, kochstart_sek: 180,  restzeit_sek: 1050, fortschritt: 0,   status: 'wartend',         tisch: 'Liefer' },
  ],
  score: 82,
  on_time_pct: 87,
  ueberfallig: 1,
  avg_prep_min: 13.8,
  aktive_koeche: 3,
};

function fmtSek(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sek < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function ampel(sek: number) {
  if (sek < 0)    return { ring: 'ring-red-400',    bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500',    dot: 'bg-red-500' };
  if (sek < 120)  return { ring: 'ring-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500' };
  if (sek < 360)  return { ring: 'ring-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-400', dot: 'bg-yellow-400' };
  return               { ring: 'ring-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700',bar: 'bg-emerald-500',dot: 'bg-emerald-500' };
}

function scoreCol(s: number) {
  if (s >= 85) return 'text-emerald-700 bg-emerald-50';
  if (s >= 70) return 'text-yellow-700 bg-yellow-50';
  return 'text-red-700 bg-red-50';
}

export function KitchenPhase3852SmartTimingLiveCountdownHub({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1_000); return () => clearInterval(t); }, []);

  const aktiv = data.bestellungen.filter(b => b.status !== 'fertig');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-bold text-gray-900">Smart-Timing Live</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${scoreCol(data.score)}`}>
            Score {data.score}
          </span>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">On-Time</span>
          <span className={`text-sm font-bold ${data.on_time_pct >= 85 ? 'text-emerald-700' : 'text-yellow-600'}`}>{data.on_time_pct}%</span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">Aktiv</span>
          <span className="text-sm font-bold text-gray-800">{aktiv.length}</span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">Überfäll.</span>
          <span className={`text-sm font-bold ${data.ueberfallig > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{data.ueberfallig}</span>
        </div>
        <div className="flex flex-col items-center p-1.5 bg-gray-50 rounded-lg">
          <span className="text-[9px] text-gray-400 uppercase tracking-wide">Ø Prep</span>
          <span className="text-sm font-bold text-gray-800">{data.avg_prep_min.toFixed(1)}m</span>
        </div>
      </div>

      {/* Überfällig-Alert */}
      {data.ueberfallig > 0 && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">{data.ueberfallig} Bestellung{data.ueberfallig > 1 ? 'en' : ''} überfällig — sofort handeln!</span>
        </div>
      )}

      {/* Bestellungen mit Countdown */}
      <div className="space-y-2">
        {data.bestellungen.map(b => {
          const rest = b.restzeit_sek - tick;
          const kstart = b.kochstart_sek - tick;
          const col = ampel(rest);
          return (
            <div key={b.id} className={`rounded-lg ring-1 ${col.ring} ${col.bg} p-2 space-y-1.5`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs">
                  {b.status === 'fertig'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    : b.status === 'in_zubereitung'
                    ? <Zap className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    : <Clock className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="font-semibold text-gray-800">{b.nr}</span>
                  <span className="text-gray-400 text-[10px]">{b.artikel} Artikel</span>
                  {b.tisch && <span className="text-[10px] bg-white/70 px-1 rounded text-gray-500">{b.tisch}</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {b.status === 'wartend' && kstart > 0 && (
                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-0.5">
                      <Play className="w-2.5 h-2.5" /> Koch in {fmtSek(kstart)}
                    </span>
                  )}
                  {b.status === 'wartend' && kstart <= 0 && (
                    <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">Jetzt!</span>
                  )}
                  {b.status !== 'fertig' && (
                    <span className={`font-mono font-bold text-sm ${col.text}`}>{fmtSek(rest)}</span>
                  )}
                  {b.status === 'fertig' && (
                    <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Fertig
                    </span>
                  )}
                </div>
              </div>
              {/* Fortschrittsbalken */}
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                  style={{ width: `${Math.min(100, Math.max(0, b.fortschritt))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <ChefHat className="w-3 h-3" /> {data.aktive_koeche} Köche aktiv
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> 4-stufige Farbkodierung · 1-Sek
        </span>
      </div>
    </div>
  );
}
