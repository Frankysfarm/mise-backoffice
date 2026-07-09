'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ClipboardList, ChevronDown, ChevronUp, Route, Clock, Users, AlertCircle, CheckCircle2, Package } from 'lucide-react';

/**
 * Phase 938 — Schicht-Übergabe-Cockpit (Dispatch)
 *
 * Strukturierte Übergabe-Checkliste:
 * offene Touren, wartende Bestellungen, Fahrer-Status.
 */

interface BatchStop {
  id: string;
  order_id: string;
  geliefert_am: string | null;
  order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
  locationId: string | null;
}

const ACTIVE_STATUSES = ['on_route', 'unterwegs', 'at_restaurant', 'pickup', 'assigned', 'zugewiesen'];
const PENDING_STATUSES = ['created', 'pending', 'ready', 'fertig', 'neu', 'bestätigt'];

function getElapsedMin(batch: Batch): number {
  const start = batch.startzeit ?? batch.started_at;
  if (!start) return 0;
  return Math.floor((Date.now() - new Date(start).getTime()) / 60_000);
}

export function DispatchPhase938SchichtUebergabeCockpit({ batches }: Props) {
  const [open, setOpen] = useState(false);

  const { aktivTouren, wartendBatches, fertigTouren, driverStats } = useMemo(() => {
    const aktiv = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
    const wartend = batches.filter((b) => PENDING_STATUSES.includes(b.status) && !b.fahrer_id);
    const fertig = batches.filter((b) => ['completed', 'abgeschlossen', 'delivered'].includes(b.status));

    const fahrerSet = new Set<string>();
    const aktivFahrerIds = new Set<string>();
    for (const b of batches) {
      if (b.fahrer_id) {
        fahrerSet.add(b.fahrer_id);
        if (ACTIVE_STATUSES.includes(b.status)) aktivFahrerIds.add(b.fahrer_id);
      }
    }

    return {
      aktivTouren: aktiv,
      wartendBatches: wartend,
      fertigTouren: fertig,
      driverStats: {
        gesamt: fahrerSet.size,
        aktiv: aktivFahrerIds.size,
        frei: fahrerSet.size - aktivFahrerIds.size,
      },
    };
  }, [batches]);

  const offeneStopps = aktivTouren.reduce(
    (s, b) => s + b.stops.filter((st) => !st.geliefert_am).length,
    0,
  );

  const criticalTours = aktivTouren.filter((b) => {
    const elapsed = getElapsedMin(b);
    return b.total_eta_min !== null && elapsed > b.total_eta_min + 10;
  });

  const now = new Date();
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white hover:bg-stone-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-stone-600" />
          <span className="text-sm font-bold text-stone-800">Schicht-Übergabe</span>
          <span className="text-xs text-stone-400">· Stand {timeStr}</span>
        </div>
        <div className="flex items-center gap-3">
          {criticalTours.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <AlertCircle className="w-2.5 h-2.5" />
              {criticalTours.length} kritisch
            </span>
          )}
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold">{aktivTouren.length} aktiv</span>
            <span>·</span>
            <span>{wartendBatches.length} wartend</span>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {/* Section 1: Offene Touren */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Route className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Aktive Touren ({aktivTouren.length})
              </span>
              {offeneStopps > 0 && (
                <span className="text-[10px] text-stone-400">{offeneStopps} offene Stopps</span>
              )}
            </div>

            {aktivTouren.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-stone-400 py-1">
                <CheckCircle2 className="w-3 h-3 text-matcha-500" />
                Keine aktiven Touren
              </div>
            ) : (
              <div className="space-y-1.5">
                {aktivTouren.map((b) => {
                  const elapsed = getElapsedMin(b);
                  const isCrit = b.total_eta_min !== null && elapsed > b.total_eta_min + 10;
                  const doneStops = b.stops.filter((s) => s.geliefert_am).length;
                  const totalStops = b.stops.length;
                  const pct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;

                  return (
                    <div
                      key={b.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 border',
                        isCrit ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-100',
                      )}
                    >
                      <div className="shrink-0">
                        {isCrit ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        ) : (
                          <Route className="w-3.5 h-3.5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-stone-700 truncate">
                            {b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname}` : 'Fahrer'}
                          </span>
                          {b.zone && (
                            <span className="text-[9px] bg-stone-200 text-stone-600 rounded px-1">Zone {b.zone}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 rounded-full bg-stone-200 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', isCrit ? 'bg-red-500' : 'bg-blue-500')}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-stone-500 shrink-0">{doneStops}/{totalStops}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={cn('text-xs font-bold tabular-nums', isCrit ? 'text-red-600' : 'text-stone-600')}>
                          {elapsed}m
                        </div>
                        {b.total_eta_min && (
                          <div className="text-[9px] text-stone-400">/{b.total_eta_min}m</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Wartende Bestellungen */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Wartende Bestellungen ({wartendBatches.length})
              </span>
            </div>

            {wartendBatches.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-stone-400 py-1">
                <CheckCircle2 className="w-3 h-3 text-matcha-500" />
                Keine wartenden Bestellungen
              </div>
            ) : (
              <div className="space-y-1">
                {wartendBatches.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-xs text-stone-600 flex-1 truncate">
                      {b.stops.length > 0
                        ? `${b.stops.length} Stopp${b.stops.length !== 1 ? 's' : ''}`
                        : 'Batch'}{' '}
                      {b.zone ? `· Zone ${b.zone}` : ''}
                    </span>
                    <span className="text-[9px] text-amber-600 font-semibold shrink-0">Kein Fahrer</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Fahrer-Status */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5 text-matcha-600" />
              <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Fahrer-Status</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Gesamt', val: driverStats.gesamt, color: 'text-stone-700 bg-stone-100' },
                { label: 'Aktiv', val: driverStats.aktiv, color: 'text-blue-700 bg-blue-50' },
                { label: 'Frei', val: driverStats.frei, color: 'text-matcha-700 bg-matcha-50' },
              ].map(({ label, val, color }) => (
                <div key={label} className={cn('rounded-lg p-2 text-center', color)}>
                  <div className="text-xl font-black tabular-nums">{val}</div>
                  <div className="text-[10px] font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer: Summary */}
          <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100">
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
              <div className="text-xs text-stone-500 space-y-0.5">
                <p>
                  <span className="font-semibold text-stone-700">{aktivTouren.length} aktive Tour{aktivTouren.length !== 1 ? 'en' : ''}</span>
                  {' · '}
                  <span className="font-semibold text-stone-700">{wartendBatches.length} wartende</span>
                  {' · '}
                  <span className="font-semibold text-stone-700">{fertigTouren.length} abgeschlossen</span>
                </p>
                {criticalTours.length > 0 && (
                  <p className="text-red-600 font-semibold">
                    ⚠ {criticalTours.length} Tour{criticalTours.length !== 1 ? 'en' : ''} überfällig — sofort prüfen!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
