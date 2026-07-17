'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Clock, MapPin, Navigation, Package, Phone, Zap,
} from 'lucide-react';

/**
 * Phase 2110 — Tour-Stopp-Echtzeit-Navigator (Fahrer-App)
 *
 * Kompakte, mobile-optimierte Stop-Liste mit:
 * - Aktueller Stopp als Hero-Card (groß, mit Navi + Anruf-CTA)
 * - Verbleibende Stopps als kompakte Liste
 * - Tour-Fortschrittsring oben
 * - ETA-Countdown per Stopp (statisch berechnet, kein API-Call)
 * - "Abgeliefert"-Button je Stopp (onConfirmStop Callback)
 */

interface Stop {
  id: string;
  reihenfolge?: number | null;
  address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  lat?: number | null;
  lng?: number | null;
  items?: { name: string; menge: number }[];
  estimated_arrival_at?: string | null;
}

interface Props {
  stops: Stop[];
  driverId?: string;
  onConfirmStop?: (stopId: string) => Promise<void>;
}

type StopStatus = 'delivered' | 'arrived' | 'pending';

function getStopStatus(stop: Stop): StopStatus {
  const s = stop.status ?? '';
  if (s === 'delivered' || s === 'geliefert' || s === 'completed') return 'delivered';
  if (s === 'arrived' || s === 'angekommen') return 'arrived';
  return 'pending';
}

function openMapsDeeplink(stop: Stop) {
  if (!stop.lat && !stop.lng && !stop.address) return;
  const coord = stop.lat && stop.lng ? `${stop.lat},${stop.lng}` : '';
  const addr = encodeURIComponent(stop.address ?? '');
  const query = coord || addr;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  if (isIOS) {
    window.location.href = coord
      ? `maps://maps.apple.com/?daddr=${coord}`
      : `maps://maps.apple.com/?daddr=${addr}`;
  } else if (isAndroid) {
    window.location.href = coord
      ? `geo:${coord}?q=${coord}`
      : `geo:0,0?q=${addr}`;
  } else {
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  }
}

function fmtEta(isoStr: string | null | undefined): string | null {
  if (!isoStr) return null;
  const ms = new Date(isoStr).getTime() - Date.now();
  if (ms <= 0) return 'Jetzt';
  const m = Math.ceil(ms / 60_000);
  return `~${m} Min`;
}

export function FahrerPhase2110TourStoppEchtzeitNavigator({ stops, onConfirmStop }: Props) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, StopStatus>>({});
  const [showAll, setShowAll] = useState(false);

  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));

  const getStatus = (stop: Stop): StopStatus =>
    localStatus[stop.id] ?? getStopStatus(stop);

  const delivered = sorted.filter((s) => getStatus(s) === 'delivered');
  const remaining = sorted.filter((s) => getStatus(s) !== 'delivered');
  const current = remaining[0] ?? null;
  const next = remaining.slice(1);
  const total = sorted.length;
  const completedCount = delivered.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  async function handleConfirm(stopId: string) {
    setConfirming(stopId);
    try {
      await onConfirmStop?.(stopId);
      setLocalStatus((prev) => ({ ...prev, [stopId]: 'delivered' }));
    } catch {}
    finally { setConfirming(null); }
  }

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header: Progress */}
      <div className="px-4 py-3 border-b bg-matcha-50 flex items-center gap-3">
        <Navigation className="h-4 w-4 text-matcha-700 shrink-0" />
        <span className="text-sm font-bold text-matcha-800">Stopp-Navigator</span>
        <div className="flex-1 h-2 rounded-full bg-matcha-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="font-mono text-xs font-black text-matcha-700 tabular-nums shrink-0">
          {completedCount}/{total}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Aktueller Stopp — Hero */}
        {current && (
          <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-matcha-100 border-b border-matcha-200">
              <Zap className="h-3.5 w-3.5 text-matcha-700" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-700">
                Aktueller Stopp #{current.reihenfolge ?? '–'}
              </span>
              {current.estimated_arrival_at && (
                <span className="ml-auto text-[10px] font-mono font-bold text-matcha-600">
                  {fmtEta(current.estimated_arrival_at)}
                </span>
              )}
            </div>

            <div className="px-3 py-3 space-y-2">
              {/* Adresse */}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-matcha-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {current.customer_name ?? 'Kunde'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {current.address ?? 'Adresse unbekannt'}
                  </div>
                </div>
              </div>

              {/* Items */}
              {(current.items ?? []).length > 0 && (
                <div className="flex items-start gap-2">
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {(current.items ?? []).map((item, i) => (
                      <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                        {item.menge}× {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTAs */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openMapsDeeplink(current)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 text-white py-2 text-xs font-bold hover:bg-matcha-700 active:scale-95 transition-all"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Navigation
                </button>
                {current.customer_phone && (
                  <a
                    href={`tel:${current.customer_phone}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted active:scale-95 transition-all"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleConfirm(current.id)}
                  disabled={confirming === current.id}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold active:scale-95 transition-all',
                    confirming === current.id
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-foreground text-background hover:bg-foreground/90',
                  )}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {confirming === current.id ? '…' : 'Abgeliefert'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tour abgeschlossen */}
        {!current && completedCount === total && total > 0 && (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 className="h-8 w-8 text-matcha-500" />
            <span className="text-sm font-bold text-matcha-700">Tour abgeschlossen!</span>
            <span className="text-xs text-muted-foreground">{total} Stopps erfolgreich geliefert</span>
          </div>
        )}

        {/* Nächste Stopps */}
        {next.length > 0 && (
          <div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full flex items-center gap-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-3 w-3" />
              Nächste Stopps ({next.length})
              {showAll ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
            </button>

            {showAll && (
              <div className="space-y-1.5 mt-1">
                {next.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">
                      {i + 2}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {stop.customer_name ?? 'Kunde'}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {stop.address ?? '–'}
                      </div>
                    </div>
                    {stop.estimated_arrival_at && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {fmtEta(stop.estimated_arrival_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
