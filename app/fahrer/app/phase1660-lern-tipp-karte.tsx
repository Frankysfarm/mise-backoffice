'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Lightbulb, WifiOff, ChevronDown, ChevronUp, Loader2, ChevronRight } from 'lucide-react';

/**
 * Phase 1660 — Lern-Tipp-Karte (Fahrer-App)
 *
 * Personalisierte Optimierungstipps basierend auf eigener Leistung vs. Vorwoche.
 * GET /api/delivery/driver/lern-tipps?driver_id=<id>
 * isOnline-Guard. 30-Min-Polling.
 */

interface Tipp {
  id: string;
  titel: string;
  beschreibung: string;
  kategorie: 'zeit' | 'zone' | 'rating' | 'route' | 'pause';
  prioritaet: 'hoch' | 'mittel' | 'niedrig';
}

interface ApiResponse {
  driver_id: string;
  tipps: Tipp[];
  generiert_am: string;
}

interface Props {
  driverId?: string | null;
  isOnline?: boolean;
}

const MOCK_TIPPS: Tipp[] = [
  {
    id: 't1',
    titel: 'Zone B schneller erkunden',
    beschreibung: 'Deine Zone-B-Stopps dauern Ø 3 Min länger als letzte Woche. Probiere die Nebenstraße über Birkenweg.',
    kategorie: 'zone',
    prioritaet: 'hoch',
  },
  {
    id: 't2',
    titel: 'Pausen-Timing optimieren',
    beschreibung: 'Eine kurze Pause zwischen 13:00–14:00 Uhr verbessert deinen Komfort-Score um ~12 Punkte.',
    kategorie: 'pause',
    prioritaet: 'mittel',
  },
  {
    id: 't3',
    titel: 'Bewertungs-Boost möglich',
    beschreibung: 'Freundliche Begrüßung beim Übergeben erhöht Kundenbewertung. Dein Ziel: 4,6 ★ (jetzt: 4,3 ★).',
    kategorie: 'rating',
    prioritaet: 'mittel',
  },
];

const KAT_CFG: Record<Tipp['kategorie'], { color: string; bg: string; border: string; dot: string }> = {
  zeit:  { color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-700',    dot: 'bg-blue-500' },
  zone:  { color: 'text-purple-700 dark:text-purple-300',bg: 'bg-purple-50 dark:bg-purple-900/20',border: 'border-purple-200 dark:border-purple-700', dot: 'bg-purple-500' },
  rating:{ color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-700',  dot: 'bg-amber-400' },
  route: { color: 'text-matcha-700 dark:text-matcha-300',bg: 'bg-matcha-50 dark:bg-matcha-900/20',border: 'border-matcha-200 dark:border-matcha-700', dot: 'bg-matcha-500' },
  pause: { color: 'text-teal-700 dark:text-teal-300',    bg: 'bg-teal-50 dark:bg-teal-900/20',    border: 'border-teal-200 dark:border-teal-700',    dot: 'bg-teal-500' },
};

const PRIO_ORDER: Record<Tipp['prioritaet'], number> = { hoch: 0, mittel: 1, niedrig: 2 };

export function FahrerPhase1660LernTippKarte({ driverId, isOnline = false }: Props) {
  const [tipps, setTipps] = useState<Tipp[]>(MOCK_TIPPS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch(`/api/delivery/driver/lern-tipps?driver_id=${driverId}`);
        if (r.ok) {
          const json = await r.json() as ApiResponse;
          if (json.tipps?.length) {
            setTipps([...json.tipps].sort((a, b) => PRIO_ORDER[a.prioritaet] - PRIO_ORDER[b.prioritaet]));
          }
        }
      } catch {
        // Mock bleibt
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [isOnline, driverId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 mb-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Lern-Tipps — offline nicht verfügbar</span>
      </div>
    );
  }

  const visibleTipps = tipps.slice(0, 3);
  const current = visibleTipps[activeIdx] ?? visibleTipps[0];

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Deine Lern-Tipps
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{visibleTipps.length} Tipps</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && current && (
        <div className="mt-3 space-y-3">
          {/* Aktiver Tipp */}
          {(() => {
            const cfg = KAT_CFG[current.kategorie];
            return (
              <div className={cn('rounded-lg border p-3', cfg.bg, cfg.border)}>
                <div className="flex items-start gap-2 mb-1.5">
                  <span className={cn('inline-block w-2 h-2 rounded-full mt-1 shrink-0', cfg.dot)} />
                  <p className={cn('text-xs font-semibold', cfg.color)}>{current.titel}</p>
                  {current.prioritaet === 'hoch' && (
                    <span className="ml-auto text-[9px] font-bold text-red-600 dark:text-red-400 border border-red-300 rounded px-1">
                      Wichtig
                    </span>
                  )}
                </div>
                <p className={cn('text-xs leading-relaxed pl-4', cfg.color, 'opacity-90')}>
                  {current.beschreibung}
                </p>
              </div>
            );
          })()}

          {/* Tipp-Navigation */}
          {visibleTipps.length > 1 && (
            <div className="flex items-center gap-1.5">
              {visibleTipps.map((t, i) => {
                const cfg = KAT_CFG[t.kategorie];
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveIdx(i)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 text-[10px] font-medium truncate transition-all',
                      i === activeIdx
                        ? cn(cfg.bg, cfg.border, cfg.color)
                        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                    )}
                  >
                    {t.titel.split(' ')[0]}…
                  </button>
                );
              })}
              {activeIdx < visibleTipps.length - 1 && (
                <button
                  onClick={() => setActiveIdx(i => Math.min(i + 1, visibleTipps.length - 1))}
                  className="rounded-md border border-border p-1 hover:bg-muted/60 transition"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          <p className="text-[9px] text-muted-foreground">Basierend auf deiner Leistung · Aktualisierung alle 30 Min</p>
        </div>
      )}
    </div>
  );
}
