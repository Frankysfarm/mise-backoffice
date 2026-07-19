'use client';

/**
 * Phase 2511 — Smart-Timing Cockpit Final
 * Aggregiertes Echtzeit-Cockpit: Countdown-Grid + Farbkodierung + Kritisch-Banner.
 * Zeigt die wichtigsten Bestellungen sortiert nach Dringlichkeit.
 * 15-Sek-Countdown-Tick, 30-Sek-API-Polling.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Flame, ChevronDown, ChevronUp } from 'lucide-react';

interface OrderRow {
  id: string;
  nr: string;
  name: string;
  verbleibendSek: number;
  prepMin: number;
  status: 'gruen' | 'gelb' | 'rot' | 'ueberfaellig';
}

function farbklasse(s: OrderRow['status']) {
  switch (s) {
    case 'gruen': return 'bg-emerald-50 border-emerald-300 text-emerald-800';
    case 'gelb': return 'bg-amber-50 border-amber-300 text-amber-800';
    case 'rot': return 'bg-red-50 border-red-300 text-red-800';
    default: return 'bg-gray-100 border-gray-400 text-gray-700 line-through opacity-60';
  }
}

function statusFarbe(s: OrderRow['status']): string {
  if (s === 'gruen') return '#22c55e';
  if (s === 'gelb') return '#f59e0b';
  if (s === 'rot') return '#ef4444';
  return '#9ca3af';
}

function countdown(sek: number) {
  if (sek <= 0) return <span className="text-gray-500 font-mono text-xs">–:––</span>;
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return (
    <span className="font-mono text-base font-bold tabular-nums">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function CountdownRing({ sek, maxSek, status }: { sek: number; maxSek: number; status: OrderRow['status'] }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const pct = maxSek > 0 ? Math.max(0, Math.min(1, sek / maxSek)) : 0;
  const offset = circ * (1 - pct);
  return (
    <svg width={34} height={34} className="shrink-0">
      <circle cx={17} cy={17} r={r} fill="none" stroke="#e5e7eb" strokeWidth={3} />
      <circle
        cx={17} cy={17} r={r} fill="none"
        stroke={statusFarbe(status)} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 17 17)"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}

export function KitchenPhase2511SmartTimingCockpitFinal({
  orders,
  timings,
}: {
  orders: any[];
  timings: any[];
}) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const rows: OrderRow[] = orders
    .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map(o => {
      const timing = timings.find(t => t.order_id === o.id || t.orderId === o.id);
      const prepMin: number = timing?.prepMin ?? timing?.prep_min ?? 15;
      const startAt: number | null = o.zubereitung_start
        ? new Date(o.zubereitung_start).getTime()
        : o.started_at
        ? new Date(o.started_at).getTime()
        : null;
      const elapsedSek = startAt ? Math.floor((now - startAt) / 1000) : 0;
      const totalSek = prepMin * 60;
      const verbleibendSek = Math.max(0, totalSek - elapsedSek);
      let status: OrderRow['status'];
      if (o.status !== 'in_zubereitung') status = 'gruen';
      else if (verbleibendSek > 300) status = 'gruen';
      else if (verbleibendSek > 60) status = 'gelb';
      else if (verbleibendSek > 0) status = 'rot';
      else status = 'ueberfaellig';

      return {
        id: o.id,
        nr: (o as any).bestellnummer ?? o.id.slice(-4),
        name: (o as any).kunde_name ?? (o as any).name ?? 'Gast',
        verbleibendSek,
        prepMin,
        status,
      };
    })
    .sort((a, b) => a.verbleibendSek - b.verbleibendSek);

  const kritisch = rows.filter(r => r.status === 'rot' || r.status === 'ueberfaellig');
  const onTimeQuote = rows.length > 0
    ? Math.round((rows.filter(r => r.status === 'gruen' || r.status === 'gelb').length / rows.length) * 100)
    : 100;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-matcha-50 hover:bg-matcha-100 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-matcha-800">Smart-Timing Cockpit</span>
          {kritisch.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <Flame className="h-3 w-3" /> {kritisch.length} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            'text-xs font-bold tabular-nums',
            onTimeQuote >= 80 ? 'text-emerald-600' : onTimeQuote >= 60 ? 'text-amber-600' : 'text-red-600'
          )}>
            {onTimeQuote}% on-time
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-matcha-500" /> : <ChevronDown className="h-4 w-4 text-matcha-500" />}
        </div>
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {[
              { label: 'Aktiv', val: rows.length, color: 'text-matcha-700' },
              { label: 'Kritisch', val: kritisch.length, color: 'text-red-600' },
              { label: 'On-Time', val: `${onTimeQuote}%`, color: onTimeQuote >= 80 ? 'text-emerald-600' : 'text-amber-600' },
            ].map(kpi => (
              <div key={kpi.label} className="text-center rounded-lg bg-gray-50 border border-gray-100 py-2 px-1">
                <div className={cn('text-lg font-black tabular-nums', kpi.color)}>{kpi.val}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Bestellungs-Grid */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {rows.slice(0, 12).map(row => (
              <div
                key={row.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2 transition-all',
                  farbklasse(row.status),
                )}
              >
                <CountdownRing sek={row.verbleibendSek} maxSek={row.prepMin * 60} status={row.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">#{row.nr}</span>
                    <span className="truncate text-xs font-semibold">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {countdown(row.verbleibendSek)}
                    {row.status === 'ueberfaellig' && (
                      <span className="text-[9px] font-bold uppercase text-red-500">ÜBERFÄLLIG</span>
                    )}
                    {row.status === 'rot' && row.verbleibendSek > 0 && (
                      <span className="text-[9px] font-bold uppercase text-red-500">JETZT!</span>
                    )}
                  </div>
                </div>
                {row.status === 'gruen' && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {(row.status === 'rot' || row.status === 'ueberfaellig') && (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
                )}
              </div>
            ))}
          </div>

          {rows.length > 12 && (
            <p className="text-center text-[10px] text-gray-400">+{rows.length - 12} weitere Bestellungen</p>
          )}
        </div>
      )}
    </div>
  );
}
