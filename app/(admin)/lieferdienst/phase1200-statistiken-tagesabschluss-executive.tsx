'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart2, ChevronDown, ChevronUp, Clock, Euro, Package,
  Star, Target, TrendingDown, TrendingUp, Truck, Users,
} from 'lucide-react';

/**
 * Phase 1200 — Statistiken-Tagesabschluss-Executive (Lieferdienst)
 *
 * Tagesbasiertes Executive-Dashboard mit:
 * - Umsatz heute (mit Vergleich zu gestern)
 * - Bestellungen total / davon geliefert
 * - Ø Lieferzeit + Pünktlichkeitsquote
 * - Aktivste Lieferzone
 * - Top-Fahrer heute (Score + Stopps)
 * - Stornoquote
 * - Fahrerstunden & Auslastung
 *
 * Pollt /api/delivery/admin/tages-statistiken alle 60s.
 * Fallback: Mock-Daten.
 */

interface TagesStats {
  umsatz_heute: number;
  umsatz_gestern: number;
  bestellungen_heute: number;
  bestellungen_geliefert: number;
  bestellungen_storniert: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  aktivste_zone: string | null;
  top_fahrer_name: string | null;
  top_fahrer_score: number | null;
  top_fahrer_stopps: number | null;
  aktive_fahrer: number;
  fahrer_stunden_gesamt: number;
  avg_bewertung: number | null;
  bestellungen_gestern: number;
}

interface Props {
  locationId?: string | null;
}

const MOCK: TagesStats = {
  umsatz_heute: 1847.50,
  umsatz_gestern: 1620.00,
  bestellungen_heute: 48,
  bestellungen_geliefert: 44,
  bestellungen_storniert: 2,
  avg_lieferzeit_min: 28,
  puenktlichkeit_pct: 87,
  aktivste_zone: 'Mitte-Nord',
  top_fahrer_name: 'M. Bauer',
  top_fahrer_score: 91,
  top_fahrer_stopps: 16,
  aktive_fahrer: 4,
  fahrer_stunden_gesamt: 22,
  avg_bewertung: 4.6,
  bestellungen_gestern: 42,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

function deltaPct(now: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((now - prev) / prev) * 100);
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const pos = delta >= 0;
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-lg',
      pos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
           : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    )}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? '+' : ''}{delta}%
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  iconBg?: string;
  highlight?: boolean;
}

function StatCard({ label, value, sub, icon, iconBg = 'bg-neutral-100 dark:bg-neutral-800', highlight }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-3 flex flex-col gap-1',
      highlight
        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className={cn('p-1.5 rounded-lg shrink-0', iconBg)}>{icon}</div>
      </div>
      <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-black text-foreground leading-tight tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground leading-tight">{sub}</div>}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LieferdienstPhase1200StatistikenTagesabschlussExecutive({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TagesStats | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    async function load() {
      if (!locationId) { setData(MOCK); setUsingMock(true); return; }
      try {
        const res = await fetch(`/api/delivery/admin/tages-statistiken?location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('not ok');
        const d: TagesStats = await res.json();
        setData(d);
        setUsingMock(false);
      } catch {
        setData(MOCK);
        setUsingMock(true);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const umsatzDelta = deltaPct(data.umsatz_heute, data.umsatz_gestern);
  const bestellDelta = deltaPct(data.bestellungen_heute, data.bestellungen_gestern);
  const stornoquote = data.bestellungen_heute > 0
    ? Math.round((data.bestellungen_storniert / data.bestellungen_heute) * 100)
    : 0;
  const lieferquote = data.bestellungen_heute > 0
    ? Math.round((data.bestellungen_geliefert / data.bestellungen_heute) * 100)
    : 0;

  return (
    <div className="rounded-2xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-950/40">
            <BarChart2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground leading-tight">Tagesabschluss Executive</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          {usingMock && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-black text-foreground">{fmtEuro(data.umsatz_heute)}</div>
            <div className="text-[10px] text-muted-foreground">Umsatz heute</div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            <StatCard
              label="Umsatz Heute"
              value={fmtEuro(data.umsatz_heute)}
              sub={<span className="flex items-center gap-1">vs. {fmtEuro(data.umsatz_gestern)} gestern <DeltaBadge delta={umsatzDelta} /></span>}
              icon={<Euro className="h-3.5 w-3.5 text-emerald-600" />}
              iconBg="bg-emerald-100 dark:bg-emerald-950/40"
              highlight={umsatzDelta !== null && umsatzDelta > 0}
            />
            <StatCard
              label="Bestellungen"
              value={data.bestellungen_heute}
              sub={<span className="flex items-center gap-1">vs. {data.bestellungen_gestern} gestern <DeltaBadge delta={bestellDelta} /></span>}
              icon={<Package className="h-3.5 w-3.5 text-sky-600" />}
              iconBg="bg-sky-100 dark:bg-sky-950/40"
            />
            <StatCard
              label="Ø Lieferzeit"
              value={`${data.avg_lieferzeit_min} Min`}
              sub={<span className={data.avg_lieferzeit_min <= 30 ? 'text-emerald-600' : 'text-red-600'}>{data.avg_lieferzeit_min <= 25 ? '🎯 Sehr gut' : data.avg_lieferzeit_min <= 35 ? '✓ Im Ziel' : '⚠️ Zu lang'}</span>}
              icon={<Clock className="h-3.5 w-3.5 text-orange-600" />}
              iconBg="bg-orange-100 dark:bg-orange-950/40"
            />
            <StatCard
              label="Pünktlichkeit"
              value={`${data.puenktlichkeit_pct}%`}
              sub={<span className={data.puenktlichkeit_pct >= 85 ? 'text-emerald-600' : data.puenktlichkeit_pct >= 70 ? 'text-amber-600' : 'text-red-600'}>{data.puenktlichkeit_pct >= 85 ? '🏆 Exzellent' : data.puenktlichkeit_pct >= 70 ? '✓ Gut' : '⚠️ Verbesserungsbedarf'}</span>}
              icon={<Target className="h-3.5 w-3.5 text-violet-600" />}
              iconBg="bg-violet-100 dark:bg-violet-950/40"
            />
            <StatCard
              label="Lieferquote"
              value={`${lieferquote}%`}
              sub={`${data.bestellungen_geliefert} geliefert / ${data.bestellungen_storniert} storniert`}
              icon={<Truck className="h-3.5 w-3.5 text-sky-600" />}
              iconBg="bg-sky-100 dark:bg-sky-950/40"
            />
            <StatCard
              label="Stornoquote"
              value={`${stornoquote}%`}
              sub={`${data.bestellungen_storniert} Stornierungen`}
              icon={<TrendingDown className="h-3.5 w-3.5 text-red-600" />}
              iconBg={stornoquote >= 10 ? 'bg-red-100 dark:bg-red-950/40' : 'bg-neutral-100 dark:bg-neutral-800'}
            />
            <StatCard
              label="Aktive Fahrer"
              value={data.aktive_fahrer}
              sub={`${data.fahrer_stunden_gesamt}h gesamt`}
              icon={<Users className="h-3.5 w-3.5 text-indigo-600" />}
              iconBg="bg-indigo-100 dark:bg-indigo-950/40"
            />
            {data.avg_bewertung != null && (
              <StatCard
                label="Ø Bewertung"
                value={data.avg_bewertung.toFixed(1)}
                sub="Kundenfeedback"
                icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
                iconBg="bg-amber-100 dark:bg-amber-950/40"
              />
            )}
          </div>

          {/* Top-Fahrer + Aktivste Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Top Fahrer */}
            {data.top_fahrer_name && (
              <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
                  🏆 Top-Fahrer heute
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-lg font-black text-amber-700 dark:text-amber-300 shrink-0">
                    {data.top_fahrer_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-black text-foreground">{data.top_fahrer_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Score: <span className="font-bold text-amber-600">{data.top_fahrer_score}</span>
                      {data.top_fahrer_stopps != null && ` · ${data.top_fahrer_stopps} Stopps`}
                    </div>
                  </div>
                  {data.top_fahrer_score != null && (
                    <div className="ml-auto">
                      <div className="text-2xl font-black text-amber-600 tabular-nums">{data.top_fahrer_score}</div>
                      <div className="text-[10px] text-muted-foreground text-right">Score</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Aktivste Zone */}
            {data.aktivste_zone && (
              <div className="rounded-xl border bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800 px-3 py-3">
                <div className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-1.5">
                  📍 Aktivste Lieferzone
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-sky-200 dark:bg-sky-800 flex items-center justify-center shrink-0">
                    <Truck className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                  </div>
                  <div>
                    <div className="font-black text-foreground text-base">{data.aktivste_zone}</div>
                    <div className="text-[11px] text-muted-foreground">Meiste Bestellungen heute</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Umsatz-Tagesvergleich-Bar */}
          <div className="rounded-xl border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
              Umsatzvergleich Heute vs. Gestern
            </div>
            <div className="space-y-2">
              {[
                { label: 'Heute', value: data.umsatz_heute, color: 'bg-emerald-500', max: Math.max(data.umsatz_heute, data.umsatz_gestern) },
                { label: 'Gestern', value: data.umsatz_gestern, color: 'bg-neutral-300 dark:bg-neutral-600', max: Math.max(data.umsatz_heute, data.umsatz_gestern) },
              ].map(({ label, value, color, max }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-muted-foreground w-14 shrink-0">{label}</span>
                  <div className="flex-1 h-4 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', color)}
                      style={{ width: `${Math.round((value / max) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-foreground tabular-nums w-20 text-right shrink-0">
                    {fmtEuro(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
