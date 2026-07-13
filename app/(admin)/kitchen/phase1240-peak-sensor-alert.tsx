'use client';

// Phase 1240 — Peak-Sensor-Alert (Kitchen)
// Bestellrate letzte 10 Min > 120% Tages-Ø → Alert-Banner mit Eskalations-Stufe
// Props-basiert (orders) · useMemo

import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  created_at?: string | null;
  status?: string;
}

interface Props {
  orders: Order[];
}

type EskalationsStufe = 'normal' | 'erhoehung' | 'peak' | 'extrem';

interface PeakSensorResult {
  rate_letzte_10_min: number;
  tages_durchschnitt_pro_10_min: number;
  abweichung_pct: number;
  stufe: EskalationsStufe;
  empfehlung: string;
}

const STUFE_STYLE: Record<EskalationsStufe, { bg: string; border: string; text: string; badge: string; label: string }> = {
  normal: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/10',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-500',
    label: 'Normal',
  },
  erhoehung: {
    bg: 'bg-amber-50 dark:bg-amber-900/10',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-500',
    label: 'Erhöhte Auslastung',
  },
  peak: {
    bg: 'bg-orange-50 dark:bg-orange-900/10',
    border: 'border-orange-400 dark:border-orange-600',
    text: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500',
    label: 'Peak-Betrieb',
  },
  extrem: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-500 dark:border-red-600',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-600',
    label: 'Extrem-Peak — sofort handeln!',
  },
};

function eskalationsStufe(abweichungPct: number): EskalationsStufe {
  if (abweichungPct >= 200) return 'extrem';
  if (abweichungPct >= 150) return 'peak';
  if (abweichungPct >= 120) return 'erhoehung';
  return 'normal';
}

function empfehlungText(stufe: EskalationsStufe): string {
  switch (stufe) {
    case 'extrem': return 'Alle verfügbaren Köche sofort einsetzen. Kapazitätslimit erreicht.';
    case 'peak': return 'Zusätzliche Kochstation öffnen. Vorbereitungs-Puffer auffüllen.';
    case 'erhoehung': return 'Team auf erhöhte Auslastung vorbereiten. Lagerbestand prüfen.';
    case 'normal': return 'Küche läuft im Normalbetrieb.';
  }
}

export function KitchenPhase1240PeakSensorAlert({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const sensor = useMemo<PeakSensorResult>(() => {
    const now = Date.now();
    const fenster10Min = now - 10 * 60 * 1000;
    const tagesStart = new Date();
    tagesStart.setHours(0, 0, 0, 0);

    const tagesBestellungen = orders.filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= tagesStart.getTime();
    });

    const letzte10Min = tagesBestellungen.filter((o) => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= fenster10Min;
    });

    const vergangeneMinutenSeitMitternacht = Math.max(
      (now - tagesStart.getTime()) / 60000,
      10,
    );
    const anzahl10MinBuckets = Math.floor(vergangeneMinutenSeitMitternacht / 10);
    const tagesDurchschnitt = tagesBestellungen.length / Math.max(anzahl10MinBuckets, 1);

    const abweichungPct =
      tagesDurchschnitt > 0
        ? Math.round((letzte10Min.length / tagesDurchschnitt) * 100)
        : letzte10Min.length > 0
        ? 200
        : 100;

    const stufe = eskalationsStufe(abweichungPct);

    return {
      rate_letzte_10_min: letzte10Min.length,
      tages_durchschnitt_pro_10_min: Math.round(tagesDurchschnitt * 10) / 10,
      abweichung_pct: abweichungPct,
      stufe,
      empfehlung: empfehlungText(stufe),
    };
  }, [orders]);

  // Nur anzeigen wenn mindestens "erhoehung"
  if (sensor.stufe === 'normal') return null;

  const style = STUFE_STYLE[sensor.stufe];

  return (
    <div className={cn('rounded-2xl border overflow-hidden', style.bg, style.border)}>
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:opacity-90 transition-opacity"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', style.badge, 'text-white')}>
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className={cn('text-sm font-bold', style.text)}>{style.label}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {sensor.rate_letzte_10_min} Bestellungen in 10 Min · {sensor.abweichung_pct}% des Tages-Ø
          </div>
        </div>
        <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full text-white', style.badge)}>
          {sensor.abweichung_pct}%
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3 text-center">
              <div className={cn('text-xl font-black', style.text)}>{sensor.rate_letzte_10_min}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Letzte 10 Min</div>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3 text-center">
              <div className="text-xl font-black text-stone-700 dark:text-stone-200">{sensor.tages_durchschnitt_pro_10_min}</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Tages-Ø</div>
            </div>
            <div className="rounded-xl bg-white/60 dark:bg-black/20 p-3 text-center">
              <div className={cn('text-xl font-black', style.text)}>{sensor.abweichung_pct}%</div>
              <div className="text-[10px] text-stone-500 dark:text-stone-400">Auslastung</div>
            </div>
          </div>

          {/* Eskalationsleiste */}
          <div>
            <div className="flex justify-between text-[10px] text-stone-400 dark:text-stone-500 mb-1">
              <span>Normal</span>
              <span>Erhöht</span>
              <span>Peak</span>
              <span>Extrem</span>
            </div>
            <div className="h-2 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden flex">
              <div className="bg-emerald-400 h-full" style={{ width: '25%' }} />
              <div className="bg-amber-400 h-full" style={{ width: '25%' }} />
              <div className="bg-orange-500 h-full" style={{ width: '25%' }} />
              <div className="bg-red-600 h-full" style={{ width: '25%' }} />
            </div>
            <div
              className={cn('h-3 w-3 rounded-full border-2 border-white dark:border-stone-900 -mt-2.5 shadow', style.badge)}
              style={{
                marginLeft: `calc(${Math.min(Math.max((sensor.abweichung_pct - 100) / 1.5, 0), 100)}% - 6px)`,
              }}
            />
          </div>

          {/* Empfehlung */}
          <div className={cn('rounded-xl p-3 flex items-start gap-2', 'bg-white/60 dark:bg-black/20')}>
            <TrendingUp className={cn('h-4 w-4 mt-0.5 shrink-0', style.text)} />
            <div className={cn('text-xs font-medium', style.text)}>{sensor.empfehlung}</div>
          </div>
        </div>
      )}
    </div>
  );
}
