'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Navigation, Phone, CheckCircle2, AlertTriangle, Loader2,
  MapPin, ChevronDown, ChevronUp, PackageX, Clock, DoorClosed,
} from 'lucide-react';

interface Props {
  tourId: string;
  stopId: string;
  stopAddress: string;
  customerName: string;
  customerPhone?: string | null;
  lat?: number | null;
  lng?: number | null;
  onComplete: () => void;
}

type DeliveryStatus = 'idle' | 'confirming' | 'done' | 'error';

type ProblemOption = {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: string;
};

const PROBLEM_OPTIONS: ProblemOption[] = [
  { key: 'nicht_angetroffen', label: 'Nicht angetroffen', icon: <DoorClosed size={15} />, status: 'nicht_angetroffen' },
  { key: 'adresse_falsch', label: 'Adresse falsch', icon: <MapPin size={15} />, status: 'adresse_falsch' },
  { key: 'zeitfenster_verpasst', label: 'Zeitfenster verpasst', icon: <Clock size={15} />, status: 'zeitfenster_verpasst' },
];

function buildNavUrl(lat: number | null | undefined, lng: number | null | undefined, address: string): string {
  if (lat != null && lng != null) {
    const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
    return isIos
      ? `maps://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
  }
  return `https://maps.google.com/?daddr=${encodeURIComponent(address)}`;
}

export function TourStopQuickActions({
  tourId,
  stopId,
  stopAddress,
  customerName,
  customerPhone,
  lat,
  lng,
  onComplete,
}: Props) {
  const [status, setStatus] = useState<DeliveryStatus>('idle');
  const [problemOpen, setProblemOpen] = useState(false);
  const [problemStatus, setProblemStatus] = useState<DeliveryStatus>('idle');

  const navUrl = buildNavUrl(lat, lng, stopAddress);

  const handleDelivered = useCallback(async () => {
    if (status !== 'idle') return;
    setStatus('confirming');
    try {
      const res = await fetch(`/api/delivery/tours/${tourId}/stops/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'geliefert', geliefert_am: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Request failed');
      setStatus('done');
      setTimeout(() => onComplete(), 600);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  }, [status, tourId, stopId, onComplete]);

  const handleProblem = useCallback(async (option: ProblemOption) => {
    if (problemStatus !== 'idle') return;
    setProblemStatus('confirming');
    try {
      const res = await fetch(`/api/delivery/tours/${tourId}/stops/${stopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: option.status, gemeldet_am: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Request failed');
      setProblemStatus('done');
      setTimeout(() => onComplete(), 600);
    } catch {
      setProblemStatus('error');
      setTimeout(() => setProblemStatus('idle'), 2500);
    }
  }, [problemStatus, tourId, stopId, onComplete]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
            <MapPin size={16} className="text-accent" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-base leading-tight truncate">{customerName}</div>
            <div className="text-[12px] text-white/50 mt-0.5 leading-snug">{stopAddress}</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        {/* Navigation button */}
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2.5 w-full rounded-xl bg-accent text-black font-bold text-[15px] py-4 active:opacity-80 transition"
        >
          <Navigation size={18} />
          Navigation starten
        </a>

        {/* Phone + Delivered row */}
        <div className={cn('grid gap-2', customerPhone ? 'grid-cols-2' : 'grid-cols-1')}>
          {customerPhone && (
            <a
              href={`tel:${customerPhone}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 text-white font-bold text-[14px] py-3.5 active:opacity-80 transition"
            >
              <Phone size={16} />
              Anrufen
            </a>
          )}

          <button
            onClick={handleDelivered}
            disabled={status !== 'idle'}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl font-bold text-[14px] py-3.5 transition active:opacity-80',
              status === 'done'
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : status === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : status === 'confirming'
                ? 'bg-white/10 border border-white/20 text-white/60'
                : 'bg-green-600 text-white border border-green-500/30',
            )}
          >
            {status === 'confirming' && <Loader2 size={16} className="animate-spin" />}
            {status === 'done' && <CheckCircle2 size={16} />}
            {status === 'error' && <AlertTriangle size={16} />}
            {status === 'idle' && <CheckCircle2 size={16} />}
            {status === 'confirming' ? 'Wird gespeichert…' : status === 'done' ? 'Geliefert!' : status === 'error' ? 'Fehler' : 'Geliefert'}
          </button>
        </div>

        {/* Problem melden toggle */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <button
            onClick={() => setProblemOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/60 active:bg-white/5 transition"
          >
            <span className="flex items-center gap-2 font-semibold">
              <AlertTriangle size={14} className="text-amber-400" />
              Problem melden
            </span>
            {problemOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {problemOpen && (
            <div className="border-t border-white/10 px-3 pb-3 pt-2 space-y-2">
              {PROBLEM_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleProblem(option)}
                  disabled={problemStatus !== 'idle'}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition active:opacity-70',
                    problemStatus === 'done'
                      ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                      : problemStatus === 'error'
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'border border-white/10 bg-white/5 text-white/80 active:bg-white/10',
                  )}
                >
                  <span className="text-amber-400">{option.icon}</span>
                  {option.label}
                  {problemStatus === 'confirming' && (
                    <Loader2 size={13} className="ml-auto animate-spin text-white/40" />
                  )}
                </button>
              ))}
              {problemStatus === 'error' && (
                <div className="text-[11px] text-red-400 px-1">Fehler beim Speichern. Bitte erneut versuchen.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
