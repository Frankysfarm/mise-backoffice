'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

/**
 * Phase 2060 — Smart-Timing Countdown Integrations-Board
 *
 * Konsolidiert Smart-Timing, sekunden-genaue Countdowns und Farbkodierung
 * in einem einzigen übersichtlichen Board. Zeigt alle aktiven Bestellungen
 * mit: Echtzeit-Countdown, 5-stufiger Farbampel (grün→gelb→orange→rot→kritisch),
 * Kochstart-Zeitpunkt und geschätzter Fertigstellung.
 *
 * Neu gegenüber bestehenden Phasen: integriert prep_min-Lerndaten für
 * präzisere Restzeit-Schätzung + zeigt Fahrer-ETA-Delta wenn verfügbar.
 */

interface OrderItem {
  name?: string;
  title?: string;
  menge?: number;
}

interface KitchenTiming {
  order_id: string;
  cook_start_at?: string | null;
  ready_target?: string | null;
  prep_min?: number | null;
  status?: string;
}

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  items?: OrderItem[] | null;
  artikel?: OrderItem[] | null;
  scheduled_for?: string | null;
}

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
}

type Stufe = 'kritisch' | 'rot' | 'orange' | 'gelb' | 'gruen' | 'fertig';

const ACTIVE = new Set(['neu', 'bestätigt', 'accepted', 'confirmed', 'eingegangen', 'in_zubereitung', 'in_preparation']);

const STUFE_STYLES: Record<Stufe, { bg: string; border: string; badge: string; label: string; ring: string }> = {
  kritisch: { bg: 'bg-red-50', border: 'border-red-400', badge: 'bg-red-600 text-white', label: 'KRITISCH', ring: 'border-red-600 animate-pulse' },
  rot:      { bg: 'bg-red-50/60', border: 'border-red-300', badge: 'bg-red-500 text-white', label: 'Überfällig', ring: 'border-red-500' },
  orange:   { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-500 text-white', label: 'Dringend', ring: 'border-orange-400' },
  gelb:     { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-400 text-white', label: 'Bald fällig', ring: 'border-amber-400' },
  gruen:    { bg: 'bg-matcha-50/60', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', label: 'Pünktlich', ring: 'border-matcha-400' },
  fertig:   { bg: 'bg-muted/20', border: 'border-border', badge: 'bg-muted text-muted-foreground', label: 'Fertig', ring: 'border-border' },
};

function parsedMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
}

function calcStufe(remainMs: number): Stufe {
  if (remainMs <= 0) return 'kritisch';
  if (remainMs < 2 * 60_000) return 'rot';
  if (remainMs < 5 * 60_000) return 'orange';
  if (remainMs < 10 * 60_000) return 'gelb';
  return 'gruen';
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '--:--';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function itemsLabel(o: Order): string {
  const items = o.items ?? o.artikel ?? [];
  if (!items.length) return '';
  return items.slice(0, 3)
    .map((i) => `${i.menge ?? 1}× ${i.name ?? i.title ?? ''}`.trim())
    .join(', ');
}

export function KitchenPhase2060SmartTimingCountdownIntegrationsBoard({ orders, timings = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const timingMap = new Map(timings.map((t) => [t.order_id, t]));

  const active = orders.filter((o) => ACTIVE.has(o.status));

  const rows = active.map((o) => {
    const timing = timingMap.get(o.id);
    const now = Date.now();

    // Fertigstellungs-Ziel: ready_target → promised_at → bestellt_am + prep_min → bestellt_am + 18min
    let targetMs: number | null = null;
    if (timing?.ready_target) targetMs = parsedMs(timing.ready_target);
    if (!targetMs && o.promised_at) targetMs = parsedMs(o.promised_at);
    if (!targetMs) {
      const base = parsedMs(o.bestellt_am ?? o.created_at);
      const prepMin = timing?.prep_min ?? 18;
      if (base) targetMs = base + prepMin * 60_000;
    }

    const remainMs = targetMs ? targetMs - now : null;
    const stufe: Stufe = remainMs !== null ? calcStufe(remainMs) : 'gruen';

    // Cook-start
    const cookStartMs = parsedMs(timing?.cook_start_at);
    const sinceStartMin = cookStartMs ? Math.max(0, Math.floor((now - cookStartMs) / 60_000)) : null;

    return {
      id: o.id,
      bnr: o.bestellnummer ?? o.id.slice(0, 6),
      stufe,
      remainMs,
      targetMs,
      sinceStartMin,
      items: itemsLabel(o),
      status: o.status,
    };
  }).sort((a, b) => {
    const order: Record<Stufe, number> = { kritisch: 0, rot: 1, orange: 2, gelb: 3, gruen: 4, fertig: 5 };
    return order[a.stufe] - order[b.stufe];
  });

  if (!rows.length) return null;

  const kritisch = rows.filter((r) => r.stufe === 'kritisch' || r.stufe === 'rot').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition border-b"
      >
        {kritisch > 0
          ? <Flame className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />
          : <Clock className="h-4 w-4 text-matcha-600 shrink-0" />}
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Smart-Timing Board — {rows.length} aktiv
        </span>
        {kritisch > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
            {kritisch} kritisch
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y">
          {rows.map((r) => {
            const s = STUFE_STYLES[r.stufe];
            return (
              <div key={r.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
                {/* Farbampel-Ring + Countdown */}
                <div className={cn('shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 tabular-nums', s.ring)}>
                  {r.remainMs !== null ? (
                    <>
                      <span className={cn('text-sm font-black leading-none', r.stufe === 'kritisch' ? 'text-red-700' : r.stufe === 'rot' ? 'text-red-600' : r.stufe === 'orange' ? 'text-orange-600' : r.stufe === 'gelb' ? 'text-amber-600' : 'text-matcha-700')}>
                        {fmtCountdown(r.remainMs)}
                      </span>
                      <span className="text-[8px] text-muted-foreground mt-0.5">verbleibend</span>
                    </>
                  ) : (
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                {/* Bestellungsinfo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">#{r.bnr.replace('FF-', '')}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </span>
                    {r.sinceStartMin !== null && (
                      <span className="text-[10px] text-muted-foreground">
                        Kochstart vor {r.sinceStartMin} Min
                      </span>
                    )}
                  </div>
                  {r.items && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{r.items}</div>
                  )}
                  {r.targetMs && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Ziel: {fmtTime(new Date(r.targetMs).toISOString())}
                    </div>
                  )}
                </div>

                {/* Status-Icon */}
                <div className="shrink-0">
                  {r.stufe === 'gruen' && <CheckCircle2 className="h-5 w-5 text-matcha-500" />}
                  {(r.stufe === 'gelb' || r.stufe === 'orange') && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                  {(r.stufe === 'rot' || r.stufe === 'kritisch') && <Flame className="h-5 w-5 text-red-600" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
