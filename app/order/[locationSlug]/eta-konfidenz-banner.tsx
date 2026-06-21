'use client';

/**
 * EtaKonfidenzBanner
 *
 * Zeigt die aktuelle Lieferzeit-Schätzung mit Konfidenzintervall und
 * dynamischem Update-Pulse. Kommuniziert Vertrauen in die ETA-Genauigkeit
 * durch Farbkodierung (grün = hohe Konfidenz, amber = mittel, rot = niedrig).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, Zap, Shield } from 'lucide-react';

interface EtaData {
  eta_min: number;
  eta_min_low?: number;
  eta_min_high?: number;
  confidence?: number;
  load?: string;
  queue_signal?: string;
}

interface Props {
  locationId: string;
  className?: string;
}

function confidenceLabel(confidence: number | undefined): string {
  if (!confidence) return 'Schätzung';
  if (confidence >= 0.8) return 'Sehr genau';
  if (confidence >= 0.6) return 'Genau';
  if (confidence >= 0.4) return 'Ungefähr';
  return 'Grob';
}

function loadColor(load: string | undefined): string {
  switch (load) {
    case 'quiet':  return 'text-green-600';
    case 'normal': return 'text-blue-600';
    case 'busy':   return 'text-amber-600';
    case 'surge':  return 'text-red-600';
    default:       return 'text-gray-600';
  }
}

function loadLabel(load: string | undefined): string {
  switch (load) {
    case 'quiet':  return 'Ruhig';
    case 'normal': return 'Normal';
    case 'busy':   return 'Viel los';
    case 'surge':  return 'Sehr viel los';
    default:       return '';
  }
}

export function EtaKonfidenzBanner({ locationId, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [pulse, setPulse] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;

    let mounted = true;
    async function load() {
      try {
        const r = await fetch(`/api/delivery/eta/live?location_id=${locationId}`);
        if (!r.ok || !mounted) return;
        const d = await r.json();
        setData(d);
        setLastUpdate(new Date());
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      } catch { /* silent */ }
    }

    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!data) return null;

  const confidence = data.confidence ?? 0.7;
  const confLabel = confidenceLabel(confidence);
  const confColor =
    confidence >= 0.8 ? 'text-green-600' :
    confidence >= 0.6 ? 'text-blue-600' :
    confidence >= 0.4 ? 'text-amber-600' : 'text-red-600';

  const confBg =
    confidence >= 0.8 ? 'bg-green-50 border-green-200' :
    confidence >= 0.6 ? 'bg-blue-50 border-blue-200' :
    confidence >= 0.4 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const hasRange = data.eta_min_low != null && data.eta_min_high != null &&
    data.eta_min_low !== data.eta_min_high;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 transition-all duration-300',
      confBg,
      pulse && 'scale-[1.01]',
      className,
    )}>
      <div className="flex items-center gap-3">
        {/* ETA */}
        <div className="flex items-baseline gap-1.5">
          <Clock className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="text-2xl font-black tabular-nums text-gray-900">
            {hasRange
              ? `${data.eta_min_low}–${data.eta_min_high}`
              : data.eta_min}
          </span>
          <span className="text-sm text-gray-500">Min</span>
        </div>

        <div className="flex-1" />

        {/* Confidence */}
        <div className="flex items-center gap-1.5">
          <Shield className={cn('h-3.5 w-3.5 shrink-0', confColor)} />
          <span className={cn('text-xs font-bold', confColor)}>
            {confLabel}
          </span>
        </div>

        {/* Load */}
        {data.load && (
          <div className="flex items-center gap-1">
            <Zap className={cn('h-3 w-3', loadColor(data.load))} />
            <span className={cn('text-[11px] font-medium', loadColor(data.load))}>
              {loadLabel(data.load)}
            </span>
          </div>
        )}
      </div>

      {/* Queue signal */}
      {data.queue_signal && data.queue_signal !== 'normal' && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-700">
          <TrendingUp className="h-3 w-3 shrink-0" />
          {data.queue_signal === 'busy'
            ? 'Aktuell viele Bestellungen — etwas mehr Zeit einplanen'
            : data.queue_signal === 'surge'
            ? 'Sehr hohe Nachfrage — längere Lieferzeit möglich'
            : ''}
        </div>
      )}

      {lastUpdate && (
        <div className="mt-1 text-[9px] text-gray-400">
          Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </div>
      )}
    </div>
  );
}
