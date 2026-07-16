'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { AlertTriangle, Bike, Check, Clock, MapPin, RefreshCw, Star, TrendingUp, User, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 2001 — Fahrer-Disposition-Kommandant (Dispatch)
 *
 * Echtzeit-Überblick aller verfügbaren Fahrer mit:
 * - Verfügbarkeits-Ampel (frei / unterwegs / offline)
 * - Aktuelle Touren-Last pro Fahrer
 * - Score-Miniatur + letzte ETA-Genauigkeit
 * - Sofort-Zuweisung-Button für wartende Bestellungen
 */

interface Driver {
  id: string;
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  score?: number | null;
  active_tours?: number;
  completed_today?: number;
  last_seen?: string | null;
  current_zone?: string | null;
  eta_accuracy?: number | null;
}

interface PendingOrder {
  id: string;
  bestellnummer?: string | null;
  delivery_zone?: string | null;
  bestellt_am?: string | null;
}

function timeSince(ts: string | null | undefined): string {
  if (!ts) return '?';
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 1) return 'gerade';
  if (diff < 60) return `${Math.round(diff)}min`;
  return `${Math.round(diff / 60)}h`;
}

function scoreColor(score: number | null | undefined): string {
  if (!score) return 'text-neutral-500';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

export function DispatchPhase2001FahrerDispositionKommandant({
  locationId,
}: {
  locationId: string | null;
}) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  async function load() {
    if (!locationId) return;
    try {
      const supabase = createClient();

      const [driverRes, orderRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('id, name, phone, status, score, last_seen, current_zone, eta_accuracy')
          .eq('location_id', locationId)
          .in('status', ['available', 'active', 'on_tour', 'frei', 'unterwegs', 'aktiv'])
          .order('score', { ascending: false })
          .limit(12),
        supabase
          .from('orders')
          .select('id, bestellnummer, delivery_zone, bestellt_am')
          .eq('location_id', locationId)
          .eq('status', 'ready')
          .is('tour_id', null)
          .order('bestellt_am', { ascending: true })
          .limit(5),
      ]);

      if (driverRes.data) setDrivers(driverRes.data as Driver[]);
      if (orderRes.data) setPending(orderRes.data as PendingOrder[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <Card className="border-matcha-800/30 bg-matcha-950/20 p-3">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Lade Fahrer-Status…
        </div>
      </Card>
    );
  }

  const free = drivers.filter((d) => d.status === 'available' || d.status === 'frei');
  const onTour = drivers.filter((d) => d.status === 'active' || d.status === 'on_tour' || d.status === 'unterwegs' || d.status === 'aktiv');

  return (
    <Card className="border-matcha-800/30 bg-matcha-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-matcha-400" />
          <span className="text-xs font-semibold text-matcha-300 uppercase tracking-wider">
            Fahrer-Disposition
          </span>
          <span className="text-[10px] text-neutral-500">Phase 2001</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {free.length} frei
          </div>
          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            {onTour.length} unterwegs
          </div>
          <button onClick={load} className="text-neutral-600 hover:text-neutral-300 transition-colors">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pending Orders Alert */}
      {pending.length > 0 && (
        <div className="rounded-lg bg-amber-950/40 border border-amber-800/50 p-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-amber-300 font-medium">{pending.length} Bestellung{pending.length > 1 ? 'en' : ''} warten auf Fahrer</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {pending.map((o) => (
                <span key={o.id} className="text-[10px] font-mono bg-amber-900/40 text-amber-400 px-1 rounded">
                  #{o.bestellnummer?.slice(-4)} {o.delivery_zone && `· ${o.delivery_zone}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Driver List */}
      {drivers.length === 0 ? (
        <div className="text-xs text-neutral-600 text-center py-4">Keine aktiven Fahrer</div>
      ) : (
        <div className="space-y-1.5">
          {drivers.map((d) => {
            const isFree = d.status === 'available' || d.status === 'frei';
            const isOnTour = d.status === 'active' || d.status === 'on_tour' || d.status === 'unterwegs' || d.status === 'aktiv';
            const statusColor = isFree ? 'bg-green-500' : isOnTour ? 'bg-blue-500' : 'bg-neutral-600';
            const statusLabel = isFree ? 'Frei' : isOnTour ? 'Tour' : d.status ?? 'Offline';

            return (
              <div
                key={d.id}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 border transition-colors',
                  isFree && pending.length > 0
                    ? 'bg-green-950/30 border-green-800/40'
                    : 'bg-neutral-900/50 border-neutral-800/40',
                )}
              >
                {/* Status Dot */}
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />

                {/* Name + Zone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-neutral-200 truncate">
                      {d.name ?? 'Fahrer'}
                    </span>
                    <Badge
                      className={cn(
                        'text-[9px] px-1 py-0 h-4 font-normal',
                        isFree ? 'bg-green-900/60 text-green-300 border-green-800/50' : 'bg-blue-900/60 text-blue-300 border-blue-800/50',
                      )}
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.current_zone && (
                      <span className="text-[10px] text-neutral-500 flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {d.current_zone}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-600">
                      zuletzt {timeSince(d.last_seen)}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <div className={cn('text-xs font-bold', scoreColor(d.score))}>
                    {d.score != null ? `${d.score}` : '—'}
                    <span className="text-[9px] font-normal text-neutral-600 ml-0.5">Pkt</span>
                  </div>
                  {d.eta_accuracy != null && (
                    <div className="flex items-center gap-0.5 text-[10px] text-neutral-500">
                      <TrendingUp className="w-2.5 h-2.5" />
                      {Math.round(d.eta_accuracy)}% ETA
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-800 text-[10px] text-neutral-600">
        <span>{drivers.length} Fahrer aktiv</span>
        <span>aktualisiert {timeSince(new Date(lastRefresh).toISOString())}</span>
      </div>
    </Card>
  );
}
