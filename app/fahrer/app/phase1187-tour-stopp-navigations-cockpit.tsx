'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, MapPin, Navigation, Phone, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1187 — Tour-Stopp-Navigations-Cockpit (Fahrer-App)
// Aktueller Stopp mit Adresse, ETA-Countdown, GPS-Navi-Button und Schnell-Anruf

interface Stop {
  id: string;
  address?: string;
  lat?: number;
  lon?: number;
  customerName?: string;
  phone?: string;
  etaMin?: number;
  notes?: string;
  status?: string;
}

interface Batch {
  id: string;
  stops: Array<{
    id: string;
    order?: {
      lieferadresse?: string;
      latitude?: number;
      longitude?: number;
      kunde_name?: string;
      kunde_telefon?: string;
      notes?: string;
    };
    status?: string;
    estimated_delivery_time?: string;
  }>;
}

interface Props {
  driverId: string;
  isOnline: boolean;
  activeBatch: Batch | null;
}

function getNavUrl(lat?: number, lon?: number, address?: string): string {
  if (lat && lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return '#';
}

function getEtaSec(etaStr?: string): number | null {
  if (!etaStr) return null;
  const ms = new Date(etaStr).getTime() - Date.now();
  return ms > 0 ? Math.round(ms / 1000) : 0;
}

function fmtMin(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FahrerPhase1187TourStoppNavigationsCockpit({ driverId, isOnline, activeBatch }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (!activeBatch || !isOnline) return null;

  const pending = activeBatch.stops.filter(s => !['delivered', 'failed'].includes(s.status ?? ''));
  const currentStop = pending[0] ?? null;
  const nextStop = pending[1] ?? null;

  if (!currentStop) return null;

  const o = currentStop.order;
  const address = o?.lieferadresse ?? 'Adresse unbekannt';
  const lat = o?.latitude;
  const lon = o?.longitude;
  const customerName = o?.kunde_name;
  const phone = o?.kunde_telefon;
  const notes = o?.notes;
  const navUrl = getNavUrl(lat ?? undefined, lon ?? undefined, address);
  const etaSec = getEtaSec(currentStop.estimated_delivery_time);

  const etaColor = etaSec !== null
    ? etaSec < 120 ? 'text-red-600' : etaSec < 300 ? 'text-orange-600' : 'text-matcha-700'
    : 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm font-bold">Navigations-Cockpit</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
            {pending.length} Stopp{pending.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Aktueller Stopp */}
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-0.5">
                    Aktueller Stopp
                  </div>
                  {customerName && (
                    <div className="text-xs font-bold text-foreground truncate">{customerName}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{address}</div>
                  {notes && (
                    <div className="text-[10px] italic text-amber-700 mt-0.5 truncate">💬 {notes}</div>
                  )}
                </div>
              </div>
              {etaSec !== null && (
                <div className="shrink-0 text-right">
                  <div className={cn('font-mono text-lg font-black tabular-nums', etaColor)}>
                    {fmtMin(etaSec)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">ETA</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navigation starten
              </a>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Anrufen
                </a>
              )}
            </div>
          </div>

          {/* Nächster Stopp (Vorschau) */}
          {nextStop && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Nächster Stopp
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {nextStop.order?.kunde_name && <span className="font-medium">{nextStop.order.kunde_name} — </span>}
                  {nextStop.order?.lieferadresse ?? 'Adresse folgt'}
                </div>
              </div>
              <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground font-bold shrink-0">
                {pending.length - 1} nach diesem
              </span>
            </div>
          )}

          {/* Fortschrittsleiste */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Tour-Fortschritt</span>
              <span>{activeBatch.stops.length - pending.length} / {activeBatch.stops.length} Stopps</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${((activeBatch.stops.length - pending.length) / activeBatch.stops.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
