'use client';

/**
 * TagesauswertungsBanner — Phase 201
 * Tagesabschluss-Banner für die Lieferdienst-Ansicht.
 * Zeigt: Gesamtumsatz, Bestellungen, Ø Lieferzeit, Pünktlichkeit, Fahrer online.
 * Erscheint automatisch ab 20:00 Uhr (oder manuell ausklappbar).
 * Nutzt GET /api/delivery/shifts?action=current_stats oder Mock-Daten.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, Award, Clock, Target, Users, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, Star,
} from 'lucide-react';

interface ShiftStats {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  pendingOrders: number;
  activeDrivers: number;
}

const MOCK_STATS: ShiftStats = {
  revenue: 0, orders: 0, avgOrderValue: 0, deliveries: 0,
  avgDeliveryMin: 0, onTimeRatePct: 0, pendingOrders: 0, activeDrivers: 0,
};

function gradeEmoji(onTimePct: number): { emoji: string; label: string; color: string } {
  if (onTimePct >= 95) return { emoji: '🏆', label: 'Ausgezeichnet!', color: 'text-amber-600' };
  if (onTimePct >= 85) return { emoji: '⭐', label: 'Sehr gut', color: 'text-matcha-600' };
  if (onTimePct >= 75) return { emoji: '👍', label: 'Gut', color: 'text-blue-600' };
  if (onTimePct >= 60) return { emoji: '⚡', label: 'Ausbaufähig', color: 'text-amber-500' };
  return { emoji: '⚠️', label: 'Verbesserung nötig', color: 'text-red-500' };
}

function fmt(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

interface Props {
  locationId: string;
}

export function TagesauswertungsBanner({ locationId }: Props) {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-öffnen nach 20 Uhr
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 20) setOpen(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;
    setLoading(true);

    fetch(`/api/delivery/shifts?action=current_stats&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { stats?: ShiftStats } | null) => {
        if (mounted && d?.stats) setStats(d.stats);
        else if (mounted) setStats(MOCK_STATS);
      })
      .catch(() => { if (mounted) setStats(MOCK_STATS); })
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [locationId, lastRefresh]);

  const grade = stats ? gradeEmoji(stats.onTimeRatePct) : null;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Uhr`;

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border transition-all',
      grade?.color === 'text-amber-600' ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white' :
      grade?.color === 'text-matcha-600' ? 'border-matcha-200 bg-gradient-to-br from-matcha-50 to-white' :
      'border-stone-200 bg-white',
    )}>
      {/* Header — immer sichtbar */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full text-lg',
            loading ? 'bg-stone-100' : 'bg-white shadow-sm',
          )}>
            {loading ? <span className="animate-pulse">⏳</span> : <span>{grade?.emoji ?? '📊'}</span>}
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">
              Tagesauswertung — Stand {timeStr}
            </div>
            {!loading && stats && (
              <div className={cn('text-xs font-semibold', grade?.color)}>
                {grade?.label} · {stats.orders} Bestellungen · {fmt(stats.revenue)}
              </div>
            )}
            {loading && <div className="text-xs text-stone-400 animate-pulse">Lade Schichtdaten…</div>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {/* Detail — ausgeklappt */}
      {open && !loading && stats && (
        <div className="border-t border-stone-100">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
              <div className="text-lg font-black tabular-nums text-stone-800">{fmt(stats.revenue)}</div>
              <div className="text-[10px] text-stone-500 flex items-center justify-center gap-0.5 mt-0.5">
                <TrendingUp className="h-2.5 w-2.5" />Umsatz
              </div>
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
              <div className="text-lg font-black tabular-nums text-stone-800">{stats.orders}</div>
              <div className="text-[10px] text-stone-500 flex items-center justify-center gap-0.5 mt-0.5">
                <Award className="h-2.5 w-2.5" />Bestellungen
              </div>
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
              <div className={cn(
                'text-lg font-black tabular-nums',
                stats.avgDeliveryMin <= 25 ? 'text-matcha-700' : stats.avgDeliveryMin <= 35 ? 'text-amber-600' : 'text-red-600',
              )}>
                {stats.avgDeliveryMin > 0 ? `${Math.round(stats.avgDeliveryMin)} Min` : '—'}
              </div>
              <div className="text-[10px] text-stone-500 flex items-center justify-center gap-0.5 mt-0.5">
                <Clock className="h-2.5 w-2.5" />Ø Lieferzeit
              </div>
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-3 text-center">
              <div className={cn(
                'text-lg font-black tabular-nums',
                stats.onTimeRatePct >= 85 ? 'text-matcha-700' : stats.onTimeRatePct >= 70 ? 'text-amber-600' : 'text-red-600',
              )}>
                {stats.onTimeRatePct > 0 ? `${Math.round(stats.onTimeRatePct)}%` : '—'}
              </div>
              <div className="text-[10px] text-stone-500 flex items-center justify-center gap-0.5 mt-0.5">
                <Target className="h-2.5 w-2.5" />Pünktlichkeit
              </div>
            </div>
          </div>

          {/* Zusatz-KPIs */}
          <div className="flex flex-wrap gap-3 px-4 pb-4">
            <div className="flex items-center gap-1.5 rounded-full bg-stone-50 border border-stone-100 px-3 py-1.5">
              <Users className="h-3 w-3 text-stone-500" />
              <span className="text-xs text-stone-600 font-semibold">{stats.activeDrivers} Fahrer online</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-stone-50 border border-stone-100 px-3 py-1.5">
              <Star className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-stone-600 font-semibold">
                Ø {stats.avgOrderValue > 0 ? fmt(stats.avgOrderValue) : '—'} / Bestellung
              </span>
            </div>
            {stats.pendingOrders > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-amber-700 font-semibold">{stats.pendingOrders} offen</span>
              </div>
            )}
            {stats.pendingOrders === 0 && stats.orders > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-matcha-50 border border-matcha-200 px-3 py-1.5">
                <CheckCircle2 className="h-3 w-3 text-matcha-500" />
                <span className="text-xs text-matcha-700 font-semibold">Alle abgeschlossen</span>
              </div>
            )}
          </div>

          {/* Performance-Nachricht */}
          <div className={cn(
            'mx-4 mb-4 rounded-xl p-3 text-xs font-medium',
            grade?.color === 'text-amber-600' ? 'bg-amber-50 text-amber-800' :
            grade?.color === 'text-matcha-600' ? 'bg-matcha-50 text-matcha-800' :
            grade?.color === 'text-blue-600' ? 'bg-blue-50 text-blue-800' :
            'bg-stone-50 text-stone-700',
          )}>
            {grade?.emoji} {grade?.label} —
            {stats.onTimeRatePct >= 85
              ? ` Hervorragende Schichtperformance! ${stats.deliveries} Lieferungen erfolgreich abgeschlossen.`
              : stats.onTimeRatePct >= 70
              ? ` Gute Leistung, aber es gibt noch Verbesserungspotenzial bei der Pünktlichkeit (Ziel: ≥85%).`
              : ` Die Pünktlichkeit sollte in der nächsten Schicht verbessert werden. Ziel: ≥85%.`
            }
          </div>

          {/* Refresh */}
          <div className="px-4 pb-3 flex justify-end">
            <button
              onClick={() => setLastRefresh(Date.now())}
              className="text-[10px] text-stone-400 hover:text-stone-600 transition flex items-center gap-1"
            >
              <TrendingUp className="h-2.5 w-2.5" />Aktualisieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
