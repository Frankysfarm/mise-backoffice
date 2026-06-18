'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, Euro, Clock, Target, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  locationId?: string | null;
}

interface ShiftData {
  revenueNow: number;
  ordersNow: number;
  shiftStartedAt: string | null;
  avgOrderValue: number;
}

function euro(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function shiftElapsedMin(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000));
}

function shiftRemainingMin(startedAt: string | null, shiftDurationH = 8): number {
  const elapsed = shiftElapsedMin(startedAt);
  return Math.max(0, shiftDurationH * 60 - elapsed);
}

export function LiveErloesPrognose({ locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<ShiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagesZiel, setTagesZiel] = useState<number>(1500);
  const loadRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let q = supabase
        .from('customer_orders')
        .select('gesamtbetrag, bestellt_am, status')
        .gte('bestellt_am', today.toISOString())
        .not('status', 'in', '(storniert,abgebrochen)');
      if (locationId) q = q.eq('location_id', locationId);

      const { data: rows } = await q;
      if (!rows) return;

      type Row = { gesamtbetrag: number | null; bestellt_am: string | null; status: string | null };
      const typedRows = rows as Row[];

      const delivered = typedRows.filter((r: Row) =>
        ['geliefert', 'abgeholt', 'abgeschlossen'].includes(r.status ?? '')
      );
      const revenueNow = delivered.reduce((s: number, r: Row) => s + (r.gesamtbetrag ?? 0), 0);
      const ordersNow = delivered.length;
      const avgOrderValue = ordersNow > 0 ? revenueNow / ordersNow : 0;

      // Find approximate shift start (oldest order today)
      const oldest = typedRows
        .filter((r: Row) => r.bestellt_am)
        .sort((a: Row, b: Row) => new Date(a.bestellt_am!).getTime() - new Date(b.bestellt_am!).getTime())[0];

      setData({
        revenueNow,
        ordersNow,
        shiftStartedAt: oldest?.bestellt_am ?? null,
        avgOrderValue,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    load();
    const iv = setInterval(() => loadRef.current?.(), 60_000);

    const channel = supabase
      .channel('erloes-prognose-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, () => {
        loadRef.current?.();
      })
      .subscribe();

    return () => { clearInterval(iv); supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) return null;

  const elapsedMin = shiftElapsedMin(data.shiftStartedAt);
  const remainMin = shiftRemainingMin(data.shiftStartedAt);
  const elapsedH = elapsedMin / 60;

  // Revenue rate: EUR per hour so far
  const ratePerH = elapsedH > 0.1 ? data.revenueNow / elapsedH : 0;
  const projected = data.revenueNow + ratePerH * (remainMin / 60);
  const progressPct = Math.min(100, Math.round((data.revenueNow / tagesZiel) * 100));
  const projectedPct = Math.min(100, Math.round((projected / tagesZiel) * 100));
  const onTrack = projected >= tagesZiel * 0.9;
  const ordersPerH = elapsedH > 0.1 ? data.ordersNow / elapsedH : 0;
  const projectedOrders = Math.round(data.ordersNow + ordersPerH * (remainMin / 60));

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <TrendingUp size={14} className="text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-gray-800">Schicht-Erlösprognose</span>
        <span className={`ml-auto flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 ${
          onTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {onTrack ? '✓ Auf Kurs' : '↓ Unter Plan'}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Main KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <div className="text-lg font-black text-emerald-700 tabular-nums">{euro(data.revenueNow)}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Bisher</div>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
            <div className="text-lg font-black text-blue-700 tabular-nums">{euro(Math.round(projected))}</div>
            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Prognose</div>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
            <div className="text-lg font-black text-gray-700 tabular-nums">{euro(tagesZiel)}</div>
            <div className="text-[10px] text-gray-500 font-semibold mt-0.5">Tagesziel</div>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>Fortschritt zum Tagesziel</span>
            <span className="font-bold text-gray-700">{progressPct}%</span>
          </div>
          <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
            {/* Projected bar (background) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-blue-200 transition-all duration-700"
              style={{ width: `${projectedPct}%` }}
            />
            {/* Actual bar */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] mt-1 text-gray-400">
            <span>Aktuell: {progressPct}%</span>
            <span className="text-blue-500">Prognose: {projectedPct}%</span>
          </div>
        </div>

        {/* Rate metrics */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <Euro size={12} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-gray-800 tabular-nums">{euro(Math.round(ratePerH))}/h</div>
              <div className="text-[9px] text-gray-400">Ø Umsatz/Stunde</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <Target size={12} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-gray-800 tabular-nums">{projectedOrders} Bst.</div>
              <div className="text-[9px] text-gray-400">Prognose Gesamt</div>
            </div>
          </div>
        </div>

        {/* Remaining time */}
        {remainMin > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-2">
            <Clock size={11} className="text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-500">
              Noch ca. <span className="font-bold text-gray-700">{Math.round(remainMin / 60 * 10) / 10} Std</span> verbleibend ·{' '}
              Brauche noch{' '}
              <span className={`font-bold ${projected >= tagesZiel ? 'text-emerald-600' : 'text-amber-600'}`}>
                {euro(Math.max(0, tagesZiel - data.revenueNow))}
              </span>
            </span>
          </div>
        )}

        {!onTrack && ratePerH > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
            <span className="text-[11px] text-amber-700">
              Bei aktuellem Tempo {euro(Math.round(projected))} bis Schichtende —
              {' '}{euro(Math.round(tagesZiel - projected))} unter Ziel.
              Promo-Aktion oder mehr Fahrer könnte helfen.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
