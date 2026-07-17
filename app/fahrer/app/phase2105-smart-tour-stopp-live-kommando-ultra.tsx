'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  Clock, MapPin, Navigation, Package, Phone, Star, Truck, Zap,
} from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge?: number | null;
  address?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  order_id?: string | null;
  items?: { name: string; menge: number }[];
}

interface Props {
  stops: Stop[];
  driverId?: string;
  onConfirmStop?: (stopId: string) => void;
}

type StopStatus = 'pending' | 'arrived' | 'delivered' | 'failed';

function getStatus(stop: Stop): StopStatus {
  const s = stop.status ?? 'pending';
  if (s === 'delivered' || s === 'geliefert') return 'delivered';
  if (s === 'arrived' || s === 'angekommen') return 'arrived';
  if (s === 'failed' || s === 'fehlgeschlagen') return 'failed';
  return 'pending';
}

function openMaps(stop: Stop) {
  const addr = encodeURIComponent(stop.address ?? '');
  if (stop.lat && stop.lng) {
    const coord = `${stop.lat},${stop.lng}`;
    const ios = `maps://maps.apple.com/?daddr=${coord}`;
    const android = `geo:${coord}?q=${coord}`;
    const web = `https://maps.google.com/?q=${coord}`;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    window.location.href = isIOS ? ios : isAndroid ? android : web;
  } else {
    window.location.href = `https://maps.google.com/?q=${addr}`;
  }
}

export function FahrerPhase2105SmartTourStoppLiveKommandoUltra({ stops, driverId, onConfirmStop }: Props) {
  const [open, setOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
  const currentIdx = sorted.findIndex(s => getStatus(s) === 'pending' || getStatus(s) === 'arrived');
  const current = currentIdx >= 0 ? sorted[currentIdx] : null;
  const next = currentIdx >= 0 && currentIdx + 1 < sorted.length ? sorted[currentIdx + 1] : null;
  const completedCount = sorted.filter(s => getStatus(s) === 'delivered').length;
  const totalCount = sorted.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isDone = completedCount === totalCount && totalCount > 0;

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b hover:bg-muted/20 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <Truck className="h-4 w-4 text-matcha-600 shrink-0" />
          Tour-Stopps
          <span className="text-[11px] text-muted-foreground font-normal">
            {completedCount}/{totalCount} geliefert
          </span>
          {isDone && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-matcha-100 text-matcha-700 font-bold border border-matcha-200">
              Tour abgeschlossen!
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-3 p-3">
          {/* Tour Fortschrittsleiste */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Tour-Fortschritt</span>
              <span className="font-bold text-foreground">{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* Stop dots */}
            <div className="flex items-center gap-1 mt-1">
              {sorted.map((s, i) => {
                const st = getStatus(s);
                return (
                  <div
                    key={s.id}
                    title={`Stopp ${i + 1}: ${s.customer_name ?? s.address}`}
                    className={cn(
                      'h-2.5 w-2.5 rounded-full border flex-shrink-0 transition-all',
                      st === 'delivered' ? 'bg-matcha-500 border-matcha-600' :
                      st === 'arrived'   ? 'bg-blue-500 border-blue-600 ring-2 ring-blue-200' :
                      st === 'failed'    ? 'bg-red-400 border-red-500' :
                      i === currentIdx   ? 'bg-amber-400 border-amber-500 ring-2 ring-amber-200 animate-pulse' :
                                           'bg-muted border-border',
                    )}
                  />
                );
              })}
              <span className="ml-1 text-[9px] text-muted-foreground">{totalCount} Stopps</span>
            </div>
          </div>

          {/* Aktueller Stopp (groß) */}
          {current && (
            <div className="rounded-xl border-2 border-matcha-400 bg-matcha-50 p-3 space-y-2 shadow-md shadow-matcha-100">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-600 text-white text-xs font-black shrink-0">
                  {current.reihenfolge ?? currentIdx + 1}
                </div>
                <span className="text-xs font-black text-matcha-900 uppercase tracking-wide">Aktueller Stopp</span>
                {getStatus(current) === 'arrived' && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-bold">
                    Angekommen
                  </span>
                )}
              </div>

              <div>
                <div className="text-base font-black text-foreground">{current.customer_name ?? 'Kunde'}</div>
                <div className="flex items-start gap-1 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-matcha-600 mt-0.5 shrink-0" />
                  <span className="text-sm text-muted-foreground">{current.address}</span>
                </div>
                {current.notes && (
                  <div className="flex items-start gap-1 mt-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <span className="text-xs text-amber-800">{current.notes}</span>
                  </div>
                )}
                {current.items && current.items.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Package className="h-3 w-3 text-muted-foreground" />
                    {current.items.slice(0, 3).map((it, i) => (
                      <span key={i} className="text-[10px] rounded bg-white border px-1.5 py-0.5">
                        {it.menge}× {it.name}
                      </span>
                    ))}
                    {current.items.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{current.items.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => openMaps(current)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white py-2.5 text-sm font-bold active:scale-95 transition-transform"
                >
                  <Navigation className="h-4 w-4" />
                  Navigieren
                </button>
                {current.customer_phone && (
                  <a
                    href={`tel:${current.customer_phone}`}
                    className="flex items-center justify-center gap-1 rounded-xl bg-white border-2 border-matcha-300 text-matcha-700 px-3 py-2.5 active:scale-95 transition-transform"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {onConfirmStop && (
                  <button
                    onClick={() => onConfirmStop(current.id)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border-2 border-matcha-300 text-matcha-700 py-2.5 text-sm font-bold active:scale-95 transition-transform"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Geliefert
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nächster Stopp (kompakt) */}
          {next && (
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted border text-xs font-black shrink-0 text-muted-foreground">
                {next.reihenfolge ?? currentIdx + 2}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-0.5">Nächster Stopp</div>
                <div className="text-sm font-bold truncate">{next.customer_name ?? 'Kunde'}</div>
                <div className="text-[11px] text-muted-foreground truncate">{next.address}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
          )}

          {/* Restliche Stopps Liste */}
          {sorted.length > 2 && (
            <div className="space-y-1">
              {sorted.map((stop, idx) => {
                const st = getStatus(stop);
                if (idx === currentIdx || stop === next) return null;
                return (
                  <div
                    key={stop.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-1.5 border',
                      st === 'delivered' ? 'bg-matcha-50 border-matcha-200' :
                      st === 'failed'    ? 'bg-red-50 border-red-200' :
                                           'bg-muted/10 border-border',
                    )}
                  >
                    <div className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black border shrink-0',
                      st === 'delivered' ? 'bg-matcha-500 border-matcha-600 text-white' :
                      st === 'failed'    ? 'bg-red-400 border-red-500 text-white' :
                                           'bg-white border-border text-muted-foreground',
                    )}>
                      {st === 'delivered' ? <CheckCircle2 className="h-3 w-3" /> : stop.reihenfolge ?? idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn(
                        'text-xs truncate',
                        st === 'delivered' ? 'line-through text-muted-foreground' : 'font-medium',
                      )}>
                        {stop.customer_name ?? stop.address ?? `Stopp ${idx + 1}`}
                      </span>
                    </div>
                    {st === 'delivered' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                    )}
                    {st === 'failed' && (
                      <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tour abgeschlossen Banner */}
          {isDone && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-600 text-white px-4 py-3">
              <Star className="h-5 w-5 fill-white" />
              <div>
                <div className="text-sm font-black">Tour abgeschlossen!</div>
                <div className="text-[11px] opacity-80">Alle {totalCount} Stopps erfolgreich geliefert.</div>
              </div>
              <Zap className="h-5 w-5 ml-auto fill-white/40" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
