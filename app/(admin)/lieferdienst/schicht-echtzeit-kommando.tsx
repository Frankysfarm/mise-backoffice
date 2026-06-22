'use client';

/**
 * SchichtEchtzeitKommando — Phase 405
 * Kompakte Echtzeit-Kommando-Zentrale für den Schichtleiter:
 * - Live-Kapazität: aktive Fahrer + Bestellungen in Arbeit
 * - Durchsatz: Lieferungen/h der letzten Stunde
 * - Top-Alert: kritischste Warnung (Delay, Kapazität, SLA)
 * - Ampelstatus als kompakter Schnell-Überblick
 * 60-Sekunden-Polling, collapsible
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, Loader2, RefreshCw,
  TrendingUp, Users, Zap, AlertCircle,
} from 'lucide-react';

interface LiveSnapshot {
  activeDrivers: number;
  onlineDrivers: number;
  activeOrders: number;
  pendingOrders: number;
  deliveriesLastHour: number;
  avgDeliveryMin: number;
  onTimePct: number;
  capacityStatus: 'frei' | 'normal' | 'voll' | 'überlastet' | 'unbekannt';
  loadPct: number;
  topAlert: string | null;
}

const MOCK_SNAPSHOT: LiveSnapshot = {
  activeDrivers: 0,
  onlineDrivers: 0,
  activeOrders: 0,
  pendingOrders: 0,
  deliveriesLastHour: 0,
  avgDeliveryMin: 0,
  onTimePct: 0,
  capacityStatus: 'unbekannt',
  loadPct: 0,
  topAlert: null,
};

const CAPACITY_STYLE: Record<string, { bg: string; text: string; badge: string }> = {
  frei:        { bg: 'bg-matcha-50',  text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700' },
  normal:      { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700'   },
  voll:        { bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700'  },
  überlastet:  { bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700'    },
  unbekannt:   { bg: 'bg-gray-50',   text: 'text-gray-600',   badge: 'bg-gray-100 text-gray-600'  },
};

function KpiChip({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string | number; icon: React.ElementType; accent?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-xl py-2 px-3 min-w-0', accent ?? 'bg-white border border-gray-100')}>
      <Icon size={14} className="text-gray-400 mb-0.5" />
      <div className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-gray-500 text-center leading-tight">{label}</div>
    </div>
  );
}

export function SchichtEchtzeitKommando({ locationId }: { locationId: string | null }) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>(MOCK_SNAPSHOT);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const [statsRes, capacityRes] = await Promise.allSettled([
        fetch(`/api/delivery/admin/stats?location_id=${locationId}&period=today`, { cache: 'no-store' }),
        fetch(`/api/delivery/admin/capacity-signal?location_id=${locationId}`, { cache: 'no-store' }),
      ]);

      const snap: LiveSnapshot = { ...MOCK_SNAPSHOT };

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        snap.activeOrders  = data.active_orders ?? data.pending_orders ?? 0;
        snap.pendingOrders = data.pending_orders ?? 0;
        snap.deliveriesLastHour = data.deliveries_last_hour ?? data.stops_per_hour ?? 0;
        snap.avgDeliveryMin = data.avg_delivery_min ?? 0;
        snap.onTimePct = data.on_time_rate ?? data.on_time_pct ?? 0;
        snap.activeDrivers = data.active_drivers ?? 0;
        snap.onlineDrivers = data.online_drivers ?? data.active_drivers ?? 0;
      }

      if (capacityRes.status === 'fulfilled' && capacityRes.value.ok) {
        const data = await capacityRes.value.json();
        const cap = data.snapshot ?? data;
        snap.capacityStatus = cap.capacity_status ?? 'unbekannt';
        snap.loadPct = cap.load_pct ?? 0;
        if (cap.capacity_status === 'überlastet') {
          snap.topAlert = `Kapazität überlastet (${Math.round(cap.load_pct ?? 0)}% Last)`;
        } else if (cap.capacity_status === 'voll') {
          snap.topAlert = `Kapazität voll — ggf. Fahrer online holen`;
        }
      }

      if (!snap.topAlert && snap.onTimePct < 80 && snap.onTimePct > 0) {
        snap.topAlert = `Pünktlichkeitsrate unter 80% (${snap.onTimePct.toFixed(0)}%)`;
      }
      if (!snap.topAlert && snap.avgDeliveryMin > 45 && snap.avgDeliveryMin > 0) {
        snap.topAlert = `Ø Lieferzeit ${snap.avgDeliveryMin.toFixed(0)} Min — erhöht`;
      }

      setSnapshot(snap);
      setLastUpdated(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchSnapshot();
    intervalRef.current = setInterval(fetchSnapshot, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchSnapshot]);

  const capStyle = CAPACITY_STYLE[snapshot.capacityStatus] ?? CAPACITY_STYLE.unbekannt;
  const isAlert = snapshot.capacityStatus === 'voll' || snapshot.capacityStatus === 'überlastet';
  const isGood  = snapshot.onTimePct >= 90 && !isAlert;

  return (
    <div className={cn('rounded-2xl border shadow-sm overflow-hidden', capStyle.bg)}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-200/60"
      >
        <div className="flex items-center gap-2.5">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', capStyle.badge)}>
            <Activity size={16} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-gray-900">Schicht-Kommando</div>
            <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <span className={cn('font-semibold capitalize', capStyle.text)}>{snapshot.capacityStatus}</span>
              {snapshot.loadPct > 0 && (
                <span className="text-gray-400">· {Math.round(snapshot.loadPct)}% Last</span>
              )}
              {lastUpdated && (
                <span className="text-gray-400">
                  · {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={13} className="animate-spin text-gray-400" />}
          {!loading && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fetchSnapshot(); }}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <RefreshCw size={13} />
            </button>
          )}
          {isAlert && (
            <AlertTriangle size={14} className={cn('animate-pulse', capStyle.text)} />
          )}
          {isGood && <CheckCircle2 size={14} className="text-matcha-500" />}
          <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 pt-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-2">
            <KpiChip
              label="Fahrer aktiv"
              value={snapshot.activeDrivers}
              icon={Bike}
              accent="bg-white border border-gray-100"
            />
            <KpiChip
              label="Bestellungen"
              value={snapshot.activeOrders}
              icon={Zap}
              accent="bg-white border border-gray-100"
            />
            <KpiChip
              label="Liefg./h"
              value={snapshot.deliveriesLastHour}
              icon={TrendingUp}
              accent="bg-white border border-gray-100"
            />
            <KpiChip
              label="Pünktlich"
              value={snapshot.onTimePct > 0 ? `${snapshot.onTimePct.toFixed(0)}%` : '—'}
              icon={Clock}
              accent={cn(
                'border',
                snapshot.onTimePct >= 90 ? 'bg-matcha-50 border-matcha-200' :
                snapshot.onTimePct >= 75 ? 'bg-amber-50 border-amber-200' :
                snapshot.onTimePct >  0  ? 'bg-red-50 border-red-200' :
                'bg-white border-gray-100',
              )}
            />
          </div>

          {/* Kapazitäts-Balken */}
          {snapshot.loadPct > 0 && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-500 font-medium">Kapazitäts-Auslastung</span>
                <span className={cn('font-bold', capStyle.text)}>{Math.round(snapshot.loadPct)}%</span>
              </div>
              <div className="h-2 bg-white/60 rounded-full border border-gray-200 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    snapshot.loadPct >= 90 ? 'bg-red-500' :
                    snapshot.loadPct >= 70 ? 'bg-amber-400' :
                    'bg-matcha-500',
                  )}
                  style={{ width: `${Math.min(100, snapshot.loadPct)}%` }}
                />
              </div>
            </div>
          )}

          {/* Top-Alert */}
          {snapshot.topAlert && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs text-red-700 font-medium">{snapshot.topAlert}</span>
            </div>
          )}
          {!snapshot.topAlert && snapshot.onTimePct >= 90 && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
              <CheckCircle2 size={14} className="text-matcha-500 shrink-0" />
              <span className="text-xs text-matcha-700 font-medium">Schicht läuft optimal — keine kritischen Hinweise</span>
            </div>
          )}

          {/* Ø Lieferzeit */}
          {snapshot.avgDeliveryMin > 0 && (
            <div className="text-center text-[11px] text-gray-400">
              Ø Lieferzeit heute: <span className="font-bold text-gray-700">{snapshot.avgDeliveryMin.toFixed(0)} Min</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
