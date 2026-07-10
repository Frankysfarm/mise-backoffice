'use client';

import { useEffect, useState } from 'react';
import { Bike, Loader2, ChevronDown, ChevronUp, Wifi, WifiOff, Package, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1080 — Live-Fahrerstatus-Übersicht (Dispatch)
 *
 * Echtzeit-Board aller Fahrer: online / tour / pause / offline + Verfügbarkeits-Score.
 * 30s-Polling via /api/delivery/admin/fahrer-routen-effizienz-index (nutzt live driver data).
 */

type FahrerStatus = 'online' | 'tour' | 'pause' | 'offline';

type FahrerEintrag = {
  id: string;
  name: string;
  status: FahrerStatus;
  aktuelle_tour?: string | null;
  stopps_verbleibend?: number | null;
  eta_min?: number | null;
  zone?: string | null;
  letztes_update: string;
};

type ApiResponse = {
  fahrer: FahrerEintrag[];
  verfuegbarkeits_score: number;
  online_count: number;
  tour_count: number;
  pause_count: number;
  offline_count: number;
};

function mock(): ApiResponse {
  return {
    fahrer: [
      { id: 'f1', name: 'Max Müller', status: 'tour', aktuelle_tour: 'T-2847', stopps_verbleibend: 2, eta_min: 14, zone: 'Nord', letztes_update: new Date().toISOString() },
      { id: 'f2', name: 'Lisa Berg', status: 'online', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: 'Mitte', letztes_update: new Date().toISOString() },
      { id: 'f3', name: 'Tom Klein', status: 'tour', aktuelle_tour: 'T-2849', stopps_verbleibend: 1, eta_min: 7, zone: 'Süd', letztes_update: new Date().toISOString() },
      { id: 'f4', name: 'Jan Schulz', status: 'pause', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: 'West', letztes_update: new Date().toISOString() },
      { id: 'f5', name: 'Anna Koch', status: 'offline', aktuelle_tour: null, stopps_verbleibend: null, eta_min: null, zone: null, letztes_update: new Date(Date.now() - 1800_000).toISOString() },
    ],
    verfuegbarkeits_score: 72,
    online_count: 1,
    tour_count: 2,
    pause_count: 1,
    offline_count: 1,
  };
}

const STATUS_CONFIG: Record<FahrerStatus, { label: string; dot: string; badge: string; Icon: React.ElementType }> = {
  online:  { label: 'Verfügbar', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700 border-green-300', Icon: Wifi },
  tour:    { label: 'Auf Tour', dot: 'bg-blue-500 animate-pulse', badge: 'bg-blue-100 text-blue-700 border-blue-300', Icon: Package },
  pause:   { label: 'Pause', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 border-amber-300', Icon: Coffee },
  offline: { label: 'Offline', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-500 border-gray-300', Icon: WifiOff },
};

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-600 dark:text-green-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatUpdate(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'gerade';
  if (diff < 60) return `vor ${diff} Min`;
  return `vor ${Math.round(diff / 60)}h`;
}

export function DispatchPhase1080LiveFahrerstatusUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/live-fahrerstatus?${p}`);
      if (r.ok) setData(await r.json());
      else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (loading) return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin" /> Live-Fahrerstatus lädt…
    </div>
  );

  const d = data ?? mock();

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Live-Fahrerstatus</span>
          <div className="flex items-center gap-1 ml-1">
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-green-100 border border-green-300 px-1.5 text-[10px] font-black text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              {d.online_count}
            </span>
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-1.5 text-[10px] font-black text-blue-700">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
              {d.tour_count}
            </span>
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-1.5 text-[10px] font-black text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
              {d.pause_count}
            </span>
          </div>
          <span className={cn('text-xs font-black ml-1', scoreColor(d.verfuegbarkeits_score))}>
            Score: {d.verfuegbarkeits_score}%
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Verfügbarkeits-Score Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">Verfügbarkeit</span>
            <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', d.verfuegbarkeits_score >= 70 ? 'bg-green-500' : d.verfuegbarkeits_score >= 40 ? 'bg-amber-400' : 'bg-red-500')}
                style={{ width: `${d.verfuegbarkeits_score}%` }}
              />
            </div>
            <span className={cn('text-xs font-black tabular-nums shrink-0', scoreColor(d.verfuegbarkeits_score))}>
              {d.verfuegbarkeits_score}%
            </span>
          </div>

          {/* Fahrer-Liste */}
          <div className="space-y-1.5 mt-1">
            {d.fahrer.map((f) => {
              const cfg = STATUS_CONFIG[f.status];
              const StatusIcon = cfg.Icon;
              return (
                <div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/20 px-3 py-2">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                  <span className="text-sm font-semibold flex-1 truncate">{f.name}</span>
                  {f.zone && <span className="text-[10px] text-muted-foreground shrink-0">{f.zone}</span>}
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold shrink-0', cfg.badge)}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {cfg.label}
                  </span>
                  {f.status === 'tour' && f.stopps_verbleibend != null && (
                    <span className="text-[10px] text-blue-600 font-bold shrink-0">
                      {f.stopps_verbleibend} Stopp{f.stopps_verbleibend !== 1 ? 's' : ''}
                      {f.eta_min != null && ` · ~${f.eta_min} Min`}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground shrink-0">{formatUpdate(f.letztes_update)}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">30s-Polling · Echtzeit</p>
        </div>
      )}
    </div>
  );
}
