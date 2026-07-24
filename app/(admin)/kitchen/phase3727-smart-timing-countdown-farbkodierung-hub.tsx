'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Zap, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

interface OrderTiming {
  id: string;
  bestellnummer: string;
  prep_deadline_ms: number; // Unix ms when order must be ready
  kochstart_empfohlen_ms: number;
  status: 'wartend' | 'in_arbeit' | 'fertig';
  artikel_anzahl: number;
  zone: string;
}

interface KpiData {
  on_time_rate: number;
  avg_prep_min: number;
  kochstart_score: number;
  ueberfaellig: number;
}

const MOCK_ORDERS: OrderTiming[] = [
  { id: '1', bestellnummer: 'FF-4201', prep_deadline_ms: Date.now() + 8 * 60000, kochstart_empfohlen_ms: Date.now() + 2 * 60000, status: 'in_arbeit', artikel_anzahl: 3, zone: 'Mitte' },
  { id: '2', bestellnummer: 'FF-4202', prep_deadline_ms: Date.now() + 3 * 60000, kochstart_empfohlen_ms: Date.now() - 1 * 60000, status: 'wartend', artikel_anzahl: 5, zone: 'Nord' },
  { id: '3', bestellnummer: 'FF-4203', prep_deadline_ms: Date.now() - 2 * 60000, kochstart_empfohlen_ms: Date.now() - 8 * 60000, status: 'in_arbeit', artikel_anzahl: 2, zone: 'Süd' },
  { id: '4', bestellnummer: 'FF-4204', prep_deadline_ms: Date.now() + 14 * 60000, kochstart_empfohlen_ms: Date.now() + 7 * 60000, status: 'wartend', artikel_anzahl: 4, zone: 'West' },
  { id: '5', bestellnummer: 'FF-4205', prep_deadline_ms: Date.now() + 1 * 60000, kochstart_empfohlen_ms: Date.now() - 4 * 60000, status: 'in_arbeit', artikel_anzahl: 6, zone: 'Ost' },
];

const MOCK_KPI: KpiData = { on_time_rate: 82, avg_prep_min: 14.2, kochstart_score: 76, ueberfaellig: 2 };

function getColorClass(restSek: number, status: string) {
  if (status === 'fertig') return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500', dot: 'bg-emerald-500' };
  if (restSek < 0) return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', bar: 'bg-red-500', dot: 'bg-red-500' };
  if (restSek < 3 * 60) return { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', bar: 'bg-orange-500', dot: 'bg-orange-500' };
  if (restSek < 7 * 60) return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', bar: 'bg-yellow-400', dot: 'bg-yellow-400' };
  return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-400', dot: 'bg-emerald-400' };
}

function fmtCountdown(sek: number): string {
  if (sek <= 0) return `-${Math.abs(Math.floor(sek / 60))}m ${Math.abs(sek % 60).toString().padStart(2, '0')}s`;
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function KitchenPhase3727SmartTimingCountdownFarbkodierungHub({ locationId }: { locationId: string | null }) {
  const [now, setNow] = useState(Date.now());
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK_ORDERS);
  const [kpi, setKpi] = useState<KpiData>(MOCK_KPI);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/smart-timing-countdown?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.orders) setOrders(d.orders);
        if (d.kpi) setKpi(d.kpi);
      }
    } catch {
      // Mock-Fallback bereits gesetzt
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 15000);
    return () => clearInterval(pollId);
  }, [load]);

  useEffect(() => {
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, []);

  const sorted = [...orders].sort((a, b) => a.prep_deadline_ms - b.prep_deadline_ms);
  const ueberfaellig = sorted.filter(o => o.status !== 'fertig' && now > o.prep_deadline_ms);

  const scoreColor = kpi.kochstart_score >= 85 ? 'text-emerald-600' : kpi.kochstart_score >= 70 ? 'text-yellow-600' : 'text-red-600';
  const onTimeColor = kpi.on_time_rate >= 90 ? 'text-emerald-600' : kpi.on_time_rate >= 75 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-gray-900 text-sm">Smart-Timing Countdown Hub</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`font-bold ${onTimeColor}`}>{kpi.on_time_rate}% On-Time</span>
          <span className={`font-bold ${scoreColor}`}>Score {kpi.kochstart_score}</span>
        </div>
      </div>

      {/* KPI-Leiste */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className={`text-lg font-black ${onTimeColor}`}>{kpi.on_time_rate}%</div>
          <div className="text-[10px] text-gray-500">On-Time-Rate</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-lg font-black text-gray-800">{kpi.avg_prep_min.toFixed(1)}m</div>
          <div className="text-[10px] text-gray-500">Ø Prep-Zeit</div>
        </div>
        <div className={`rounded-lg p-2 text-center ${ueberfaellig.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-lg font-black ${ueberfaellig.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>{ueberfaellig.length}</div>
          <div className="text-[10px] text-gray-500">Überfällig</div>
        </div>
      </div>

      {/* Überfällig-Alert */}
      {ueberfaellig.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span><strong>{ueberfaellig.length} Bestellung{ueberfaellig.length > 1 ? 'en' : ''}</strong> überschreitet Deadline!</span>
        </div>
      )}

      {/* Countdown-Kacheln */}
      <div className="space-y-2">
        {sorted.map(o => {
          const restSek = Math.round((o.prep_deadline_ms - now) / 1000);
          const totalSek = 20 * 60;
          const elapsedSek = totalSek - restSek;
          const pct = Math.min(100, Math.max(0, (elapsedSek / totalSek) * 100));
          const c = getColorClass(restSek, o.status);

          return (
            <div key={o.id} className={`rounded-lg border p-2.5 ${c.bg} ${c.border}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                  <span className="text-xs font-bold text-gray-800">{o.bestellnummer}</span>
                  <span className="text-[10px] text-gray-500">{o.zone} · {o.artikel_anzahl} Art.</span>
                </div>
                <div className="flex items-center gap-2">
                  {o.status === 'fertig' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className={`text-xs font-black tabular-nums ${c.text}`}>{fmtCountdown(restSek)}</span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    o.status === 'fertig' ? 'bg-emerald-100 text-emerald-700' :
                    o.status === 'in_arbeit' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{o.status === 'in_arbeit' ? 'in Arbeit' : o.status === 'fertig' ? 'fertig' : 'wartend'}</span>
                </div>
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${c.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 text-center">Farbkodierung: grün ≥7min · gelb 3–7min · orange &lt;3min · rot überfällig · 1-Sek-Tick + 15-Sek-Polling</div>
    </div>
  );
}
