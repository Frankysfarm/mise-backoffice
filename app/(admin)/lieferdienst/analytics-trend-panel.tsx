'use client';

/**
 * LieferdienstAnalyticsTrendPanel — 30-Tage-Trend-Analyse für Lieferdienst-Cockpit.
 *
 * Zeigt aus dem Delivery Analytics Dashboard (Phase 320):
 *  - Heutige KPI-Übersicht (SLA%, ø Lieferzeit, Lieferrate, Stornoquote)
 *  - 30-Tage-Trend als Linien-Chart (SLA% + ø Lieferzeit)
 *  - Top-3-Fahrer der Woche (Lieferungen, ø Zeit, On-Time%)
 *
 * Polling alle 5 Minuten auf /api/delivery/admin/analytics?action=dashboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { BarChart2, RefreshCw, Trophy, Clock, CheckCircle2, Package, XCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Snapshot {
  analyticsDate: string;
  slaCompliancePct: number | null;
  avgDeliveryMin: number | null;
  deliveryRate: number | null;
  cancellationRate: number | null;
  completedDeliveries: number;
  totalOrders: number;
}

interface TopDriver {
  name: string | null;
  deliveries: number;
  onTimePct: number | null;
  avgDeliveryMin: number | null;
}

interface DashData {
  today: Snapshot;
  trend30: Snapshot[];
  topDrivers: TopDriver[];
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function KpiChip({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5 rounded-xl p-3', color)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
        {icon}
        {label}
      </div>
      <div className="text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

export function LieferdienstAnalyticsTrendPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/analytics?action=dashboard&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (json?.today) setData(json as DashData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!locationId) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Analytics · 30-Tage-Trend</span>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:bg-muted/40 transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Lade Analytics…</span>
        </div>
      )}

      {data && (
        <div className="p-5 space-y-5">
          {/* Today's KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiChip
              icon={<CheckCircle2 className="h-3 w-3" />}
              label="SLA heute"
              value={data.today.slaCompliancePct != null ? `${data.today.slaCompliancePct.toFixed(1)}%` : '—'}
              color={
                data.today.slaCompliancePct == null ? 'bg-muted/40 text-muted-foreground'
                  : data.today.slaCompliancePct >= 90 ? 'bg-matcha-50 text-matcha-700'
                  : data.today.slaCompliancePct >= 70 ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
              }
            />
            <KpiChip
              icon={<Clock className="h-3 w-3" />}
              label="Ø Lieferzeit"
              value={data.today.avgDeliveryMin != null ? `${data.today.avgDeliveryMin.toFixed(0)} Min` : '—'}
              color="bg-blue-50 text-blue-700"
            />
            <KpiChip
              icon={<Package className="h-3 w-3" />}
              label="Lieferrate"
              value={data.today.deliveryRate != null ? `${data.today.deliveryRate.toFixed(1)}%` : '—'}
              color="bg-stone-50 text-stone-700"
            />
            <KpiChip
              icon={<XCircle className="h-3 w-3" />}
              label="Stornoquote"
              value={data.today.cancellationRate != null ? `${data.today.cancellationRate.toFixed(1)}%` : '—'}
              color={
                data.today.cancellationRate == null ? 'bg-muted/40 text-muted-foreground'
                  : data.today.cancellationRate <= 5 ? 'bg-matcha-50 text-matcha-700'
                  : data.today.cancellationRate <= 10 ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
              }
            />
          </div>

          {/* 30-day trend chart */}
          {data.trend30.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                30-Tage-Verlauf
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart
                  data={[...data.trend30].reverse().map(s => ({
                    date: fmtDate(s.analyticsDate),
                    sla: s.slaCompliancePct,
                    min: s.avgDeliveryMin,
                  }))}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                    formatter={(value: unknown, name: unknown) => {
                      const v = typeof value === 'number' ? value : 0
                      const n = String(name ?? '')
                      return n === 'SLA (%)' ? [`${v.toFixed(1)}%`, n] : [`${v.toFixed(0)} Min`, n]
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="sla" name="SLA (%)" stroke="#4d7c0f" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="min" name="Ø Zeit (Min)" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Drivers */}
          {data.topDrivers.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Trophy className="h-3 w-3 text-amber-500" />
                Top-Fahrer
              </div>
              <div className="space-y-1.5">
                {data.topDrivers.slice(0, 5).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                      i === 0 ? 'bg-amber-400 text-white'
                        : i === 1 ? 'bg-stone-300 text-white'
                        : i === 2 ? 'bg-orange-300 text-white'
                        : 'bg-stone-100 text-stone-500',
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-xs font-bold">{d.name ?? 'Fahrer'}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{d.deliveries} Ltg.</span>
                    {d.onTimePct != null && (
                      <span className={cn(
                        'text-[11px] font-bold tabular-nums',
                        d.onTimePct >= 90 ? 'text-matcha-600' : d.onTimePct >= 70 ? 'text-amber-600' : 'text-red-500',
                      )}>
                        {d.onTimePct.toFixed(0)}%
                      </span>
                    )}
                    {d.avgDeliveryMin != null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        Ø {d.avgDeliveryMin.toFixed(0)} Min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.trend30.length === 0 && data.topDrivers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Noch keine historischen Analysedaten vorhanden. Daten werden täglich aggregiert.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
