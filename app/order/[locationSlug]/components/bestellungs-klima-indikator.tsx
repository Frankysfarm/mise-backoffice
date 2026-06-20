'use client';

/* Phase 327: BestellungsKlimaIndikator
   Zeigt Kunden das aktuelle Liefer-Klima: ideale Bedingungen / leichte Verzögerung / erhöhte Nachfrage.
   Nutzt GET /api/delivery/health?location_id=... (mit Fallback auf Mock).
*/

import { useEffect, useState } from 'react';
import { Leaf, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type KlimaStatus = 'ideal' | 'leicht-verzoegert' | 'hoch-last';

interface HealthData {
  activeDrivers?: number;
  avgEtaMin?: number;
  queueDepth?: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function BestellungsKlimaIndikator({ locationId, className }: Props) {
  const [status, setStatus] = useState<KlimaStatus>('ideal');
  const [loading, setLoading] = useState(true);
  const [extraInfo, setExtraInfo] = useState<string>('');

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    fetch(`/api/delivery/health?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: HealthData) => {
        const avg = d.avgEtaMin ?? 0;
        const queue = d.queueDepth ?? 0;
        const drivers = d.activeDrivers ?? 1;

        if (avg > 45 || queue > 8 || drivers === 0) {
          setStatus('hoch-last');
          setExtraInfo(`Aktuell ${drivers} Fahrer · Ø ${avg > 0 ? avg + ' Min.' : '–'}`);
        } else if (avg > 30 || queue > 4) {
          setStatus('leicht-verzoegert');
          setExtraInfo(`Ø ca. ${avg} Min. Lieferzeit`);
        } else {
          setStatus('ideal');
          setExtraInfo(drivers > 0 ? `${drivers} Fahrer bereit` : '');
        }
      })
      .catch(() => {
        setStatus('ideal');
        setExtraInfo('');
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className={cn('h-8 w-40 rounded-full bg-stone-100 animate-pulse', className)} />
    );
  }

  const cfg = {
    ideal: {
      bg: 'bg-matcha-50 border-matcha-200',
      text: 'text-matcha-800',
      icon: Leaf,
      iconColor: 'text-matcha-600',
      label: 'Ideale Bedingungen',
      dot: 'bg-matcha-500',
    },
    'leicht-verzoegert': {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-800',
      icon: AlertCircle,
      iconColor: 'text-amber-500',
      label: 'Leicht erhöhte Wartezeit',
      dot: 'bg-amber-400',
    },
    'hoch-last': {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: Zap,
      iconColor: 'text-red-500',
      label: 'Hohe Nachfrage',
      dot: 'bg-red-500',
    },
  } as const;

  const c = cfg[status];
  const Icon = c.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2',
        c.bg,
        className,
      )}
    >
      <span className={cn('relative flex h-2 w-2')}>
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-50',
            c.dot,
          )}
        />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', c.dot)} />
      </span>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', c.iconColor)} />
      <div>
        <span className={cn('text-[12px] font-bold', c.text)}>{c.label}</span>
        {extraInfo && (
          <span className="ml-1.5 text-[11px] text-stone-500 font-normal">{extraInfo}</span>
        )}
      </div>
    </div>
  );
}
