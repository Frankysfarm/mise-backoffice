'use client';

/**
 * KitchenCapacityDashboard — Phase 408
 *
 * Live-Kapazitäts-Dashboard für die Küche:
 *  - SVG-Gauge: Überlas-Score 0–100 (grün/amber/rot/lila)
 *  - Circuit-Breaker-Status-Badge mit Countdown bis Auto-Deaktivierung
 *  - Stündliche Trend-Kurve der letzten 48h (AreaChart)
 *  - Status-Breakdown letzte 2h (Pie-ähnliche Mini-Balken)
 *  - Circuit-Breaker manuell aktivieren/deaktivieren
 *  - 60s Polling
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, RefreshCw, ShieldAlert, ShieldCheck, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

type KitchenStatus = 'optimal' | 'busy' | 'overloaded' | 'circuit_open';

interface CapacitySnapshot {
  overloadScore:    number;
  status:           KitchenStatus;
  circuitActive:    boolean;
  activeOrders:     number;
  readyOrders:      number;
  ordersLastHour:   number;
  avgPrepMin:       number | null;
  capacityPct:      number;
}

interface CircuitBreaker {
  isActive:           boolean;
  activatedAt:        string | null;
  activatedBy:        string | null;
  autoDeactivateAt:   string | null;
  reason:             string | null;
  totalActivations:   number;
  consecutiveOverloadTicks: number;
}

interface Last1h {
  avgOverloadScore:  number;
  maxOverloadScore:  number;
  avgCapacityPct:    number;
  overloadedTicks:   number;
  snapshotCount:     number;
}

interface StatusBreakdown {
  optimal:     number;
  busy:        number;
  overloaded:  number;
  circuitOpen: number;
}

interface Dashboard {
  locationId:      string;
  generatedAt:     string;
  currentSnapshot: CapacitySnapshot | null;
  circuitBreaker:  CircuitBreaker | null;
  last1h:          Last1h | null;
  statusBreakdown: StatusBreakdown;
}

interface TrendRow {
  hourBucket:       string;
  avgOverloadScore: number;
  maxOverloadScore: number;
  avgCapacityPct:   number;
  overloadedTicks:  number;
  snapshotCount:    number;
}

interface Props {
  locationId: string | null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function statusColor(s: KitchenStatus) {
  switch (s) {
    case 'optimal':     return { bg: 'bg-matcha-50',  border: 'border-matcha-200', text: 'text-matcha-700',  fill: '#16a34a' };
    case 'busy':        return { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   fill: '#d97706' };
    case 'overloaded':  return { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     fill: '#dc2626' };
    case 'circuit_open': return { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700',  fill: '#7c3aed' };
  }
}

function statusLabel(s: KitchenStatus) {
  switch (s) {
    case 'optimal':      return 'Optimal';
    case 'busy':         return 'Auslastung hoch';
    case 'overloaded':   return 'Überlastet';
    case 'circuit_open': return 'Circuit-Breaker aktiv';
  }
}

function scoreGaugeColor(score: number): string {
  if (score < 30) return '#16a34a';
  if (score < 60) return '#d97706';
  if (score < 80) return '#dc2626';
  return '#7c3aed';
}

function formatMinutesLeft(isoStr: string): string {
  const diff = Math.floor((new Date(isoStr).getTime() - Date.now()) / 60_000);
  if (diff <= 0) return 'läuft ab';
  return `noch ${diff} Min`;
}

function formatHourBucket(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

// ── SVG Gauge ─────────────────────────────────────────────────────────────────

function ScoreGauge({ score, status }: { score: number; status: KitchenStatus }) {
  const r = 52;
  const cx = 72;
  const cy = 72;
  const startAngle = 215;
  const endAngle   = -35;
  const totalArc   = 250; // Grad des gesamten Bogens

  function polarToCartesian(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(fromDeg: number, toDeg: number) {
    const s = polarToCartesian(fromDeg);
    const e = polarToCartesian(toDeg);
    const largeArc = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  // Voller Hintergrunds-Bogen (grau)
  const bgPath = describeArc(startAngle, startAngle - totalArc);

  // Gefüllter Bogen bis score (0 → startAngle, 100 → startAngle - totalArc)
  const fillDeg = (score / 100) * totalArc;
  const fillPath = score > 0 ? describeArc(startAngle, startAngle - fillDeg) : '';

  const color = scoreGaugeColor(score);

  return (
    <svg viewBox="0 0 144 100" className="w-36 h-24 shrink-0">
      {/* Hintergrund-Bogen */}
      <path d={bgPath} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
      {/* Füll-Bogen */}
      {fillPath && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
      )}
      {/* Score-Zahl */}
      <text
        x={cx} y={cy + 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="26"
        fontWeight="900"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {score}
      </text>
      {/* Statuslabel */}
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fill="#6b7280"
        fontFamily="system-ui, sans-serif"
      >
        {statusLabel(status)}
      </text>
    </svg>
  );
}

// ── Trend Chart Tooltip ───────────────────────────────────────────────────────

type TooltipProps = { active?: boolean; payload?: { value: number; name: string }[]; label?: string };

function TrendTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-md p-2 text-xs">
      <div className="font-bold text-stone-700 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="w-14 text-stone-500">{p.name === 'avgOverloadScore' ? 'Ø Score' : 'Max Score'}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function KitchenCapacityDashboard({ locationId }: Props) {
  const [open, setOpen]               = useState(false);
  const [dashboard, setDashboard]     = useState<Dashboard | null>(null);
  const [trend, setTrend]             = useState<TrendRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [lastFetch, setLastFetch]     = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch(`/api/delivery/admin/kitchen-capacity?action=dashboard&location_id=${encodeURIComponent(locationId)}`),
        fetch(`/api/delivery/admin/kitchen-capacity?action=trend&hours=48&location_id=${encodeURIComponent(locationId)}`),
      ]);
      if (dashRes.ok)  setDashboard(await dashRes.json() as Dashboard);
      if (trendRes.ok) {
        const t = await trendRes.json() as { trend: TrendRow[] };
        setTrend((t.trend ?? []).slice().reverse()); // älteste zuerst
      }
      setLastFetch(new Date());
    } catch {
      // ignore — stale data shown
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  // Initiales Laden + 60s-Polling nur wenn geöffnet
  useEffect(() => {
    if (!open || !locationId) return;
    void load();
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [open, locationId, load]);

  async function toggleCircuit() {
    if (!locationId || !dashboard) return;
    setToggling(true);
    try {
      const isActive = dashboard.circuitBreaker?.isActive ?? false;
      await fetch('/api/delivery/admin/kitchen-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:       isActive ? 'deactivate-circuit-breaker' : 'activate-circuit-breaker',
          location_id:  locationId,
          reason:       isActive ? 'Manuell deaktiviert' : 'Manuell aktiviert',
          activated_by: 'admin',
          duration_min: 15,
        }),
      });
      await load();
    } finally {
      setToggling(false);
    }
  }

  const snap = dashboard?.currentSnapshot;
  const cb   = dashboard?.circuitBreaker;
  const sb   = dashboard?.statusBreakdown ?? { optimal: 0, busy: 0, overloaded: 0, circuitOpen: 0 };
  const sbTotal = sb.optimal + sb.busy + sb.overloaded + sb.circuitOpen || 1;
  const currentStatus: KitchenStatus = snap?.status ?? 'optimal';
  const colors = statusColor(currentStatus);

  // Header-Zusammenfassung auch wenn geschlossen
  const scorePreview = snap ? snap.overloadScore : null;

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', colors.border)}>
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Zap className={cn('h-4 w-4', colors.text)} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Küchen-Kapazität
          </span>
          {scorePreview !== null && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', colors.bg, colors.text)}>
              Score {scorePreview} · {statusLabel(currentStatus)}
            </span>
          )}
          {cb?.isActive && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              Circuit aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t px-5 py-4 space-y-5">

          {/* Gauge + KPIs */}
          {snap ? (
            <div className="flex items-start gap-4 flex-wrap">
              <ScoreGauge score={snap.overloadScore} status={snap.status} />

              <div className="flex-1 min-w-[160px] grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stone-50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Aktive Bestellungen</div>
                  <div className="text-xl font-black tabular-nums text-char">{snap.activeOrders}</div>
                </div>
                <div className="rounded-xl bg-stone-50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Fertig, warten</div>
                  <div className={cn('text-xl font-black tabular-nums', snap.readyOrders > 5 ? 'text-amber-600' : 'text-char')}>
                    {snap.readyOrders}
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Eingang letzte Std.</div>
                  <div className="text-xl font-black tabular-nums text-char">{snap.ordersLastHour}</div>
                </div>
                <div className="rounded-xl bg-stone-50 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Ø Prep-Zeit</div>
                  <div className="text-xl font-black tabular-nums text-char">
                    {snap.avgPrepMin != null ? `${Math.round(snap.avgPrepMin)} Min` : '–'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" />Lade…</>
                : 'Noch kein Snapshot vorhanden — Cron läuft alle 2 Min.'}
            </div>
          )}

          {/* Circuit-Breaker Panel */}
          {cb && (
            <div className={cn(
              'rounded-xl border p-3 flex items-start justify-between gap-3',
              cb.isActive ? 'border-purple-200 bg-purple-50' : 'border-stone-200 bg-stone-50',
            )}>
              <div className="flex items-start gap-2">
                {cb.isActive
                  ? <ShieldAlert className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                  : <ShieldCheck className="h-5 w-5 text-matcha-600 shrink-0 mt-0.5" />}
                <div>
                  <div className={cn('text-xs font-bold', cb.isActive ? 'text-purple-700' : 'text-matcha-700')}>
                    Circuit-Breaker {cb.isActive ? 'AKTIV' : 'inaktiv'}
                  </div>
                  {cb.isActive && (
                    <div className="text-[11px] text-purple-600 mt-0.5">
                      {cb.reason ?? 'Überlast erkannt'}
                      {cb.autoDeactivateAt && ` · ${formatMinutesLeft(cb.autoDeactivateAt)}`}
                    </div>
                  )}
                  {!cb.isActive && (
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      {cb.totalActivations > 0
                        ? `${cb.totalActivations}× in dieser Woche ausgelöst`
                        : 'Noch nie ausgelöst'}
                      {cb.consecutiveOverloadTicks > 0 && ` · ${cb.consecutiveOverloadTicks}/3 Ticks bis Auto-Aktivierung`}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={toggleCircuit}
                disabled={toggling}
                className={cn(
                  'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition disabled:opacity-50',
                  cb.isActive
                    ? 'border-purple-300 bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
                )}
              >
                {toggling ? <Loader2 className="h-3 w-3 animate-spin" /> : cb.isActive ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>
          )}

          {/* Status-Breakdown letzte 2h */}
          {(sb.optimal + sb.busy + sb.overloaded + sb.circuitOpen > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Status-Verteilung letzte 2h ({sbTotal} Snapshots)
              </div>
              <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                {sb.optimal     > 0 && <div className="bg-matcha-500" style={{ width: `${(sb.optimal / sbTotal) * 100}%` }} />}
                {sb.busy        > 0 && <div className="bg-amber-400"  style={{ width: `${(sb.busy / sbTotal) * 100}%` }} />}
                {sb.overloaded  > 0 && <div className="bg-red-500"    style={{ width: `${(sb.overloaded / sbTotal) * 100}%` }} />}
                {sb.circuitOpen > 0 && <div className="bg-purple-500" style={{ width: `${(sb.circuitOpen / sbTotal) * 100}%` }} />}
              </div>
              <div className="flex gap-3 mt-1.5">
                {[
                  { label: 'Optimal', count: sb.optimal,     color: 'bg-matcha-500' },
                  { label: 'Auslast.', count: sb.busy,       color: 'bg-amber-400' },
                  { label: 'Überlast', count: sb.overloaded, color: 'bg-red-500' },
                  { label: 'Circuit',  count: sb.circuitOpen, color: 'bg-purple-500' },
                ].filter(i => i.count > 0).map((item) => (
                  <div key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn('inline-block w-2 h-2 rounded-full', item.color)} />
                    {item.label}: {item.count}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend-Chart 48h */}
          {trend.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Überlas-Score letzte 48h
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="overloadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="hourBucket"
                    tickFormatter={formatHourBucket}
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <Tooltip content={<TrendTooltip />} />
                  <ReferenceLine y={60} stroke="#dc2626" strokeDasharray="4 2" strokeWidth={1} />
                  <ReferenceLine y={30} stroke="#d97706" strokeDasharray="4 2" strokeWidth={1} />
                  <Area
                    type="monotone"
                    dataKey="maxOverloadScore"
                    stroke="#dc2626"
                    strokeWidth={1}
                    fill="url(#overloadGrad)"
                    dot={false}
                    name="maxOverloadScore"
                  />
                  <Area
                    type="monotone"
                    dataKey="avgOverloadScore"
                    stroke="#d97706"
                    strokeWidth={1.5}
                    fill="url(#avgGrad)"
                    dot={false}
                    name="avgOverloadScore"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex gap-3 mt-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block w-3 h-0.5 bg-amber-500 rounded" />Ø Score
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="inline-block w-3 h-0.5 bg-red-500 rounded" />Max Score
                </div>
                <div className="ml-auto text-[10px] text-muted-foreground">
                  Rot-Linie = Überlast (60), Amber = Auslastung (30)
                </div>
              </div>
            </div>
          )}

          {/* Letzte Stunde KPIs */}
          {dashboard?.last1h && (
            <div className={cn(
              'rounded-xl border p-3 grid grid-cols-2 gap-2 sm:grid-cols-4',
              dashboard.last1h.overloadedTicks > 10 ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-stone-50',
            )}>
              {[
                { label: 'Ø Score (1h)', value: dashboard.last1h.avgOverloadScore.toString() },
                { label: 'Max Score (1h)', value: dashboard.last1h.maxOverloadScore.toString() },
                { label: 'Überlast-Ticks', value: `${dashboard.last1h.overloadedTicks}/${dashboard.last1h.snapshotCount}` },
                { label: 'Ø Auslastung', value: `${dashboard.last1h.avgCapacityPct}%` },
              ].map((k) => (
                <div key={k.label}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{k.label}</div>
                  <div className="text-base font-black tabular-nums text-char">{k.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-stone-400">
            <span>
              {lastFetch ? `Aktualisiert ${lastFetch.toLocaleTimeString('de-DE')}` : 'Nie aktualisiert'}
            </span>
            <button
              onClick={() => { void load(); }}
              disabled={loading}
              className="flex items-center gap-1 hover:text-stone-600 transition disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Neu laden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
