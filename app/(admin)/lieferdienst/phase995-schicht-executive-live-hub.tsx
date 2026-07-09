'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, Award, Bike, ChevronDown, ChevronUp, Euro, Loader2,
  Package, TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';

type ShiftStats = {
  umsatzEur: number;
  umsatzZielEur?: number;
  bestellungen: number;
  bestellungenZiel?: number;
  aktiveFahrer: number;
  gesamtFahrer: number;
  pünktlichkeitPct: number;
  stornoPct: number;
  avgLieferzeitMin: number;
  gewinnEur?: number;
  vsGesternPct?: number; // % change vs yesterday
};

const MOCK_STATS: ShiftStats = {
  umsatzEur: 2847.5,
  umsatzZielEur: 3200,
  bestellungen: 94,
  bestellungenZiel: 110,
  aktiveFahrer: 6,
  gesamtFahrer: 8,
  pünktlichkeitPct: 88,
  stornoPct: 4.2,
  avgLieferzeitMin: 28,
  gewinnEur: 612.3,
  vsGesternPct: 12.4,
};

function KpiTile({
  label,
  value,
  sub,
  trend,
  color = 'matcha',
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: string;
  icon: React.ElementType;
}) {
  const colorMap: Record<string, string> = {
    matcha: 'bg-matcha-50 text-matcha-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  const iconColor = colorMap[color] ?? colorMap.matcha;

  return (
    <div className="rounded-xl bg-card border p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', iconColor)}>
          <Icon size={14} />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-[10px] font-bold',
            trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground',
          )}>
            {trend > 0 ? <TrendingUp size={10} /> : trend < 0 ? <TrendingDown size={10} /> : null}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </div>
        )}
      </div>
      <div className="text-lg font-black tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground font-medium leading-none">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  color = 'matcha',
  label,
}: {
  value: number;
  max: number;
  color?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor =
    color === 'matcha' ? 'bg-matcha-500' :
    color === 'emerald' ? 'bg-emerald-500' :
    color === 'amber' ? 'bg-amber-500' :
    color === 'red' ? 'bg-red-500' :
    'bg-blue-500';

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-bold tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LieferdienstPhase995SchichtExecutiveLiveHub({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!locationId) {
        setStats(MOCK_STATS);
        setLoading(false);
        return;
      }
      fetch(`/api/delivery/admin/reporting?location_id=${encodeURIComponent(locationId)}&period=today`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d?.stats) setStats(d.stats);
          else setStats(MOCK_STATS);
        })
        .catch(() => { if (!cancelled) setStats(MOCK_STATS); })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Schicht-Executive Hub
          </span>
          {!loading && stats && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {fmtEur(stats.umsatzEur)} · {stats.bestellungen} Bestellungen
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Schicht-Daten…
            </div>
          ) : !stats ? (
            <div className="text-sm text-muted-foreground">Keine Daten verfügbar.</div>
          ) : (
            <>
              {/* Main KPI grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <KpiTile
                  label="Umsatz heute"
                  value={fmtEur(stats.umsatzEur)}
                  sub={stats.umsatzZielEur ? `Ziel: ${fmtEur(stats.umsatzZielEur)}` : undefined}
                  trend={stats.vsGesternPct}
                  icon={Euro}
                  color="emerald"
                />
                <KpiTile
                  label="Bestellungen"
                  value={stats.bestellungen.toString()}
                  sub={stats.bestellungenZiel ? `Ziel: ${stats.bestellungenZiel}` : undefined}
                  icon={Package}
                  color="matcha"
                />
                <KpiTile
                  label="Aktive Fahrer"
                  value={`${stats.aktiveFahrer}/${stats.gesamtFahrer}`}
                  sub={`${Math.round((stats.aktiveFahrer / Math.max(1, stats.gesamtFahrer)) * 100)}% verfügbar`}
                  icon={Bike}
                  color="blue"
                />
                <KpiTile
                  label="Pünktlichkeit"
                  value={`${stats.pünktlichkeitPct}%`}
                  icon={Award}
                  color={stats.pünktlichkeitPct >= 85 ? 'emerald' : stats.pünktlichkeitPct >= 70 ? 'amber' : 'red'}
                />
                <KpiTile
                  label="Storno-Rate"
                  value={`${stats.stornoPct.toFixed(1)}%`}
                  icon={Zap}
                  color={stats.stornoPct <= 3 ? 'emerald' : stats.stornoPct <= 6 ? 'amber' : 'red'}
                />
                <KpiTile
                  label="Ø Lieferzeit"
                  value={`${stats.avgLieferzeitMin} Min`}
                  icon={Users}
                  color={stats.avgLieferzeitMin <= 25 ? 'emerald' : stats.avgLieferzeitMin <= 35 ? 'amber' : 'red'}
                />
              </div>

              {/* Progress toward targets */}
              {(stats.umsatzZielEur || stats.bestellungenZiel) && (
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Ziel-Fortschritt
                  </div>
                  {stats.umsatzZielEur && (
                    <ProgressBar
                      value={stats.umsatzEur}
                      max={stats.umsatzZielEur}
                      color={stats.umsatzEur / stats.umsatzZielEur >= 0.9 ? 'emerald' : stats.umsatzEur / stats.umsatzZielEur >= 0.7 ? 'amber' : 'matcha'}
                      label={`Umsatz: ${fmtEur(stats.umsatzEur)} / ${fmtEur(stats.umsatzZielEur)}`}
                    />
                  )}
                  {stats.bestellungenZiel && (
                    <ProgressBar
                      value={stats.bestellungen}
                      max={stats.bestellungenZiel}
                      color="matcha"
                      label={`Bestellungen: ${stats.bestellungen} / ${stats.bestellungenZiel}`}
                    />
                  )}
                </div>
              )}

              {/* Profit highlight */}
              {stats.gewinnEur !== undefined && (
                <div className="rounded-xl bg-matcha-50 border border-matcha-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600">
                      Geschätzter Schicht-Gewinn
                    </div>
                    <div className="text-xl font-black text-matcha-700 tabular-nums mt-0.5">
                      {fmtEur(stats.gewinnEur)}
                    </div>
                  </div>
                  <div className="text-3xl">🏆</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
