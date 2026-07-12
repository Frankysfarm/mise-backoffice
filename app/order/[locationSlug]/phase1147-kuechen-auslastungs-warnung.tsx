'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1147 — Küchen-Auslastungs-Warnung (Storefront)
// Transparenz-Banner wenn Küche stark ausgelastet ist → verlängerte ETA-Warnung

interface Props {
  locationSlug: string;
  currentEtaMin?: number;
  onDismiss?: () => void;
}

interface AuslastungData {
  level: 'normal' | 'erhoeht' | 'hoch' | 'kritisch';
  auslastungPct: number;
  extraMinutes: number;
  message: string;
}

function mockAuslastung(): AuslastungData {
  const pct = Math.floor(Math.random() * 40) + 50;
  if (pct >= 90) return { level: 'kritisch', auslastungPct: pct, extraMinutes: 15, message: 'Hohe Nachfrage — Küche läuft auf Hochtouren' };
  if (pct >= 75) return { level: 'hoch', auslastungPct: pct, extraMinutes: 8, message: 'Erhöhte Nachfrage — etwas längere Wartezeit' };
  if (pct >= 60) return { level: 'erhoeht', auslastungPct: pct, extraMinutes: 3, message: 'Mittlere Auslastung — leicht verlängert' };
  return { level: 'normal', auslastungPct: pct, extraMinutes: 0, message: 'Küche gut erreichbar' };
}

export function Phase1147KuechenAuslastungsWarnung({ locationSlug, currentEtaMin, onDismiss }: Props) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-kapazitaet-live?locationSlug=${locationSlug}`);
        if (res.ok) {
          const json = await res.json();
          // Map generic capacity data to our format
          const pct: number = json.auslastungPct ?? json.capacityPct ?? 65;
          if (pct >= 90) setData({ level: 'kritisch', auslastungPct: pct, extraMinutes: 15, message: 'Hohe Nachfrage — Küche läuft auf Hochtouren' });
          else if (pct >= 75) setData({ level: 'hoch', auslastungPct: pct, extraMinutes: 8, message: 'Erhöhte Nachfrage — etwas längere Wartezeit' });
          else if (pct >= 60) setData({ level: 'erhoeht', auslastungPct: pct, extraMinutes: 3, message: 'Leicht erhöhte Nachfrage' });
          else setData(null);
        } else {
          setData(null);
        }
      } catch {
        setData(null);
      }
    }
    load();
  }, [locationSlug]);

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  // Only show for erhoeht or worse
  if (!data || data.level === 'normal' || dismissed) return null;

  const styles: Record<string, { border: string; bg: string; icon: string; bar: string; text: string }> = {
    erhoeht: {
      border: 'border-amber-200 dark:border-amber-800',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: 'text-amber-500',
      bar: 'bg-amber-400',
      text: 'text-amber-700 dark:text-amber-300',
    },
    hoch: {
      border: 'border-orange-200 dark:border-orange-800',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      icon: 'text-orange-500',
      bar: 'bg-orange-500',
      text: 'text-orange-700 dark:text-orange-300',
    },
    kritisch: {
      border: 'border-red-200 dark:border-red-800',
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: 'text-red-500',
      bar: 'bg-red-500',
      text: 'text-red-700 dark:text-red-300',
    },
  };

  const s = styles[data.level] ?? styles.erhoeht;

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 flex gap-3', s.border, s.bg)}>
      <ChefHat className={cn('h-4 w-4 shrink-0 mt-0.5', s.icon)} />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn('text-[12px] font-bold', s.text)}>{data.message}</p>
            {data.extraMinutes > 0 && currentEtaMin && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                Aktuelle Lieferzeit: ca.{' '}
                <span className="font-black text-foreground">
                  {currentEtaMin + data.extraMinutes} Min
                </span>
                {' '}(+{data.extraMinutes} Min)
              </p>
            )}
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Auslastungsbalken */}
        <div>
          <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
            <span>Küchen-Auslastung</span>
            <span className="font-bold">{data.auslastungPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', s.bar)}
              style={{ width: `${data.auslastungPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
