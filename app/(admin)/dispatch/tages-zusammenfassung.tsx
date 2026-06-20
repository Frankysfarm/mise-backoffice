'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus, Loader2, Car, Clock, Target, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayAnalytics {
  totalTours: number;
  avgScore: number;
  onTimeRate: number;
  activeDrivers: number;
}

const MOCK_DATA: DayAnalytics = {
  totalTours: 12,
  avgScore: 78,
  onTimeRate: 85,
  activeDrivers: 4,
};

// Mock hourly sparkline data (8 hours)
const MOCK_HOURLY = [
  { stunde: '10h', touren: 1 },
  { stunde: '11h', touren: 2 },
  { stunde: '12h', touren: 4 },
  { stunde: '13h', touren: 3 },
  { stunde: '14h', touren: 2 },
  { stunde: '15h', touren: 1 },
  { stunde: '16h', touren: 3 },
  { stunde: '17h', touren: 5 },
];

function onTimeColor(rate: number): string {
  if (rate >= 80) return 'text-matcha-700';
  if (rate >= 60) return 'text-amber-700';
  return 'text-red-600';
}

function onTimeBadgeClass(rate: number): string {
  if (rate >= 80) return 'bg-matcha-100 text-matcha-700';
  if (rate >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

function barFill(stunde: string, maxVal: number, val: number): string {
  const ratio = maxVal > 0 ? val / maxVal : 0;
  if (ratio >= 0.8) return '#2d6b45';
  if (ratio >= 0.5) return '#55a47c';
  return '#b7ddc7';
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: string;
}

function KpiCard({ icon: Icon, label, value, sub, highlight }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 text-matcha-500" />
        {label}
      </div>
      <div className={cn('text-2xl font-black tabular-nums', highlight ?? 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DispatchTagesZusammenfassung({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DayAnalytics>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/analytics?location_id=${encodeURIComponent(locationId)}&period=today`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && typeof json.totalTours === 'number') {
          setData({
            totalTours: json.totalTours ?? MOCK_DATA.totalTours,
            avgScore: json.avgScore ?? MOCK_DATA.avgScore,
            onTimeRate: json.onTimeRate ?? MOCK_DATA.onTimeRate,
            activeDrivers: json.activeDrivers ?? MOCK_DATA.activeDrivers,
          });
        }
        setLastUpdated(new Date());
      })
      .catch(() => {
        setLastUpdated(new Date());
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 90_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const maxHourly = Math.max(...MOCK_HOURLY.map((h) => h.touren), 1);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-matcha-50">
        <Calendar className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-black text-matcha-800">Tages-Übersicht</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        {lastUpdated && !loading && (
          <span className="ml-auto text-[9px] text-muted-foreground">
            Aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiCard
            icon={Route}
            label="Touren heute"
            value={data.totalTours}
            sub="Gesamt abgeschlossen"
          />
          <KpiCard
            icon={Target}
            label="Ø Score"
            value={`${data.avgScore}`}
            sub="von 100 Punkten"
            highlight={data.avgScore >= 80 ? 'text-matcha-700' : data.avgScore >= 60 ? 'text-amber-700' : 'text-red-600'}
          />
          <KpiCard
            icon={Clock}
            label="Pünktlichkeit"
            value={`${data.onTimeRate}%`}
            sub="On-Time-Rate"
            highlight={onTimeColor(data.onTimeRate)}
          />
          <KpiCard
            icon={Car}
            label="Aktive Fahrer"
            value={data.activeDrivers}
            sub="Derzeit im Einsatz"
          />
        </div>

        {/* On-time status badge */}
        <div className={cn('rounded-lg px-3 py-2 text-xs font-bold', onTimeBadgeClass(data.onTimeRate))}>
          {data.onTimeRate >= 80
            ? `Pünktlichkeit gut: ${data.onTimeRate}% der Touren on-time`
            : data.onTimeRate >= 60
            ? `Pünktlichkeit mäßig: ${data.onTimeRate}% — Optimierung empfohlen`
            : `Pünktlichkeit kritisch: nur ${data.onTimeRate}% on-time`}
        </div>

        {/* Hourly bar chart */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground mb-2">
            Touren pro Stunde (heute)
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_HOURLY} barCategoryGap="20%">
                <XAxis
                  dataKey="stunde"
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: unknown) => [`${Number(val)} Touren`, '']}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="touren" radius={[4, 4, 0, 0]}>
                  {MOCK_HOURLY.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={barFill(entry.stunde, maxHourly, entry.touren)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
