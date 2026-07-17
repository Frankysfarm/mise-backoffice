'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Bike, CheckCircle2, MapPin, Route, Star, TrendingUp } from 'lucide-react';

/* ── Typen ──────────────────────────────────────────────────────────────── */
interface TourRow {
  batchId: string;
  fahrerName: string;
  zone: string | null;
  gesamtStopps: number;
  abgeschlosseneStopps: number;
  abgefahrenMin: number;
  etaMin: number | null;
  restMin: number | null;
  score: number;              // 0..100
  scoreLabel: string;
  health: 'on-time' | 'tight' | 'late' | 'unknown';
  pct: number;                // Fortschritt 0..100
  aktuellerStop: string | null;
}

type Health = TourRow['health'];

const HEALTH_META: Record<Health, { bg: string; border: string; badge: string; bar: string; text: string; label: string }> = {
  'on-time': { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-500 text-white',     bar: 'bg-green-400',   text: 'text-green-700',  label: 'Pünktlich'  },
  tight:     { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-400 text-white',     bar: 'bg-amber-400',   text: 'text-amber-700',  label: 'Knapp'      },
  late:      { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-500   text-white',     bar: 'bg-red-400',     text: 'text-red-700',    label: 'Verspätet'  },
  unknown:   { bg: 'bg-muted/20',  border: 'border-border',     badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground/40', text: 'text-muted-foreground', label: 'Unbekannt' },
};

/* ── Score-Ring ─────────────────────────────────────────────────────────── */
function ScoreRing({ score, health }: { score: number; health: Health }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = health === 'on-time' ? '#22c55e' : health === 'tight' ? '#f59e0b' : health === 'late' ? '#ef4444' : '#94a3b8';

  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      <circle cx={24} cy={24} r={r} fill="none" strokeWidth={4} stroke="#e2e8f0" />
      <circle
        cx={24} cy={24} r={r} fill="none" strokeWidth={4}
        stroke={color}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x={24} y={28} textAnchor="middle" fontSize={11} fontWeight={800} fill={color}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </text>
    </svg>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function DispatchPhase2070TourScoreLiveBoard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [tours, setTours] = useState<TourRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const supaRef = useRef(createClient());

  useEffect(() => {
    if (!locationId) return;
    const supa = supaRef.current;

    async function load() {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      /* Aktive Batches */
      const { data: batches } = await supa
        .from('delivery_batches')
        .select('id,driver_id,zone,started_at,estimated_total_min,status')
        .eq('location_id', locationId)
        .in('status', ['unterwegs', 'abgeholt'])
        .gte('started_at', cutoff.toISOString())
        .limit(20);

      if (!batches || batches.length === 0) { setTours([]); return; }

      const driverIds = [...new Set(batches.map((b: { driver_id: string }) => b.driver_id))];
      const batchIds  = batches.map((b: { id: string }) => b.id);

      /* Fahrer-Namen */
      const { data: drivers } = await supa
        .from('drivers')
        .select('id,name,delivery_score')
        .in('id', driverIds);

      const driverMap = new Map<string, { name: string; score: number }>(
        (drivers ?? []).map((d: { id: string; name: string; delivery_score?: number }) => [d.id, { name: d.name, score: d.delivery_score ?? 80 }]),
      );

      /* Stopps */
      const { data: stops } = await supa
        .from('delivery_stops')
        .select('batch_id,status,address,completed_at')
        .in('batch_id', batchIds);

      const stopMap = new Map<string, { total: number; done: number; current: string | null }>();
      (stops ?? []).forEach((s: { batch_id: string; status: string; address?: string }) => {
        const entry = stopMap.get(s.batch_id) ?? { total: 0, done: 0, current: null };
        entry.total++;
        if (s.status === 'abgeschlossen') entry.done++;
        if (s.status === 'aktuell') entry.current = s.address ?? null;
        stopMap.set(s.batch_id, entry);
      });

      const rows: TourRow[] = batches.map((b: { id: string; driver_id: string; zone: string | null; started_at: string | null; estimated_total_min: number | null }) => {
        const driver = driverMap.get(b.driver_id);
        const stopInfo = stopMap.get(b.id) ?? { total: 0, done: 0, current: null };
        const startedAt = b.started_at ? new Date(b.started_at) : null;
        const abgefahrenMin = startedAt ? Math.floor((now.getTime() - startedAt.getTime()) / 60000) : 0;
        const etaMin = b.estimated_total_min ?? null;
        const restMin = etaMin !== null ? Math.max(0, etaMin - abgefahrenMin) : null;

        /* Health berechnen */
        let health: Health = 'unknown';
        if (etaMin !== null) {
          const ratio = abgefahrenMin / etaMin;
          if (ratio > 1.15)       health = 'late';
          else if (ratio > 0.85)  health = 'tight';
          else                    health = 'on-time';
        } else if (stopInfo.total > 0) {
          health = 'unknown';
        }

        /* Score: basiert auf Fahrer-Score + Pünktlichkeit */
        const driverScore = driver?.score ?? 80;
        const timePenalty = health === 'late' ? 15 : health === 'tight' ? 5 : 0;
        const score = Math.max(0, Math.min(100, Math.round(driverScore - timePenalty)));

        const scoreLabel = score >= 85 ? 'Exzellent' : score >= 70 ? 'Gut' : score >= 50 ? 'Mittel' : 'Kritisch';
        const pct = stopInfo.total > 0
          ? Math.round((stopInfo.done / stopInfo.total) * 100)
          : etaMin !== null && abgefahrenMin > 0
            ? Math.min(95, Math.round((abgefahrenMin / etaMin) * 100))
            : 0;

        return {
          batchId: b.id,
          fahrerName: driver?.name ?? 'Fahrer',
          zone: b.zone,
          gesamtStopps: stopInfo.total,
          abgeschlosseneStopps: stopInfo.done,
          abgefahrenMin,
          etaMin,
          restMin,
          score,
          scoreLabel,
          health,
          pct,
          aktuellerStop: stopInfo.current,
        };
      }).sort((a, b) => {
        const order: Health[] = ['late', 'tight', 'on-time', 'unknown'];
        return order.indexOf(a.health) - order.indexOf(b.health);
      });

      setTours(rows);
      setLastUpdate(new Date());
    }

    load();
    const iv = setInterval(load, 30_000);
    const ch = supa
      .channel(`dispatch-tour-score-${locationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches', filter: `location_id=eq.${locationId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_stops' }, load)
      .subscribe();

    return () => { clearInterval(iv); supa.removeChannel(ch); };
  }, [locationId]);

  if (!locationId) return null;

  const stats = {
    late:    tours.filter(t => t.health === 'late').length,
    tight:   tours.filter(t => t.health === 'tight').length,
    onTime:  tours.filter(t => t.health === 'on-time').length,
    avgScore: tours.length > 0 ? Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length) : 0,
  };

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-matcha-50 to-white">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Tour-Score · Live-Board</span>
        <div className="ml-auto flex items-center gap-2">
          {stats.late > 0   && <span className="rounded-full bg-red-500   text-white text-[10px] font-black px-2 py-0.5">{stats.late} spät</span>}
          {stats.tight > 0  && <span className="rounded-full bg-amber-400 text-white text-[10px] font-black px-2 py-0.5">{stats.tight} knapp</span>}
          {tours.length > 0 && <span className="rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5">Ø {stats.avgScore}</span>}
        </div>
      </div>

      {/* KPI-Leiste */}
      {tours.length > 0 && (
        <div className="grid grid-cols-3 divide-x border-b bg-white">
          {[
            { label: 'Verspätet', value: stats.late,   color: 'text-red-600',    icon: AlertTriangle },
            { label: 'Pünktlich', value: stats.onTime, color: 'text-green-600',   icon: CheckCircle2 },
            { label: 'Ø Score',   value: stats.avgScore, color: 'text-matcha-700', icon: Star },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="text-center py-2">
              <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
              <div className={cn('text-lg font-black tabular-nums leading-none', color)}>{value}</div>
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tour-Karten */}
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {tours.map(tour => {
          const hm = HEALTH_META[tour.health];
          return (
            <div key={tour.batchId} className={cn('px-4 py-3 flex items-center gap-3', hm.bg)}>
              {/* Score-Ring */}
              <ScoreRing score={tour.score} health={tour.health} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold truncate">{tour.fahrerName}</span>
                  {tour.zone && (
                    <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                      Zone {tour.zone}
                    </span>
                  )}
                  <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-black', hm.badge)}>
                    {hm.label}
                  </span>
                </div>

                {/* Aktueller Stop */}
                {tour.aktuellerStop && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate">{tour.aktuellerStop}</span>
                  </div>
                )}

                {/* Fortschrittsbalken */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', hm.bar)}
                      style={{ width: `${tour.pct}%` }}
                    />
                  </div>
                  {tour.gesamtStopps > 0 && (
                    <span className="text-[9px] font-bold text-muted-foreground tabular-nums shrink-0">
                      {tour.abgeschlosseneStopps}/{tour.gesamtStopps}
                    </span>
                  )}
                </div>
              </div>

              {/* Zeit */}
              <div className="shrink-0 text-right">
                {tour.restMin !== null ? (
                  <>
                    <div className={cn('font-mono text-sm font-black tabular-nums', hm.text)}>
                      {tour.restMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">verbleibend</div>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-sm font-black tabular-nums text-matcha-600">
                      {tour.abgefahrenMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">unterwegs</div>
                  </>
                )}
                <div className={cn('text-[9px] font-bold mt-0.5', hm.text)}>{tour.scoreLabel}</div>
              </div>
            </div>
          );
        })}

        {tours.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <TrendingUp className="h-8 w-8 opacity-20" />
            <p className="text-sm">Keine aktiven Touren</p>
          </div>
        )}
      </div>

      {lastUpdate && (
        <div className="px-4 py-1.5 border-t bg-muted/20">
          <span className="text-[9px] text-muted-foreground">
            Aktualisiert: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}
    </div>
  );
}
