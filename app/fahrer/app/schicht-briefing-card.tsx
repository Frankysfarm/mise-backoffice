'use client';

/**
 * SchichtBriefingCard — Phase 429
 *
 * Zeigt dem Fahrer sein personalisiertes Schicht-Briefing (nur wenn Schicht
 * in den nächsten 90 Minuten beginnt oder vor weniger als 30 Min gestartet ist).
 * Wird beim ersten Öffnen automatisch als "gesehen" markiert.
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Briefing {
  id:                    string;
  schichtStart:          string;
  erwarteteBestellungen: number;
  spitzenstunde:         number | null;
  topZone:               string | null;
  peakKlasseSchicht:     'low' | 'normal' | 'peak' | 'high' | null;
  tipps:                 string[];
  driverScore:           number | null;
  driverKategorie:       'elite' | 'gut' | 'durchschnitt' | 'auffällig' | null;
  gesehenAm:             string | null;
}

interface ApiResponse {
  ok:       boolean;
  briefing: Briefing | null;
}

interface Props {
  driverId:   string;
  locationId: string;
}

const PEAK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: 'bg-rose-900/50',   text: 'text-rose-300',   label: 'Hochbetrieb'       },
  peak:   { bg: 'bg-amber-900/40',  text: 'text-amber-300',  label: 'Stoßzeit'          },
  normal: { bg: 'bg-sky-900/40',    text: 'text-sky-300',    label: 'Normalbetrieb'     },
  low:    { bg: 'bg-neutral-800/50',text: 'text-neutral-400',label: 'Ruhige Schicht'    },
};

const KAT_STYLE: Record<string, { color: string; label: string }> = {
  elite:        { color: 'text-violet-300', label: '⭐ Elite'        },
  gut:          { color: 'text-matcha-300', label: '👍 Gut'          },
  durchschnitt: { color: 'text-sky-300',    label: '📊 Durchschnitt' },
  auffällig:    { color: 'text-rose-400',   label: '⚠️ Auffällig'   },
};

const ZONE_COLOR: Record<string, string> = {
  A: 'text-matcha-300',
  B: 'text-sky-300',
  C: 'text-amber-300',
  D: 'text-rose-400',
};

function isRelevantNow(schichtStart: string): boolean {
  const start = new Date(schichtStart).getTime();
  const now   = Date.now();
  return now >= start - 90 * 60_000 && now <= start + 30 * 60_000;
}

export function SchichtBriefingCard({ driverId, locationId }: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [open, setOpen]         = useState(false);
  const markedRef               = useRef(false);

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res   = await fetch(
        `/api/delivery/admin/schicht-briefing?driver_id=${driverId}&location_id=${locationId}&date=${today}`,
      );
      if (!res.ok) return;
      const json = await res.json() as ApiResponse;
      if (json.ok && json.briefing) setBriefing(json.briefing);
    };
    void load();
    const iv = setInterval(() => void load(), 5 * 60_000);
    return () => clearInterval(iv);
  }, [driverId, locationId]);

  // Mark as seen when opened for the first time
  useEffect(() => {
    if (open && briefing && !briefing.gesehenAm && !markedRef.current) {
      markedRef.current = true;
      void fetch('/api/delivery/admin/schicht-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seen', id: briefing.id }),
      });
    }
  }, [open, briefing]);

  if (!briefing || !isRelevantNow(briefing.schichtStart)) return null;

  const peak       = PEAK_STYLE[briefing.peakKlasseSchicht ?? 'normal'] ?? PEAK_STYLE['normal'];
  const kat        = KAT_STYLE[briefing.driverKategorie ?? 'durchschnitt'] ?? KAT_STYLE['durchschnitt'];
  const zoneColor  = ZONE_COLOR[briefing.topZone ?? ''] ?? 'text-white';

  const startFmt = new Date(briefing.schichtStart).toLocaleTimeString('de-DE', {
    hour:   '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  });

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      peak.bg,
      'border-white/10',
    )}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Zap className="h-4 w-4 text-amber-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-wider text-white/80">
            Schicht-Briefing · {startFmt} Uhr
          </div>
          <div className={cn('text-sm font-bold mt-0.5', peak.text)}>
            {peak.label} · ~{briefing.erwarteteBestellungen} Bestellungen erwartet
          </div>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-white/50 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-white/50 shrink-0" />}
      </button>

      {/* Detail — collapsible */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Spitzenstunde */}
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <Clock className="h-3 w-3 text-white/50 mx-auto mb-0.5" />
              <div className="text-[10px] text-white/50 uppercase tracking-wide">Spitze</div>
              <div className="text-sm font-black text-white tabular-nums">
                {briefing.spitzenstunde !== null
                  ? `${String(briefing.spitzenstunde).padStart(2, '0')}:00`
                  : '—'}
              </div>
            </div>

            {/* Top-Zone */}
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <MapPin className="h-3 w-3 text-white/50 mx-auto mb-0.5" />
              <div className="text-[10px] text-white/50 uppercase tracking-wide">Top-Zone</div>
              <div className={cn('text-sm font-black tabular-nums', zoneColor)}>
                {briefing.topZone ? `Zone ${briefing.topZone}` : '—'}
              </div>
            </div>

            {/* Fahrer-Score */}
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <Star className="h-3 w-3 text-white/50 mx-auto mb-0.5" />
              <div className="text-[10px] text-white/50 uppercase tracking-wide">Score</div>
              <div className={cn('text-sm font-black tabular-nums', kat.color)}>
                {briefing.driverScore !== null ? briefing.driverScore : '—'}
              </div>
            </div>
          </div>

          {/* Kategorie badge */}
          {briefing.driverKategorie && (
            <div className={cn('text-xs font-bold', kat.color)}>
              {kat.label}
            </div>
          )}

          {/* Tipps */}
          {briefing.tipps.length > 0 && (
            <div className="space-y-1.5">
              {briefing.tipps.map((tip, i) => (
                <div
                  key={i}
                  className="text-xs text-white/75 bg-black/20 rounded-lg px-3 py-2 leading-relaxed"
                >
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Gesehen-Hinweis */}
          {briefing.gesehenAm && (
            <div className="text-[9px] text-white/30 text-right">
              Gesehen {new Date(briefing.gesehenAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
