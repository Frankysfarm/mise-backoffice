'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, ChevronUp, Users, Truck, Clock } from 'lucide-react';

/**
 * Phase 1842 — Schicht-Kapazitäts-Ampel (Kitchen)
 *
 * Zeigt Echtzeit-Kapazitätsstatus: freie Fahrer / aktive Touren / wartende Bestellungen.
 * Ampel grün/gelb/rot + Empfehlung. 2-Min-Polling.
 */

interface KapazitaetsDaten {
  status: 'gruen' | 'gelb' | 'rot';
  freie_fahrer: number;
  aktive_fahrer: number;
  aktive_touren: number;
  wartende_bestellungen: number;
  auslastungs_prozent: number;
  empfehlung: string;
}

const MOCK: KapazitaetsDaten = {
  status: 'gelb',
  freie_fahrer: 1,
  aktive_fahrer: 3,
  aktive_touren: 3,
  wartende_bestellungen: 2,
  auslastungs_prozent: 75,
  empfehlung: 'Auslastung erhöht — optionaler Fahrer empfohlen',
};

const AMPEL_CONFIG = {
  gruen: {
    ring: 'ring-2 ring-matcha-500',
    dot: 'bg-matcha-500',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-700',
    label: 'Kapazität OK',
    textColor: 'text-matcha-700 dark:text-matcha-300',
  },
  gelb: {
    ring: 'ring-2 ring-amber-400',
    dot: 'bg-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    label: 'Erhöhte Auslastung',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  rot: {
    ring: 'ring-2 ring-red-500',
    dot: 'bg-red-500 animate-pulse',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-700',
    label: 'Überlastet',
    textColor: 'text-red-700 dark:text-red-300',
  },
};

interface Props {
  locationId: string | null;
  className?: string;
}

export function KitchenPhase1842SchichtKapazitaetsAmpel({ locationId, className }: Props) {
  const [daten, setDaten] = useState<KapazitaetsDaten | null>(null);
  const [offen, setOffen] = useState(true);
  const [letzteAktualisierung, setLetzteAktualisierung] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-kapazitaets-ampel?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json = await res.json();
          setDaten(json);
          setLetzteAktualisierung(new Date());
        }
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const d = daten ?? MOCK;
  const cfg = AMPEL_CONFIG[d.status];

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Kapazität</span>
        <span className={cn('ml-2 h-2.5 w-2.5 rounded-full', cfg.dot)} />
        <span className={cn('text-xs font-semibold', cfg.textColor)}>{cfg.label}</span>
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="px-4 py-3 space-y-3">
          {/* Auslastungs-Balken */}
          <div>
            <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
              <span>Auslastung</span>
              <span>{d.auslastungs_prozent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  d.status === 'gruen'
                    ? 'bg-matcha-500'
                    : d.status === 'gelb'
                    ? 'bg-amber-400'
                    : 'bg-red-500',
                )}
                style={{ width: `${d.auslastungs_prozent}%` }}
              />
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Users className="h-3.5 w-3.5" />, wert: d.freie_fahrer, label: 'Frei' },
              { icon: <Truck className="h-3.5 w-3.5" />, wert: d.aktive_touren, label: 'Aktive Touren' },
              { icon: <Clock className="h-3.5 w-3.5" />, wert: d.wartende_bestellungen, label: 'Wartend' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={cn('rounded-xl border px-2 py-2 text-center', cfg.bg, cfg.border)}
              >
                <div className={cn('flex justify-center mb-0.5', cfg.textColor)}>{kpi.icon}</div>
                <div className="text-lg font-black tabular-nums">{kpi.wert}</div>
                <div className="text-[9px] font-semibold text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Empfehlung */}
          <div className={cn('rounded-xl border px-3 py-2', cfg.bg, cfg.border)}>
            <p className={cn('text-xs font-semibold', cfg.textColor)}>{d.empfehlung}</p>
          </div>

          {letzteAktualisierung && (
            <p className="text-[9px] text-muted-foreground text-right">
              Aktualisiert: {letzteAktualisierung.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
