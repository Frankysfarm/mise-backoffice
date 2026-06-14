'use client';

/**
 * SlaLivePanel — Live SLA-Monitor für den Dispatch.
 *
 * Zeigt die aktuelle Pünktlichkeitsrate (SLA) für:
 *  - Gesamte Schicht (seit Schichtbeginn)
 *  - Letzte 60 Min (rollendes Fenster)
 *  - Letzte 30 Min (rollendes Fenster)
 *  - Aufschlüsselung nach Zone (Top 4)
 *
 * Ampelfarbe: ≥90% grün, 75–89% gelb, <75% rot
 * Lädt alle 60s neu + bei Realtime-Trigger.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Award, CheckCircle2, Clock, MapPin, TrendingDown, TrendingUp,
} from 'lucide-react';

type ZoneSla = { zone: string; total: number; onTime: number; pct: number };

type SlaData = {
  shiftPct: number | null;
  last60Pct: number | null;
  last30Pct: number | null;
  shiftTotal: number;
  shiftOnTime: number;
  trend: 'up' | 'down' | 'stable';
  zones: ZoneSla[];
};

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadSla(supabase: ReturnType<typeof createClient>): Promise<SlaData> {
  const now = new Date();
  const todayStart = startOfToday().toISOString();
  const ago60 = new Date(now.getTime() - 60 * 60_000).toISOString();
  const ago30 = new Date(now.getTime() - 30 * 60_000).toISOString();

  const { data } = await supabase
    .from('customer_orders')
    .select('id, geliefert_am, eta_latest, delivery_zone, bestellt_am')
    .eq('location_id', LOCATION_ID)
    .eq('typ', 'lieferung')
    .in('status', ['geliefert', 'abgeschlossen'])
    .gte('bestellt_am', todayStart)
    .not('geliefert_am', 'is', null)
    .not('eta_latest', 'is', null);

  const rows = (data ?? []) as {
    id: string;
    geliefert_am: string;
    eta_latest: string;
    delivery_zone: string | null;
    bestellt_am: string;
  }[];

  function isOnTime(row: (typeof rows)[0]) {
    return new Date(row.geliefert_am).getTime() <= new Date(row.eta_latest).getTime();
  }

  const shift = rows;
  const last60 = rows.filter(r => r.geliefert_am >= ago60);
  const last30 = rows.filter(r => r.geliefert_am >= ago30);

  const pct = (arr: typeof rows) =>
    arr.length >= 3 ? Math.round((arr.filter(isOnTime).length / arr.length) * 100) : null;

  // Trend: 30-60 vs 0-30
  const prevWindow = rows.filter(r => r.geliefert_am >= ago60 && r.geliefert_am < ago30);
  const prevPct = pct(prevWindow);
  const curPct = pct(last30);
  const trend: SlaData['trend'] =
    prevPct == null || curPct == null ? 'stable'
      : curPct > prevPct + 3 ? 'up'
      : curPct < prevPct - 3 ? 'down'
      : 'stable';

  // Zone-Aufschlüsselung
  const zoneMap = new Map<string, { total: number; onTime: number }>();
  for (const row of shift) {
    const z = row.delivery_zone ?? 'Unbekannt';
    const cur = zoneMap.get(z) ?? { total: 0, onTime: 0 };
    cur.total++;
    if (isOnTime(row)) cur.onTime++;
    zoneMap.set(z, cur);
  }
  const zones: ZoneSla[] = [...zoneMap.entries()]
    .map(([zone, v]) => ({ zone, ...v, pct: Math.round((v.onTime / v.total) * 100) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    shiftPct: pct(shift),
    last60Pct: pct(last60),
    last30Pct: pct(last30),
    shiftTotal: shift.length,
    shiftOnTime: shift.filter(isOnTime).length,
    trend,
    zones,
  };
}

function SlaGauge({ pct, label, size = 'md' }: { pct: number | null; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const quality = pct == null ? null : pct >= 90 ? 'good' : pct >= 75 ? 'warn' : 'bad';
  const color =
    quality === 'good' ? '#22c55e' :
    quality === 'warn' ? '#f59e0b' :
    quality === 'bad' ? '#ef4444' : '#94a3b8';
  const textClass =
    quality === 'good' ? 'text-matcha-700' :
    quality === 'warn' ? 'text-amber-700' :
    quality === 'bad' ? 'text-red-700' : 'text-stone-500';

  const r = size === 'lg' ? 30 : size === 'md' ? 22 : 16;
  const svgSize = r * 2 + 10;
  const circ = 2 * Math.PI * r;
  const dash = pct != null ? (pct / 100) * circ : 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} className="-rotate-90">
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={r}
          fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={size === 'lg' ? 6 : 4}
        />
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={r}
          fill="none" stroke={color} strokeWidth={size === 'lg' ? 6 : 4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - dash}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s' }}
        />
      </svg>
      <div className={cn('font-mono font-black tabular-nums leading-none', textClass,
        size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm',
      )}>
        {pct != null ? `${pct}%` : '–'}
      </div>
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide text-center">{label}</div>
    </div>
  );
}

export function SlaLivePanel() {
  const [data, setData] = useState<SlaData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function refresh() {
    const d = await loadSla(supabase).catch(() => null);
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    const ch = supabase
      .channel('sla-panel-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refresh)
      .subscribe();
    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 animate-spin" />
        SLA wird geladen…
      </div>
    );
  }

  if (!data) return null;

  const shiftQuality = data.shiftPct == null ? null : data.shiftPct >= 90 ? 'good' : data.shiftPct >= 75 ? 'warn' : 'bad';

  return (
    <div className={cn(
      'rounded-xl border bg-card p-3 space-y-3 transition-colors',
      shiftQuality === 'bad' ? 'border-red-200' :
      shiftQuality === 'warn' ? 'border-amber-200' :
      shiftQuality === 'good' ? 'border-matcha-200' : 'border-border',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold">SLA Live-Monitor</span>
          {shiftQuality === 'bad' && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
              <AlertTriangle className="h-3 w-3" /> Unter Ziel
            </span>
          )}
          {shiftQuality === 'good' && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
              <CheckCircle2 className="h-3 w-3" /> Ziel erreicht
            </span>
          )}
        </div>
        {/* Trend */}
        {data.trend !== 'stable' && (
          <span className={cn(
            'flex items-center gap-1 text-[10px] font-black',
            data.trend === 'up' ? 'text-matcha-600' : 'text-red-600',
          )}>
            {data.trend === 'up'
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />}
            {data.trend === 'up' ? 'Besser' : 'Schlechter'} (30 Min)
          </span>
        )}
      </div>

      {/* Gauges */}
      <div className="flex items-start justify-around gap-2">
        <SlaGauge pct={data.shiftPct} label="Schicht" size="lg" />
        <SlaGauge pct={data.last60Pct} label="Letzte 60 Min" size="md" />
        <SlaGauge pct={data.last30Pct} label="Letzte 30 Min" size="md" />
      </div>

      {/* Gesamtzahl */}
      {data.shiftTotal > 0 && (
        <div className="text-center text-[10px] text-muted-foreground">
          <span className="font-bold text-matcha-700">{data.shiftOnTime}</span>
          {' '}von{' '}
          <span className="font-bold">{data.shiftTotal}</span>
          {' '}Lieferungen pünktlich (Ziel: ≥90%)
        </div>
      )}

      {/* Zone-Aufschlüsselung */}
      {data.zones.length > 0 && (
        <div className="space-y-1.5 border-t pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
            <MapPin className="h-3 w-3" />
            Zone-SLA
          </div>
          {data.zones.map(z => {
            const q = z.pct >= 90 ? 'good' : z.pct >= 75 ? 'warn' : 'bad';
            const barColor = q === 'good' ? 'bg-matcha-500' : q === 'warn' ? 'bg-amber-400' : 'bg-red-500';
            const textColor = q === 'good' ? 'text-matcha-700' : q === 'warn' ? 'text-amber-700' : 'text-red-700';
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="w-20 text-[10px] font-semibold truncate text-muted-foreground">{z.zone}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', barColor)}
                    style={{ width: `${z.pct}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-black w-10 text-right tabular-nums', textColor)}>
                  {z.pct}%
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums w-8 text-right">
                  {z.onTime}/{z.total}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground border-t pt-2 flex-wrap">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500" />≥90% Ziel</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />75–89%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />&lt;75% Alarm</span>
        <span className="ml-auto">Aktualisiert alle 60s</span>
      </div>
    </div>
  );
}
