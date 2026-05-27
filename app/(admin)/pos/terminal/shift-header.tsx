'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Clock, GraduationCap, LogOut, User } from 'lucide-react';
import { PrinterStatusButton } from './printer-status-button';

type Shift = { id: string; start_at: string; start_wechselgeld?: number };

export function ShiftHeader({
  shift, employeeName, trainingMode, onToggleTraining, onCloseShift,
}: {
  shift: Shift;
  employeeName: string;
  trainingMode: boolean;
  onToggleTraining: () => void;
  onCloseShift: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  const min = Math.floor((now - new Date(shift.start_at).getTime()) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;

  return (
    <div className={cn(
      'absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2 text-xs border-b',
      trainingMode ? 'bg-amber-500 text-white' : 'bg-matcha-50 text-matcha-900',
    )}>
      <Link
        href="/"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold transition text-[11px]',
          trainingMode
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-matcha-900 text-matcha-50 hover:bg-matcha-800',
        )}
        title="Zurück ins Backoffice"
      >
        <ArrowLeft className="h-3 w-3" /> Backoffice
      </Link>
      <span className="opacity-60">·</span>
      <User className="h-3.5 w-3.5 shrink-0" />
      <span className="font-bold truncate">{employeeName}</span>
      <span className="opacity-60">·</span>
      <Clock className="h-3 w-3 shrink-0" />
      <span className="font-mono">{h}h {m}m</span>
      {shift.start_wechselgeld && (
        <>
          <span className="opacity-60">·</span>
          <span>Start {euro(Number(shift.start_wechselgeld))}</span>
        </>
      )}
      <div className="flex-1" />

      <PrinterStatusButton />

      <button
        onClick={onToggleTraining}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold transition text-[11px]',
          trainingMode
            ? 'bg-white text-amber-800'
            : 'bg-amber-100 text-amber-900 hover:bg-amber-200',
        )}
      >
        <GraduationCap className="h-3 w-3" />
        {trainingMode ? 'TRAINING AKTIV · Klicken zum Stoppen' : 'Training-Modus'}
      </button>
      <button
        onClick={onCloseShift}
        className="inline-flex items-center gap-1 rounded-lg bg-gray-900 text-white px-2 py-1 font-bold text-[11px] hover:bg-gray-800"
      >
        <LogOut className="h-3 w-3" /> Schicht beenden
      </button>
    </div>
  );
}
