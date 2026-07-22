'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, Zap } from 'lucide-react';

interface BestellungEntry {
  order_id: string;
  order_number: string;
  customer_name: string;
  status: string;
  prep_started_at: string | null;
  target_ready_at: string | null;
  items_count: number;
  ampel: 'gruen' | 'gelb' | 'rot' | 'kritisch';
  seconds_remaining: number;
  kochstart_empfehlung: boolean;
  kategorie: string;
}

interface ApiData {
  bestellungen: BestellungEntry[];
  on_time_rate: number;
  kritisch_count: number;
  faellig_count: number;
  gesamt_aktiv: number;
  avg_restzeit_sek: number;
}

const MOCK: ApiData = {
  bestellungen: [
    { order_id: 'o1', order_number: '#3001', customer_name: 'Mia W.', status: 'in_zubereitung', prep_started_at: new Date(Date.now() - 5 * 60_000).toISOString(), target_ready_at: new Date(Date.now() + 12 * 60_000).toISOString(), items_count: 3, ampel: 'gruen', seconds_remaining: 720, kochstart_empfehlung: false, kategorie: 'Pizza' },
    { order_id: 'o2', order_number: '#3002', customer_name: 'Lena B.', status: 'bestätigt', prep_started_at: null, target_ready_at: new Date(Date.now() + 6 * 60_000).toISOString(), items_count: 2, ampel: 'gelb', seconds_remaining: 360, kochstart_empfehlung: true, kategorie: 'Burger' },
    { order_id: 'o3', order_number: '#3003', customer_name: 'Tim S.', status: 'in_zubereitung', prep_started_at: new Date(Date.now() - 14 * 60_000).toISOString(), target_ready_at: new Date(Date.now() + 2 * 60_000).toISOString(), items_count: 4, ampel: 'rot', seconds_remaining: 110, kochstart_empfehlung: false, kategorie: 'Pasta' },
    { order_id: 'o4', order_number: '#3004', customer_name: 'Anna K.', status: 'in_zubereitung', prep_started_at: new Date(Date.now() - 22 * 60_000).toISOString(), target_ready_at: new Date(Date.now() - 3 * 60_000).toISOString(), items_count: 1, ampel: 'kritisch', seconds_remaining: -180, kochstart_empfehlung: false, kategorie: 'Salat' },
  ],
  on_time_rate: 74,
  kritisch_count: 1,
  faellig_count: 1,
  gesamt_aktiv: 4,
  avg_restzeit_sek: 253,
};

function ampelStyle(a: string) {
  if (a === 'kritisch') return { card: 'bg-red-950/40 border-red-500/60', badge: 'bg-red-600 text-white', bar: 'bg-red-500', time: 'text-red-400', pulse: true };
  if (a === 'rot')      return { card: 'bg-orange-950/30 border-orange-500/50', badge: 'bg-orange-500 text-white', bar: 'bg-orange-500', time: 'text-orange-400', pulse: false };
  if (a === 'gelb')     return { card: 'bg-amber-950/20 border-amber-500/40', badge: 'bg-amber-400 text-white', bar: 'bg-amber-400', time: 'text-amber-400', pulse: false };
  return                       { card: 'bg-green-950/20 border-green-500/30', badge: 'bg-green-600 text-white', bar: 'bg-green-500', time: 'text-green-400', pulse: false };
}

function fmtSek(sek: number): string {
  if (sek < 0) return `+${Math.abs(Math.floor(sek / 60))}m überfällig`;
  const m = Math.floor(sek / 60);
  const s = Math.abs(sek % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressPct(b: BestellungEntry): number {
  if (!b.prep_started_at || !b.target_ready_at) return b.ampel === 'gruen' ? 30 : 60;
  const total = new Date(b.target_ready_at).getTime() - new Date(b.prep_started_at).getTime();
  const elapsed = Date.now() - new Date(b.prep_started_at).getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function KitchenPhase3169SmartTimingMasterDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/kitchen/queue?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const poll = setInterval(load, 20_000);
    return () => clearInterval(poll);
  }, [locationId]);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data ?? MOCK;
  const kritisch = d.bestellungen.filter(b => b.ampel === 'kritisch');
  const sorted = [...d.bestellungen].sort((a, b) => a.seconds_remaining - b.seconds_remaining);

  return (
    <div className="rounded-xl border border-gray-700 shadow mb-4 overflow-hidden bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-white">Smart-Timing Master Dashboard</span>
          {kritisch.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-3 w-3" />{kritisch.length} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">On-Time: <span className={d.on_time_rate >= 80 ? 'text-green-400' : d.on_time_rate >= 60 ? 'text-amber-400' : 'text-red-400'} style={{fontWeight: 700}}>{d.on_time_rate}%</span></span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700 p-3 space-y-2">
          {/* KPI-Leiste */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Aktiv', val: d.gesamt_aktiv, color: 'text-white' },
              { label: 'Kritisch', val: d.kritisch_count, color: 'text-red-400' },
              { label: 'Fällig', val: d.faellig_count, color: 'text-orange-400' },
              { label: 'Ø Restzeit', val: `${Math.round(d.avg_restzeit_sek / 60)}m`, color: d.avg_restzeit_sek < 180 ? 'text-red-400' : 'text-green-400' },
            ].map(k => (
              <div key={k.label} className="rounded-lg bg-gray-800/60 border border-gray-700 px-2 py-1.5 text-center">
                <div className={`text-base font-black tabular-nums ${k.color}`}>{k.val}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Bestellungen */}
          <div className="space-y-1.5">
            {sorted.map(b => {
              const s = ampelStyle(b.ampel);
              const pct = progressPct(b);
              return (
                <div key={b.order_id} className={`rounded-lg border p-2.5 ${s.card}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.badge}`}>{b.order_number}</span>
                      <span className="text-xs font-semibold text-white truncate">{b.customer_name}</span>
                      <span className="text-[9px] text-gray-500 hidden sm:inline">{b.kategorie}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.kochstart_empfehlung && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-900/40 rounded px-1.5 py-0.5">
                          <Flame className="h-2.5 w-2.5" />Jetzt kochen!
                        </span>
                      )}
                      <span className={`font-mono text-sm font-black tabular-nums ${s.time} ${s.pulse ? 'animate-pulse' : ''}`}>
                        {fmtSek(b.seconds_remaining)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-500 tabular-nums w-7 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="py-4 text-center text-sm text-gray-500">Keine aktiven Bestellungen</div>
            )}
          </div>

          {/* On-Time Gauge */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2">
            <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px] text-gray-300">Pünktlichkeitsrate heute</span>
            <div className="flex-1 h-2 rounded-full bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${d.on_time_rate >= 80 ? 'bg-green-500' : d.on_time_rate >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${d.on_time_rate}%` }}
              />
            </div>
            <span className={`text-[11px] font-black tabular-nums ${d.on_time_rate >= 80 ? 'text-green-400' : d.on_time_rate >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{d.on_time_rate}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
