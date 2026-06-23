'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, RefreshCw, Star, TrendingDown, TrendingUp, Minus, User, Bike, Car } from 'lucide-react';

interface DriverSummary {
  driverId: string;
  driverName: string | null;
  vehicle: string | null;
  state: string;
  compositeScore: number;
  punctualityScore: number;
  ratingScore: number;
  gpsActivityScore: number;
  engagementScore: number;
  deliveriesLast30d: number;
  avgDeliveryMin: number | null;
  lastActiveAt: string | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'up' | 'stable' | 'down';
}

interface ApiData {
  ok: boolean;
  total: number;
  summaries: DriverSummary[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const GRADE_STYLE = {
  A: 'bg-matcha-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-600 text-white',
};

const STATE_STYLE: Record<string, string> = {
  available: 'bg-matcha-100 text-matcha-700 border-matcha-300',
  break:     'bg-amber-100 text-amber-700 border-amber-300',
  offline:   'bg-muted text-muted-foreground border-border',
};

const STATE_LABEL: Record<string, string> = {
  available: 'Verfügbar',
  break:     'Pause',
  offline:   'Offline',
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[9px] font-black tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'stable' | 'down' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function VehicleIcon({ vehicle }: { vehicle: string | null }) {
  if (vehicle === 'car') return <Car className="h-3.5 w-3.5" />;
  return <Bike className="h-3.5 w-3.5" />;
}

function DriverCard({ d }: { d: DriverSummary }) {
  const [open, setOpen] = useState(false);
  const stateKey = d.state in STATE_STYLE ? d.state : 'offline';

  return (
    <div className="border-b last:border-0">
      {/* Kompakt-Zeile */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        {/* Grade-Badge */}
        <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm', GRADE_STYLE[d.grade])}>
          {d.grade}
        </div>

        {/* Name + State */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm truncate">{d.driverName ?? 'Unbekannt'}</span>
            <VehicleIcon vehicle={d.vehicle} />
            <span className={cn('text-[9px] border rounded-full px-1.5 py-0.5 font-bold', STATE_STYLE[stateKey])}>
              {STATE_LABEL[stateKey] ?? d.state}
            </span>
          </div>
          {/* Score-Balken (mini) */}
          <div className="mt-1 flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden w-full">
            <div
              className={cn('h-full rounded-full transition-all duration-500', d.compositeScore >= 75 ? 'bg-matcha-500' : d.compositeScore >= 50 ? 'bg-amber-400' : 'bg-red-500')}
              style={{ width: `${d.compositeScore}%` }}
            />
          </div>
        </div>

        {/* Score + Trend */}
        <div className="shrink-0 flex items-center gap-1.5 text-right">
          <TrendIcon trend={d.trend} />
          <div>
            <div className="font-black text-lg tabular-nums leading-none">{d.compositeScore}</div>
            <div className="text-[8px] text-muted-foreground">Score</div>
          </div>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Detail-Aufklapp */}
      {open && (
        <div className="px-4 pb-3 bg-muted/10 border-t">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3">
            {/* Sub-Scores */}
            <div className="space-y-1.5">
              <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wide mb-1">Score-Komponenten</div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Pünktlichkeit</div>
                <ScoreBar score={d.punctualityScore} color="bg-matcha-500" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Kundenbewertung</div>
                <ScoreBar score={d.ratingScore} color="bg-blue-500" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">GPS-Aktivität</div>
                <ScoreBar score={d.gpsActivityScore} color="bg-purple-500" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Engagement</div>
                <ScoreBar score={d.engagementScore} color="bg-amber-500" />
              </div>
            </div>

            {/* KPIs */}
            <div>
              <div className="text-[9px] font-black text-muted-foreground uppercase tracking-wide mb-2">Kennzahlen (30 Tage)</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Lieferungen</span>
                  <span className="font-black text-sm tabular-nums">{d.deliveriesLast30d}</span>
                </div>
                {d.avgDeliveryMin !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">Ø Lieferzeit</span>
                    <span className="font-black text-sm tabular-nums">{d.avgDeliveryMin} Min</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Trend</span>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={d.trend} />
                    <span className="text-xs font-bold capitalize">
                      {d.trend === 'up' ? 'Steigend' : d.trend === 'down' ? 'Fallend' : 'Stabil'}
                    </span>
                  </div>
                </div>
                {d.lastActiveAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">Letztes GPS</span>
                    <span className="text-[10px] font-bold tabular-nums">
                      {Math.floor((Date.now() - new Date(d.lastActiveAt).getTime()) / 60_000)} Min
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DispatchFahrerScoreSummaryCard({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function load() {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/driver-score-summary?action=all&location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.ok) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const avgScore = data.summaries.length > 0
    ? Math.round(data.summaries.reduce((s, d) => s + d.compositeScore, 0) / data.summaries.length)
    : 0;

  const gradeCount = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const d of data.summaries) gradeCount[d.grade]++;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/10">
        <User className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Fahrer-Score-Überblick</span>
            <Badge variant="outline" className="text-[9px] font-bold">
              {data.total} Fahrer
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground">Ø Score: </span>
            <span className={cn(
              'font-black text-xs',
              avgScore >= 75 ? 'text-matcha-700' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600',
            )}>
              {avgScore}
            </span>
            <span className="text-[9px] text-muted-foreground">|</span>
            {Object.entries(gradeCount).map(([grade, count]) => count > 0 && (
              <span key={grade} className={cn('text-[9px] font-black px-1 py-0.5 rounded', GRADE_STYLE[grade as keyof typeof GRADE_STYLE])}>
                {grade}×{count}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Verteilung */}
      {!collapsed && (
        <>
          <div className="flex h-2">
            {(['A', 'B', 'C', 'D', 'F'] as const).map((g) => {
              const pct = data.total > 0 ? (gradeCount[g] / data.total) * 100 : 0;
              return pct > 0 ? (
                <div
                  key={g}
                  className={cn('h-full transition-all', GRADE_STYLE[g].split(' ')[0])}
                  style={{ width: `${pct}%` }}
                />
              ) : null;
            })}
          </div>

          {/* Fahrerliste */}
          <div>
            {data.summaries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Keine aktiven Fahrer
              </div>
            ) : (
              data.summaries.map((d) => <DriverCard key={d.driverId} d={d} />)
            )}
          </div>

          <div className="px-4 py-1.5 bg-muted/10 border-t">
            <p className="text-[9px] text-muted-foreground text-center">
              Aktualisiert: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} — Daten der letzten 30 Tage
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
