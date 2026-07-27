'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, Award, Bike, ChevronDown, ChevronUp, Euro, Loader2,
  Package, Star, TrendingDown, TrendingUp, Users, XCircle, Zap,
} from 'lucide-react';

/**
 * Phase 1000 — Statistiken-Gesamt-Hub (Lieferdienst)
 *
 * Umfassendes Tages- und Schicht-Statistiken-Dashboard:
 * Umsatz-KPIs, Bestellungen, Fahrer, Pünktlichkeit, Ø-Lieferzeit,
 * Storno-Quote, Top-Fahrer. 30-Sek-Polling + Mock-Fallback.
 */

interface Stats {
  umsatz_eur: number;
  umsatz_ziel_eur?: number | null;
  bestellungen: number;
  bestellungen_ziel?: number | null;
  aktive_fahrer: number;
  gesamt_fahrer: number;
  puenktlichkeit_pct: number;
  storno_pct: number;
  avg_lieferzeit_min: number;
  gewinn_eur?: number | null;
  vs_gestern_pct?: number | null;
  top_fahrer?: Array<{ name: string; score: number; touren: number }> | null;
}

const MOCK: Stats = {
  umsatz_eur: 3182.5,
  umsatz_ziel_eur: 3600,
  bestellungen: 107,
  bestellungen_ziel: 120,
  aktive_fahrer: 7,
  gesamt_fahrer: 9,
  puenktlichkeit_pct: 86,
  storno_pct: 3.7,
  avg_lieferzeit_min: 27,
  gewinn_eur: 698.4,
  vs_gestern_pct: 8.2,
  top_fahrer: [
    { name: 'Lukas M.', score: 94, touren: 12 },
    { name: 'Ali K.', score: 88, touren: 10 },
    { name: 'Tina W.', score: 82, touren: 9 },
  ],
};

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
}

function Progress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiTile({
  label, value, sub, trend, icon: Icon, iconColor, bgColor,
}: {
  label: string; value: string; sub?: string; trend?: number | null;
  icon: React.ElementType; iconColor: string; bgColor: string;
}) {
  return (
    <div className={cn('rounded-xl p-3 border', bgColor)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">{label}</span>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div className="text-xl font-black">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      {trend !== undefined && trend !== null && (
        <div className={cn('flex items-center gap-0.5 text-[10px] font-semibold mt-0.5', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% gg. gestern
        </div>
      )}
    </div>
  );
}

export function LieferdienstPhase1000StatistikenGesamtHub({ locationId }: { locationId?: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setStats(MOCK); setLoading(false); return; }
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/analytics?location_id=${locationId}&range=today`);
        if (!res.ok) throw new Error('fetch');
        const d = await res.json();
        setStats({
          umsatz_eur: d.umsatz_eur ?? d.revenue_eur ?? MOCK.umsatz_eur,
          umsatz_ziel_eur: d.umsatz_ziel_eur ?? null,
          bestellungen: d.bestellungen ?? d.orders ?? MOCK.bestellungen,
          bestellungen_ziel: d.bestellungen_ziel ?? null,
          aktive_fahrer: d.aktive_fahrer ?? d.active_drivers ?? MOCK.aktive_fahrer,
          gesamt_fahrer: d.gesamt_fahrer ?? d.total_drivers ?? MOCK.gesamt_fahrer,
          puenktlichkeit_pct: d.puenktlichkeit_pct ?? d.on_time_pct ?? MOCK.puenktlichkeit_pct,
          storno_pct: d.storno_pct ?? d.cancel_pct ?? MOCK.storno_pct,
          avg_lieferzeit_min: d.avg_lieferzeit_min ?? d.avg_delivery_min ?? MOCK.avg_lieferzeit_min,
          gewinn_eur: d.gewinn_eur ?? d.profit_eur ?? null,
          vs_gestern_pct: d.vs_gestern_pct ?? null,
          top_fahrer: d.top_fahrer ?? null,
        });
      } catch {
        setStats(MOCK);
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const s = stats ?? MOCK;

  const umsatzPct = s.umsatz_ziel_eur ? Math.round((s.umsatz_eur / s.umsatz_ziel_eur) * 100) : null;
  const bestellPct = s.bestellungen_ziel ? Math.round((s.bestellungen / s.bestellungen_ziel) * 100) : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-lieferdienst-phase="1000">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-bold text-sm flex-1">Statistiken-Gesamt-Hub</span>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!locationId && <span className="text-[10px] text-amber-600 font-semibold border border-amber-200 px-1.5 py-0.5 rounded-full">Demo</span>}
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border',
          s.puenktlichkeit_pct >= 85 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : s.puenktlichkeit_pct >= 70 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200',
        )}>
          {s.puenktlichkeit_pct}% pünktlich
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t space-y-3 p-3">
          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiTile
              label="Umsatz Heute"
              value={euro(s.umsatz_eur)}
              sub={umsatzPct !== null ? `${umsatzPct}% von Ziel (${euro(s.umsatz_ziel_eur!)})` : undefined}
              trend={s.vs_gestern_pct}
              icon={Euro}
              iconColor="text-matcha-600"
              bgColor="bg-matcha-50 border-matcha-100"
            />
            <KpiTile
              label="Bestellungen"
              value={String(s.bestellungen)}
              sub={bestellPct !== null ? `${bestellPct}% von Ziel (${s.bestellungen_ziel})` : undefined}
              icon={Package}
              iconColor="text-blue-600"
              bgColor="bg-blue-50 border-blue-100"
            />
            <KpiTile
              label="Aktive Fahrer"
              value={`${s.aktive_fahrer}/${s.gesamt_fahrer}`}
              sub={`${Math.round((s.aktive_fahrer / Math.max(s.gesamt_fahrer, 1)) * 100)}% online`}
              icon={Bike}
              iconColor="text-indigo-600"
              bgColor="bg-indigo-50 border-indigo-100"
            />
            <KpiTile
              label="Ø Lieferzeit"
              value={`${s.avg_lieferzeit_min} Min`}
              sub={s.avg_lieferzeit_min <= 30 ? 'Im Zielbereich' : 'Über Ziel'}
              icon={Zap}
              iconColor={s.avg_lieferzeit_min <= 30 ? 'text-emerald-600' : 'text-amber-600'}
              bgColor={s.avg_lieferzeit_min <= 30 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}
            />
          </div>

          {/* ── Secondary KPIs ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {/* Pünktlichkeit */}
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Pünktlichkeit</span>
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              <div className={cn('text-xl font-black', s.puenktlichkeit_pct >= 85 ? 'text-emerald-600' : s.puenktlichkeit_pct >= 70 ? 'text-amber-600' : 'text-red-600')}>
                {s.puenktlichkeit_pct}%
              </div>
              <Progress value={s.puenktlichkeit_pct} max={100} color={s.puenktlichkeit_pct >= 85 ? 'bg-emerald-500' : s.puenktlichkeit_pct >= 70 ? 'bg-amber-400' : 'bg-red-500'} />
            </div>

            {/* Storno */}
            <div className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Storno-Quote</span>
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className={cn('text-xl font-black', s.storno_pct <= 3 ? 'text-emerald-600' : s.storno_pct <= 6 ? 'text-amber-600' : 'text-red-600')}>
                {s.storno_pct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {s.storno_pct <= 3 ? 'Sehr gut' : s.storno_pct <= 6 ? 'Akzeptabel' : 'Handlungsbedarf'}
              </div>
            </div>

            {/* Gewinn */}
            {s.gewinn_eur !== null && s.gewinn_eur !== undefined && (
              <div className="rounded-xl border bg-emerald-50 border-emerald-100 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Schicht-Gewinn</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-emerald-700">{euro(s.gewinn_eur)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">nach Kosten</div>
              </div>
            )}
          </div>

          {/* ── Umsatz Progress ── */}
          {s.umsatz_ziel_eur && (
            <div className="rounded-xl border bg-muted/10 p-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold">Umsatz-Ziel Heute</span>
                <span className="font-black text-matcha-700">{umsatzPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', umsatzPct! >= 100 ? 'bg-emerald-500' : umsatzPct! >= 70 ? 'bg-matcha-500' : 'bg-amber-400')}
                  style={{ width: `${Math.min(100, umsatzPct!)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{euro(s.umsatz_eur)}</span>
                <span>Ziel: {euro(s.umsatz_ziel_eur)}</span>
              </div>
            </div>
          )}

          {/* ── Top Fahrer ── */}
          {s.top_fahrer && s.top_fahrer.length > 0 && (
            <div className="rounded-xl border bg-amber-50/50 border-amber-100 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-bold">Top Fahrer Heute</span>
              </div>
              <div className="space-y-1.5">
                {s.top_fahrer.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black',
                      i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : 'bg-amber-100 text-amber-700',
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-semibold">{f.name}</span>
                    <span className="text-muted-foreground">{f.touren} Touren</span>
                    <span className="font-black text-amber-700">{f.score} Pkt</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-2 pt-1 border-t">
            <Users className="h-3 w-3" />
            <span>Tages-Statistiken · 30-Sek-Aktualisierung{!locationId ? ' · Demo-Daten' : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}
