'use client';

import { useEffect, useState } from 'react';
import { Clock, Navigation, MapPin, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
  driverId: string | null;
  isOnline: boolean;
  nextStopAddress?: string | null;
  nextStopLat?: number | null;
  nextStopLng?: number | null;
  className?: string;
}

interface EtaData {
  eta_min: number;
  strecke_km: number;
  verkehr: 'leicht' | 'mittel' | 'schwer';
  empfehlung: string;
}

const MOCK: EtaData = {
  eta_min: 8,
  strecke_km: 3.2,
  verkehr: 'leicht',
  empfehlung: 'Route ist frei — direkte Anfahrt empfohlen.',
};

const POLL_MS = 2 * 60_000;

const VERKEHR_META = {
  leicht: { label: 'Leichter Verkehr', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' },
  mittel: { label: 'Mittlerer Verkehr', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' },
  schwer: { label: 'Schwerer Verkehr', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' },
};

export function FahrerPhase1953NaechsterStoppEtaCockpit({
  locationId, driverId, isOnline,
  nextStopAddress, nextStopLat, nextStopLng,
  className,
}: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<EtaData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnline || !locationId || !driverId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const url = `/api/delivery/admin/fahrer-naechster-stopp-eta?location_id=${locationId}&driver_id=${driverId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) { setData(json); setCountdown(json.eta_min * 60); }
      } catch {
        if (!cancelled) { setData(MOCK); setCountdown(MOCK.eta_min * 60); }
      }
    };

    load();
    const pollId = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(pollId); };
  }, [isOnline, locationId, driverId]);

  useEffect(() => {
    if (countdown === null) return;
    const iv = setInterval(() => {
      setCountdown(c => (c !== null && c > 0 ? c - 1 : c));
    }, 1_000);
    return () => clearInterval(iv);
  }, [countdown]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const ct = countdown ?? d.eta_min * 60;
  const remainMin = Math.floor(ct / 60);
  const remainSec = ct % 60;
  const meta = VERKEHR_META[d.verkehr];

  function buildNavUrl() {
    if (nextStopLat && nextStopLng) return `https://maps.google.com/?q=${nextStopLat},${nextStopLng}`;
    if (nextStopAddress) return `https://maps.google.com/?q=${encodeURIComponent(nextStopAddress)}`;
    return '#';
  }

  return (
    <div className={cn('rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Nächster Stopp — ETA</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-teal-100 dark:border-teal-800 px-4 pb-4 pt-3 space-y-3">
          {/* ETA Countdown */}
          <div className="flex items-center justify-between rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 px-4 py-3">
            <div>
              <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">Ankunft in</p>
              <p className="font-mono text-3xl font-black text-teal-700 dark:text-teal-300 tabular-nums">
                {remainMin}:{String(remainSec).padStart(2, '0')}
              </p>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-1 justify-end">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{d.strecke_km.toFixed(1)} km</span>
              </div>
              <div className={cn('text-[10px] font-semibold', meta.color)}>{meta.label}</div>
            </div>
          </div>

          {/* Adresse */}
          {nextStopAddress && (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{nextStopAddress}</p>
            </div>
          )}

          {/* Verkehr-Info */}
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', meta.bg)}>
            <Zap className={cn('w-3.5 h-3.5 shrink-0', meta.color)} />
            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">{d.empfehlung}</p>
          </div>

          {/* Navigation-Button */}
          <a
            href={buildNavUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-teal-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-teal-700 transition-colors"
          >
            <Navigation className="w-4 h-4" />
            Navigation öffnen
          </a>

          <p className="text-[9px] text-slate-400 text-center">Aktualisiert alle 2 Min</p>
        </div>
      )}
    </div>
  );
}
