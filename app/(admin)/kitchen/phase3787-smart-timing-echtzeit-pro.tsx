'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, CheckCircle2, AlertTriangle, Timer, TrendingUp } from 'lucide-react';

interface OrderRow {
  id: string;
  bestellnummer: string;
  deadline_ms: number;
  kochstart_ms: number;
  status: 'wartend' | 'in_arbeit' | 'fertig';
  komplexitaet: number; // 1-5
}

interface KpiRow {
  on_time_pct: number;
  avg_prep_min: number;
  kochstart_score: number;
  in_arbeit: number;
  ueberfaellig: number;
}

const MOCK_ORDERS: OrderRow[] = [
  { id: 'a1', bestellnummer: 'FF-5101', deadline_ms: Date.now() + 9 * 60000, kochstart_ms: Date.now() + 1 * 60000, status: 'wartend', komplexitaet: 3 },
  { id: 'a2', bestellnummer: 'FF-5102', deadline_ms: Date.now() + 4 * 60000, kochstart_ms: Date.now() - 2 * 60000, status: 'in_arbeit', komplexitaet: 5 },
  { id: 'a3', bestellnummer: 'FF-5103', deadline_ms: Date.now() - 1 * 60000, kochstart_ms: Date.now() - 9 * 60000, status: 'in_arbeit', komplexitaet: 2 },
  { id: 'a4', bestellnummer: 'FF-5104', deadline_ms: Date.now() + 16 * 60000, kochstart_ms: Date.now() + 8 * 60000, status: 'wartend', komplexitaet: 4 },
  { id: 'a5', bestellnummer: 'FF-5105', deadline_ms: Date.now() + 2 * 60000, kochstart_ms: Date.now() - 5 * 60000, status: 'in_arbeit', komplexitaet: 1 },
];
const MOCK_KPI: KpiRow = { on_time_pct: 84, avg_prep_min: 13.8, kochstart_score: 79, in_arbeit: 3, ueberfaellig: 1 };

function fmtSek(sek: number) {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sek < 0 ? '-' : ''}${m}m ${s.toString().padStart(2, '0')}s`;
}

function farbe(restSek: number, status: string) {
  if (status === 'fertig') return { bg: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' };
  if (restSek < 0)      return { bg: 'bg-red-50 border-red-300',      txt: 'text-red-700',     bar: 'bg-red-500',     dot: 'bg-red-500' };
  if (restSek < 180)    return { bg: 'bg-orange-50 border-orange-300', txt: 'text-orange-700',  bar: 'bg-orange-500',  dot: 'bg-orange-500' };
  if (restSek < 420)    return { bg: 'bg-yellow-50 border-yellow-200', txt: 'text-yellow-700',  bar: 'bg-yellow-400',  dot: 'bg-yellow-400' };
  return                       { bg: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700', bar: 'bg-emerald-400', dot: 'bg-emerald-400' };
}

export function KitchenPhase3787SmartTimingEchtzeitPro({ locationId }: { locationId: string | null }) {
  const [now, setNow] = useState(Date.now());
  const [orders, setOrders] = useState<OrderRow[]>(MOCK_ORDERS);
  const [kpi, setKpi] = useState<KpiRow>(MOCK_KPI);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/smart-timing-echtzeit?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.orders) setOrders(d.orders);
        if (d.kpi) setKpi(d.kpi);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const sorted = [...orders].sort((a, b) => a.deadline_ms - b.deadline_ms);
  const ueberfaellig = sorted.filter(o => o.status !== 'fertig' && now > o.deadline_ms);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-indigo-600" />
        <span className="font-semibold text-sm text-slate-800">Smart-Timing Echtzeit Pro</span>
        {ueberfaellig.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" /> {ueberfaellig.length} überfällig
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'On-Time', value: `${kpi.on_time_pct}%`, icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />, good: kpi.on_time_pct >= 80 },
          { label: 'Ø Prep', value: `${kpi.avg_prep_min}min`, icon: <Clock className="h-3.5 w-3.5 text-blue-500" />, good: kpi.avg_prep_min <= 15 },
          { label: 'Kochstart-Score', value: kpi.kochstart_score, icon: <Zap className="h-3.5 w-3.5 text-amber-500" />, good: kpi.kochstart_score >= 75 },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-slate-50 p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">{k.icon}</div>
            <div className={`text-sm font-bold ${k.good ? 'text-emerald-700' : 'text-red-600'}`}>{k.value}</div>
            <div className="text-[10px] text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Kochstart-Score-Bar */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
          <span>Kochstart-Score</span>
          <span>{kpi.kochstart_score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${kpi.kochstart_score >= 80 ? 'bg-emerald-500' : kpi.kochstart_score >= 65 ? 'bg-yellow-400' : 'bg-red-500'}`}
            style={{ width: `${kpi.kochstart_score}%` }}
          />
        </div>
      </div>

      {/* Order-Countdown-Liste */}
      <div className="space-y-1.5">
        {sorted.map(o => {
          const restSek = Math.round((o.deadline_ms - now) / 1000);
          const kochStartSek = Math.round((o.kochstart_ms - now) / 1000);
          const c = farbe(restSek, o.status);
          const maxSek = 20 * 60;
          const pct = o.status === 'fertig' ? 100 : Math.max(0, Math.min(100, ((maxSek - Math.max(0, restSek)) / maxSek) * 100));
          return (
            <div key={o.id} className={`rounded-lg border p-2 ${c.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <span className="text-xs font-semibold text-slate-700">{o.bestellnummer}</span>
                  <span className="text-[10px] text-slate-500">K{o.komplexitaet}</span>
                </div>
                <div className={`text-xs font-bold tabular-nums ${c.txt}`}>
                  {o.status === 'fertig' ? '✓ Fertig' : fmtSek(restSek)}
                </div>
              </div>
              <div className="h-1 rounded-full bg-white/60 overflow-hidden">
                <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              {o.status !== 'fertig' && kochStartSek > 0 && (
                <div className="mt-0.5 text-[10px] text-slate-500">
                  Kochstart empfohlen in {Math.ceil(kochStartSek / 60)}min
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <TrendingUp className="h-3 w-3" />
        <span>Live · alle 15 Sek. aktualisiert</span>
      </div>
    </div>
  );
}
