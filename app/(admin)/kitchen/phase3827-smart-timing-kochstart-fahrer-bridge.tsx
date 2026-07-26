'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Zap, CheckCircle2, AlertTriangle, TrendingUp, Bike } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 3827 — Smart-Timing Kochstart-Fahrer-Bridge Cockpit
 * Sekundengenauer Countdown je Bestellung; 4-stufige Farbkodierung grün/gelb/orange/rot;
 * Fahrer-ETA-Sync-Balken; Kochstart-Score 0–100; On-Time-Rate; Überfällig-Alert;
 * 1-Sek-Tick + 15-Sek-Polling; Mock-Fallback.
 */

interface BestellungRow {
  bestell_id: string;
  bestell_nr: string;
  artikel_count: number;
  restzeit_sek: number;
  fahrer_eta_sek: number | null;
  fortschritt_pct: number;
  status: 'wartend' | 'in_zubereitung' | 'fertig' | 'abgeholt';
}

interface ApiData {
  bestellungen: BestellungRow[];
  kochstart_score: number;
  on_time_rate_pct: number;
  ueberfallig_count: number;
  avg_prep_min: number;
  fahrer_sync_rate_pct: number;
}

const MOCK: ApiData = {
  bestellungen: [
    { bestell_id: 'b1', bestell_nr: '#1105', artikel_count: 3, restzeit_sek: 900, fahrer_eta_sek: 600, fortschritt_pct: 10, status: 'in_zubereitung' },
    { bestell_id: 'b2', bestell_nr: '#1104', artikel_count: 2, restzeit_sek: 420, fahrer_eta_sek: 180, fortschritt_pct: 60, status: 'in_zubereitung' },
    { bestell_id: 'b3', bestell_nr: '#1103', artikel_count: 4, restzeit_sek: 90,  fahrer_eta_sek: 60,  fortschritt_pct: 88, status: 'in_zubereitung' },
    { bestell_id: 'b4', bestell_nr: '#1102', artikel_count: 1, restzeit_sek: -45, fahrer_eta_sek: 120, fortschritt_pct: 100, status: 'fertig' },
    { bestell_id: 'b5', bestell_nr: '#1101', artikel_count: 2, restzeit_sek: 1200, fahrer_eta_sek: null, fortschritt_pct: 0, status: 'wartend' },
  ],
  kochstart_score: 82,
  on_time_rate_pct: 87,
  ueberfallig_count: 1,
  avg_prep_min: 13.5,
  fahrer_sync_rate_pct: 91,
};

function fmt(sek: number): string {
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sek < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function farbe(sek: number) {
  if (sek < 0)    return { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50 dark:bg-red-950',    ring: 'ring-red-300' };
  if (sek < 120)  return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950', ring: 'ring-orange-300' };
  if (sek < 360)  return { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-950', ring: 'ring-yellow-300' };
  return                  { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950', ring: 'ring-emerald-300' };
}

function scoreColor(s: number) {
  if (s >= 85) return 'text-emerald-600';
  if (s >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function statusLabel(s: BestellungRow['status']) {
  return { wartend: 'Wartend', in_zubereitung: 'In Zubereitung', fertig: 'Fertig', abgeholt: 'Abgeholt' }[s];
}

export function KitchenPhase3827SmartTimingKochstartFahrerBridge() {
  const [data, setData]     = useState<ApiData>(MOCK);
  const [tick, setTick]     = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data: rows } = await sb
        .from('orders')
        .select('id, order_number, items_count, promised_at, picked_up_at, driver_eta_seconds, prep_progress_pct, status')
        .in('status', ['confirmed', 'preparing', 'ready', 'picked_up'])
        .order('promised_at', { ascending: true })
        .limit(6);
      if (rows && rows.length > 0) {
        const now = Date.now();
        const mapped: BestellungRow[] = rows.map((r: any) => ({
          bestell_id: r.id,
          bestell_nr: `#${r.order_number}`,
          artikel_count: r.items_count ?? 1,
          restzeit_sek: r.promised_at ? Math.round((new Date(r.promised_at).getTime() - now) / 1000) : 900,
          fahrer_eta_sek: r.driver_eta_seconds ?? null,
          fortschritt_pct: r.prep_progress_pct ?? 0,
          status: r.status === 'preparing' ? 'in_zubereitung' : r.status === 'ready' ? 'fertig' : r.status === 'picked_up' ? 'abgeholt' : 'wartend',
        }));
        setData(prev => ({ ...prev, bestellungen: mapped }));
      }
    } catch { /* mock fallback */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); const id = setInterval(fetch_, 15_000); return () => clearInterval(id); }, [fetch_]);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1_000); return () => clearInterval(id); }, []);

  const active = data.bestellungen.filter(b => b.status !== 'abgeholt');
  const ueberfallig = active.filter(b => b.restzeit_sek < 0);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          <span className="font-semibold text-sm">Smart-Timing Fahrer-Bridge</span>
          {loading && <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`font-bold ${scoreColor(data.kochstart_score)}`}>Score {data.kochstart_score}</span>
          <span className="text-zinc-500">{data.on_time_rate_pct}% On-Time</span>
          <span className="text-zinc-400"><Bike className="inline h-3 w-3 mr-0.5" />{data.fahrer_sync_rate_pct}% Sync</span>
        </div>
      </div>

      {/* Überfällig-Alert */}
      {ueberfallig.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{ueberfallig.length} Bestellung{ueberfallig.length > 1 ? 'en' : ''} überfällig!</span>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Aktiv',    value: active.length,           unit: '' },
          { label: 'Ø Prep',   value: data.avg_prep_min.toFixed(1), unit: 'min' },
          { label: 'Überfällig', value: data.ueberfallig_count, unit: '' },
          { label: 'Pünktlich', value: `${data.on_time_rate_pct}%`, unit: '' },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-center">
            <div className="text-base font-bold text-zinc-800 dark:text-zinc-100">{k.value}{k.unit}</div>
            <div className="text-[10px] text-zinc-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Order cards */}
      <div className="space-y-2">
        {active.slice(0, 5).map(b => {
          const sek = b.restzeit_sek - tick;
          const c = farbe(sek);
          const pct = Math.min(100, Math.max(0, b.fortschritt_pct));
          const syncOk = b.fahrer_eta_sek !== null && b.fahrer_eta_sek < sek;
          return (
            <div key={b.bestell_id} className={`rounded-lg border ring-1 ${c.ring} ${c.bg} px-3 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">{b.bestell_nr}</span>
                  <span className="text-[10px] text-zinc-500">{b.artikel_count} Artikel</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">{statusLabel(b.status)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {b.fahrer_eta_sek !== null && (
                    <span className={`flex items-center gap-0.5 text-xs ${syncOk ? 'text-emerald-600' : 'text-orange-600'}`}>
                      <Bike className="h-3 w-3" />{fmt(b.fahrer_eta_sek)}
                    </span>
                  )}
                  <span className={`font-mono font-bold text-sm ${c.text}`}>{fmt(sek)}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
              </div>
              {b.fahrer_eta_sek !== null && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-500">
                  <Bike className="h-2.5 w-2.5" />
                  <span>Fahrer ETA: {fmt(b.fahrer_eta_sek)} — {syncOk ? '✓ synchron' : '⚠ Kochstart beschleunigen'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <span>15s Polling · 1s Tick</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Avg {data.avg_prep_min.toFixed(1)} min</span>
      </div>
    </div>
  );
}
