'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { RefreshCw, BarChart3 } from 'lucide-react';

interface DailyKpis {
  date: string;
  orders: {
    total: number;
    delivery: number;
    pickup: number;
    completed: number;
    cancelled: number;
  };
  revenue: {
    total: number | null;
    delivery: number | null;
  };
  activeDrivers: number;
}

interface DriverPeriodStat {
  driverId: string;
  driverName: string | null;
  deliveries: number;
  onTimeRate: number | null;
  avgRating: number | null;
  earningsEur: number;
}

interface PeriodReport {
  locationId: string;
  periodType: string;
  from: string;
  to: string;
  summary: {
    totalOrders: number;
    totalRevenue: number | null;
    avgDailyOrders: number;
    onTimePct: number | null;
    avgRating: number | null;
  };
  dailyBreakdown: DailyKpis[];
  topDrivers: DriverPeriodStat[];
}

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Täglich', days: 7 },
  { value: 'weekly', label: 'Wöchentlich', days: 28 },
  { value: 'monthly', label: 'Monatlich', days: 90 },
];

export function ReportingClient({ locationId }: { locationId: string }) {
  const [mode, setMode] = useState<'daily' | 'period'>('daily');
  const [periodType, setPeriodType] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyKpis, setDailyKpis] = useState<DailyKpis | null>(null);
  const [period, setPeriod] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDaily = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/reporting?type=daily&location_id=${locationId}&date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.date) setDailyKpis(d as DailyKpis); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadPeriod = () => {
    const opt = PERIOD_OPTIONS.find(p => p.value === periodType) ?? PERIOD_OPTIONS[0];
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - opt.days * 86400_000).toISOString().slice(0, 10);
    setLoading(true);
    fetch(`/api/delivery/admin/reporting?type=period&location_id=${locationId}&period_type=${periodType}&from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setPeriod(d as PeriodReport); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (mode === 'daily') loadDaily();
    else loadPeriod();
  }, [locationId, mode, date, periodType]);

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['daily', 'period'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              mode === m ? 'bg-matcha-700 border-matcha-700 text-white' : 'bg-card border-border text-muted-foreground hover:bg-muted')}>
            {m === 'daily' ? 'Tagesbericht' : 'Perioden-Report'}
          </button>
        ))}
        <button onClick={() => mode === 'daily' ? loadDaily() : loadPeriod()} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Laden
        </button>
      </div>

      {/* Daily mode */}
      {mode === 'daily' && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-muted-foreground">Datum</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-matcha-500" />
          </div>

          {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Tages-KPIs…</div>}

          {!loading && dailyKpis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Bestellungen</div>
                  <div className="font-display text-2xl font-black">{dailyKpis.orders.total}</div>
                  <div className="text-[11px] text-muted-foreground">{dailyKpis.orders.completed} abgeschlossen · {dailyKpis.orders.cancelled} storniert</div>
                </div>
                <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Umsatz</div>
                  <div className="font-display text-2xl font-black text-matcha-700">{dailyKpis.revenue.total !== null ? euro(dailyKpis.revenue.total) : '—'}</div>
                  <div className="text-[11px] text-muted-foreground">Lieferung: {dailyKpis.revenue.delivery !== null ? euro(dailyKpis.revenue.delivery) : '—'}</div>
                </div>
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Lieferungen</div>
                  <div className="font-display text-2xl font-black">{dailyKpis.orders.delivery}</div>
                </div>
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fahrer aktiv</div>
                  <div className="font-display text-2xl font-black">{dailyKpis.activeDrivers}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Period mode */}
      {mode === 'period' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriodType(opt.value)}
                className={cn('rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
                  periodType === opt.value ? 'bg-matcha-700 border-matcha-700 text-white' : 'bg-card border-border text-muted-foreground hover:bg-muted')}>
                {opt.label}
              </button>
            ))}
          </div>

          {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Perioden-Report…</div>}

          {!loading && period && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Bestellungen</div>
                  <div className="font-display text-2xl font-black">{period.summary.totalOrders}</div>
                  <div className="text-[11px] text-muted-foreground">Ø {period.summary.avgDailyOrders.toFixed(1)}/Tag</div>
                </div>
                <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Umsatz</div>
                  <div className="font-display text-2xl font-black text-matcha-700">
                    {period.summary.totalRevenue !== null ? euro(period.summary.totalRevenue) : '—'}
                  </div>
                </div>
                <div className={cn('rounded-xl border px-4 py-3', (period.summary.onTimePct ?? 100) >= 90 ? 'bg-matcha-50 border-matcha-200' : 'bg-amber-50 border-amber-200')}>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">On-Time</div>
                  <div className={cn('font-display text-2xl font-black', (period.summary.onTimePct ?? 100) >= 90 ? 'text-matcha-700' : 'text-amber-700')}>
                    {period.summary.onTimePct !== null ? `${period.summary.onTimePct.toFixed(0)} %` : '—'}
                  </div>
                </div>
                <div className="rounded-xl border bg-card px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Bewertung</div>
                  <div className="font-display text-2xl font-black">
                    {period.summary.avgRating !== null ? period.summary.avgRating.toFixed(1) : '—'}
                  </div>
                </div>
              </div>

              {/* Daily breakdown bar chart */}
              {period.dailyBreakdown.length > 0 && (
                <div className="rounded-xl border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2 font-display font-bold text-sm">
                    <BarChart3 className="h-4 w-4 text-matcha-700" /> Tagesverlauf (Bestellungen)
                  </div>
                  <div className="flex items-end gap-1 h-24">
                    {(() => {
                      const max = Math.max(...period.dailyBreakdown.map(d => d.orders.total), 1);
                      return period.dailyBreakdown.map(d => (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                          <div className="w-full bg-matcha-500 rounded-t-sm transition hover:bg-matcha-700"
                            style={{ height: `${Math.max((d.orders.total / max) * 88, 2)}px` }} />
                          <div className="text-[8px] text-muted-foreground">{new Date(d.date).getDate()}</div>
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-popover border rounded px-1.5 py-0.5 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                            {d.orders.total}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {/* Top drivers */}
              {period.topDrivers.length > 0 && (
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b font-display font-bold text-sm">Top-Fahrer</div>
                  <div className="divide-y divide-border">
                    {period.topDrivers.slice(0, 5).map((d, i) => (
                      <div key={d.driverId} className="px-4 py-2.5 flex items-center gap-3">
                        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0',
                          i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-500' : 'bg-muted-foreground')}>
                          {i + 1}
                        </div>
                        <div className="flex-1 text-sm font-medium">{d.driverName ?? d.driverId.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{d.deliveries} Touren</div>
                        {d.onTimeRate !== null && (
                          <div className="text-xs font-bold text-matcha-700">{d.onTimeRate.toFixed(0)} %</div>
                        )}
                        <div className="text-xs font-bold">{euro(d.earningsEur)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
