'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface SlaStats {
  totalStops: number;
  onTimeCount: number;
  lateCount: number;
  onTimePct: number;
  avgDeviationMin: number;
  avgDeliveryMin: number;
}

interface SlaData {
  summary: SlaStats;
  byDriver: Record<string, SlaStats & { driverName?: string }>;
  byZone: Record<string, SlaStats>;
  days: number;
  since: string;
  _fallback?: boolean;
  _hint?: string;
}

const DAYS_OPTIONS = [7, 14, 30] as const;

function pctColor(pct: number) {
  if (pct >= 90) return 'text-matcha-700 bg-matcha-50 border-matcha-200';
  if (pct >= 75) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: string }) {
  return (
    <div className={cn('rounded-xl border px-4 py-3', highlight ?? 'border-border bg-card')}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="font-display text-2xl font-black">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function SlaRow({ label, stats }: { label: string; stats: SlaStats }) {
  const pct = Math.round(stats.onTimePct);
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-4 text-sm font-medium truncate max-w-[160px]">{label}</td>
      <td className="py-2.5 pr-4 text-sm tabular-nums">{stats.totalStops}</td>
      <td className="py-2.5 pr-4">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', pctColor(pct))}>
          {pct}%
        </span>
      </td>
      <td className="py-2.5 pr-4 text-sm tabular-nums text-muted-foreground">
        {stats.avgDeviationMin > 0 ? `+${Math.round(stats.avgDeviationMin)}` : Math.round(stats.avgDeviationMin)} Min
      </td>
      <td className="py-2.5 text-sm tabular-nums text-muted-foreground">
        {Math.round(stats.avgDeliveryMin)} Min
      </td>
    </tr>
  );
}

export function SlaClient({ locationId }: { locationId: string }) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [data, setData] = useState<SlaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setData(d as SlaData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, days]);

  return (
    <div className="space-y-6">
      {/* Zeitraum-Auswahl */}
      <div className="flex items-center gap-2">
        {DAYS_OPTIONS.map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              days === d ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {d} Tage
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {data?.since ? `seit ${new Date(data.since).toLocaleDateString('de-DE')}` : ''}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade SLA-Daten…</div>
      )}

      {!loading && data?._fallback && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{data._hint ?? 'Noch keine Daten für diesen Zeitraum.'}</div>
        </div>
      )}

      {!loading && data && !data._fallback && (
        <>
          {/* Zusammenfassung KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Stopps gesamt"
              value={String(data.summary.totalStops)}
              highlight="border-border bg-card"
            />
            <KpiCard
              label="On-Time-Rate"
              value={`${Math.round(data.summary.onTimePct)}%`}
              sub={`${data.summary.onTimeCount} pünktlich · ${data.summary.lateCount} spät`}
              highlight={pctColor(Math.round(data.summary.onTimePct))}
            />
            <KpiCard
              label="Ø Abweichung"
              value={`${data.summary.avgDeviationMin > 0 ? '+' : ''}${Math.round(data.summary.avgDeviationMin)} Min`}
              sub="positiv = zu spät"
            />
            <KpiCard
              label="Ø Lieferzeit"
              value={`${Math.round(data.summary.avgDeliveryMin)} Min`}
              sub="Übergabe bis Tür"
            />
          </div>

          {/* Nach Zone */}
          {Object.keys(data.byZone).length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">SLA nach Zone</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full px-4">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <th className="text-left px-4 py-2">Zone</th>
                      <th className="text-left px-4 py-2">Stopps</th>
                      <th className="text-left px-4 py-2">On-Time</th>
                      <th className="text-left px-4 py-2">Abweichung</th>
                      <th className="text-left px-4 py-2">Ø Lieferzeit</th>
                    </tr>
                  </thead>
                  <tbody className="px-4">
                    {Object.entries(data.byZone)
                      .sort(([, a], [, b]) => b.totalStops - a.totalStops)
                      .map(([zone, stats]) => (
                        <tr key={zone} className="border-t border-border">
                          <td className="py-2.5 px-4 text-sm font-medium">{zone || '(unbekannt)'}</td>
                          <td className="py-2.5 px-4 text-sm tabular-nums">{stats.totalStops}</td>
                          <td className="py-2.5 px-4">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', pctColor(Math.round(stats.onTimePct)))}>
                              {Math.round(stats.onTimePct)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-sm tabular-nums text-muted-foreground">
                            {stats.avgDeviationMin > 0 ? '+' : ''}{Math.round(stats.avgDeviationMin)} Min
                          </td>
                          <td className="py-2.5 px-4 text-sm tabular-nums text-muted-foreground">
                            {Math.round(stats.avgDeliveryMin)} Min
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Nach Fahrer */}
          {Object.keys(data.byDriver).length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Clock className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">SLA nach Fahrer</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Stopps</th>
                      <th className="text-left px-4 py-2">On-Time</th>
                      <th className="text-left px-4 py-2">Abweichung</th>
                      <th className="text-left px-4 py-2">Ø Lieferzeit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.byDriver)
                      .sort(([, a], [, b]) => b.totalStops - a.totalStops)
                      .map(([driverId, stats]) => (
                        <tr key={driverId} className="border-t border-border">
                          <td className="py-2.5 px-4 text-sm font-medium">{stats.driverName ?? driverId.slice(0, 8)}</td>
                          <td className="py-2.5 px-4 text-sm tabular-nums">{stats.totalStops}</td>
                          <td className="py-2.5 px-4">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold border', pctColor(Math.round(stats.onTimePct)))}>
                              {Math.round(stats.onTimePct)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-sm tabular-nums text-muted-foreground">
                            {stats.avgDeviationMin > 0 ? '+' : ''}{Math.round(stats.avgDeviationMin)} Min
                          </td>
                          <td className="py-2.5 px-4 text-sm tabular-nums text-muted-foreground">
                            {Math.round(stats.avgDeliveryMin)} Min
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.summary.totalStops === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <CheckCircle2 className="h-4 w-4" />
              Noch keine abgeschlossenen Lieferungen für diesen Zeitraum.
            </div>
          )}
        </>
      )}
    </div>
  );
}
