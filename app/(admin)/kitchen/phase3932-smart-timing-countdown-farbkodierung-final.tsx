'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Zap, CheckCircle2, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string;
  deadline_ms: number;
  kochstart_ms: number;
  status: 'wartend' | 'in_arbeit' | 'fertig';
  komplexitaet: number;
  fahrer_eta_ms: number | null;
}

interface KpiRow {
  on_time_pct: number;
  avg_prep_min: number;
  kochstart_score: number;
  ueberfaellig: number;
  sync_score: number;
}

const MOCK_ORDERS: OrderRow[] = [
  { id: 'b1', bestellnummer: 'FF-6001', deadline_ms: Date.now() + 11 * 60000, kochstart_ms: Date.now() + 2 * 60000, status: 'wartend', komplexitaet: 3, fahrer_eta_ms: Date.now() + 10 * 60000 },
  { id: 'b2', bestellnummer: 'FF-6002', deadline_ms: Date.now() + 3 * 60000, kochstart_ms: Date.now() - 3 * 60000, status: 'in_arbeit', komplexitaet: 5, fahrer_eta_ms: Date.now() + 2 * 60000 },
  { id: 'b3', bestellnummer: 'FF-6003', deadline_ms: Date.now() - 2 * 60000, kochstart_ms: Date.now() - 10 * 60000, status: 'in_arbeit', komplexitaet: 2, fahrer_eta_ms: Date.now() - 1 * 60000 },
  { id: 'b4', bestellnummer: 'FF-6004', deadline_ms: Date.now() + 18 * 60000, kochstart_ms: Date.now() + 9 * 60000, status: 'wartend', komplexitaet: 4, fahrer_eta_ms: Date.now() + 17 * 60000 },
  { id: 'b5', bestellnummer: 'FF-6005', deadline_ms: Date.now() + 1 * 60000, kochstart_ms: Date.now() - 6 * 60000, status: 'in_arbeit', komplexitaet: 1, fahrer_eta_ms: Date.now() + 1 * 60000 },
];
const MOCK_KPI: KpiRow = { on_time_pct: 87, avg_prep_min: 12.4, kochstart_score: 83, ueberfaellig: 1, sync_score: 76 };

function fmtSek(sek: number) {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sek < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

function farbeKodierung(restSek: number, status: string) {
  if (status === 'fertig') return { bg: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500', label: 'Fertig' };
  if (restSek < 0)        return { bg: 'bg-red-50 border-red-300',         txt: 'text-red-700',     bar: 'bg-red-500',     dot: 'bg-red-500',     label: 'Überfällig' };
  if (restSek < 120)      return { bg: 'bg-orange-50 border-orange-300',   txt: 'text-orange-700',  bar: 'bg-orange-500',  dot: 'bg-orange-500',  label: 'Kritisch' };
  if (restSek < 360)      return { bg: 'bg-yellow-50 border-yellow-200',   txt: 'text-yellow-700',  bar: 'bg-yellow-400',  dot: 'bg-yellow-400',  label: 'Bald' };
  return                         { bg: 'bg-emerald-50 border-emerald-100', txt: 'text-emerald-700', bar: 'bg-emerald-400', dot: 'bg-emerald-400', label: 'OK' };
}

export function KitchenPhase3932SmartTimingCountdownFarbkodierungFinal({ locationId }: { locationId: string | null }) {
  const [now, setNow] = useState(Date.now());
  const [orders, setOrders] = useState<OrderRow[]>(MOCK_ORDERS);
  const [kpi, setKpi] = useState<KpiRow>(MOCK_KPI);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/smart-timing-final?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.orders)) setOrders(d.orders);
        if (d.kpi) setKpi(d.kpi);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const sorted = [...orders].sort((a, b) => a.deadline_ms - b.deadline_ms);
  const ueberfaellig = sorted.filter(o => o.status !== 'fertig' && now > o.deadline_ms);

  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Smart-Timing · Countdown & Farbkodierung Final</span>
        {ueberfaellig.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> {ueberfaellig.length} überfällig
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: 'On-Time', value: `${kpi.on_time_pct}%`, good: kpi.on_time_pct >= 85, icon: <CheckCircle2 className="h-3 w-3" /> },
          { label: 'Ø Prep', value: `${kpi.avg_prep_min}m`, good: kpi.avg_prep_min <= 14, icon: <Clock className="h-3 w-3" /> },
          { label: 'Kochstart', value: kpi.kochstart_score, good: kpi.kochstart_score >= 78, icon: <Zap className="h-3 w-3" /> },
          { label: 'Überfällig', value: kpi.ueberfaellig, good: kpi.ueberfaellig === 0, icon: <AlertTriangle className="h-3 w-3" /> },
          { label: 'Sync', value: `${kpi.sync_score}%`, good: kpi.sync_score >= 70, icon: <TrendingUp className="h-3 w-3" /> },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-slate-50 p-1.5 text-center">
            <div className={`flex items-center justify-center mb-0.5 ${k.good ? 'text-emerald-600' : 'text-red-500'}`}>{k.icon}</div>
            <div className={`text-xs font-bold tabular-nums ${k.good ? 'text-emerald-700' : 'text-red-600'}`}>{k.value}</div>
            <div className="text-[9px] text-slate-400 leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Score-Balken */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
          <span>Kochstart-Score</span><span>{kpi.kochstart_score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${kpi.kochstart_score >= 80 ? 'bg-emerald-500' : kpi.kochstart_score >= 65 ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${kpi.kochstart_score}%` }}
          />
        </div>
      </div>

      {/* Countdown-Kacheln */}
      <div className="space-y-1.5">
        {sorted.map(o => {
          const restSek = Math.round((o.deadline_ms - now) / 1000);
          const kochstartSek = Math.round((o.kochstart_ms - now) / 1000);
          const c = farbeKodierung(restSek, o.status);
          const maxSek = 20 * 60;
          const pct = o.status === 'fertig' ? 100 : Math.max(2, Math.min(100, ((maxSek - Math.max(0, restSek)) / maxSek) * 100));
          const fahrerSek = o.fahrer_eta_ms ? Math.round((o.fahrer_eta_ms - now) / 1000) : null;
          return (
            <div key={o.id} className={`rounded-lg border p-2 ${c.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                  <span className="text-xs font-semibold text-slate-700">{o.bestellnummer}</span>
                  <span className={`text-[9px] rounded px-1 py-0.5 font-bold ${c.txt} bg-white/60`}>{c.label}</span>
                  <span className="text-[9px] text-slate-400">K{o.komplexitaet}</span>
                </div>
                <div className={`text-sm font-bold tabular-nums ${c.txt}`}>
                  {o.status === 'fertig' ? '✓ Fertig' : fmtSek(restSek)}
                </div>
              </div>
              <div className="h-1 rounded-full bg-white/50 overflow-hidden">
                <div className={`h-full rounded-full ${c.bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                {o.status !== 'fertig' && kochstartSek > 0 && (
                  <span className="text-[10px] text-slate-500">Kochstart in {Math.ceil(kochstartSek / 60)} Min</span>
                )}
                {fahrerSek !== null && fahrerSek > 0 && (
                  <span className="text-[10px] text-blue-600 ml-auto">🚴 {Math.ceil(fahrerSek / 60)} Min</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <Timer className="h-3 w-3" />
        <span>Echtzeit · Farbkodierung: grün/gelb/orange/rot · 15-Sek-Polling</span>
      </div>
    </div>
  );
}
