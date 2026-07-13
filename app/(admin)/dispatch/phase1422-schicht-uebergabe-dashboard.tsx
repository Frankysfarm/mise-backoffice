'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Users, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1422 — Schicht-Übergabe-Dashboard (Dispatch)
 *
 * Zeigt Phase1420-API (/api/delivery/admin/schicht-uebergabe-report):
 *   • Queue-Tiefe + max. Wartezeit
 *   • Aktive / in Tour fahrende Fahrer
 *   • Kritische Alarme mit Empfehlung
 *   • Status-Ampel ok/warnung/kritisch
 *
 * 10-Min-Polling. Nach Phase1417 in dispatch/client.tsx.
 */

interface OffeneBestellung {
  id: string;
  bestellnummer: string;
  status: string;
  wartezeit_min: number;
  kritisch: boolean;
}

interface ApiData {
  offene_bestellungen: OffeneBestellung[];
  aktive_fahrer: number;
  fahrer_in_tour: number;
  queue_tiefe: number;
  max_wartezeit_min: number;
  kritische_alarme: number;
  status: 'ok' | 'warnung' | 'kritisch';
  empfehlung: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG = {
  ok:       { label: 'Alles OK',  color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', dot: 'bg-emerald-500' },
  warnung:  { label: 'Warnung',   color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',     dot: 'bg-amber-500'   },
  kritisch: { label: 'Kritisch',  color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-200 dark:border-rose-700',       dot: 'bg-rose-500'    },
};

const POLL_MS = 10 * 60 * 1000;

export function DispatchPhase1422SchichtUebergabeDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [showOrders, setShowOrders] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-uebergabe-report?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!locationId || !data) return null;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', cfg.bg, cfg.border)}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
          <span className={cn('text-sm font-semibold', cfg.color)}>Schicht-Übergabe</span>
          <span className={cn('text-xs font-bold rounded-full px-2 py-0.5', cfg.bg, cfg.color, 'border', cfg.border)}>
            {cfg.label}
          </span>
          {loading && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: Package, label: 'Queue',       value: data.queue_tiefe,          unit: 'Bestellungen' },
              { icon: Clock,   label: 'Max Warten',  value: data.max_wartezeit_min,    unit: 'Min'          },
              { icon: Users,   label: 'Fahrer Online', value: data.aktive_fahrer,      unit: 'Aktiv'        },
              { icon: Users,   label: 'In Tour',     value: data.fahrer_in_tour,       unit: 'Fahrer'       },
            ].map(({ icon: Icon, label, value, unit }) => (
              <div key={label} className="rounded-lg bg-white/60 dark:bg-black/20 border border-white/80 dark:border-white/10 px-3 py-2 text-center">
                <Icon className={cn('w-4 h-4 mx-auto mb-0.5', cfg.color)} />
                <div className={cn('text-xl font-black tabular-nums', cfg.color)}>{value}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{unit}</div>
                <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</div>
              </div>
            ))}
          </div>

          {/* Kritische Alarme */}
          {data.kritische_alarme > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-100 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  {data.kritische_alarme} kritische Bestellung{data.kritische_alarme > 1 ? 'en' : ''}
                </p>
                {data.empfehlung && (
                  <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">{data.empfehlung}</p>
                )}
              </div>
            </div>
          )}

          {/* Empfehlung (kein Alarm) */}
          {data.kritische_alarme === 0 && data.empfehlung && (
            <p className={cn('text-xs font-medium', cfg.color)}>{data.empfehlung}</p>
          )}

          {/* Offene Bestellungen ausklappen */}
          {data.offene_bestellungen.length > 0 && (
            <button
              onClick={() => setShowOrders((p) => !p)}
              className={cn('text-xs font-semibold underline underline-offset-2', cfg.color)}
            >
              {showOrders ? 'Bestellungen ausblenden' : `${data.offene_bestellungen.length} Bestellung${data.offene_bestellungen.length > 1 ? 'en' : ''} anzeigen`}
            </button>
          )}

          {showOrders && (
            <div className="space-y-1.5">
              {data.offene_bestellungen.map((o) => (
                <div
                  key={o.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2',
                    o.kritisch
                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700'
                      : 'bg-white/60 dark:bg-black/20 border-slate-200 dark:border-slate-700',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {o.kritisch && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">#{o.bestellnummer}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{o.status}</span>
                  </div>
                  <span className={cn(
                    'text-xs font-bold tabular-nums',
                    o.kritisch ? 'text-rose-600 dark:text-rose-400' : o.wartezeit_min > 15 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
                  )}>
                    {o.wartezeit_min} Min
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 10 Min aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
