'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, ChevronUp, ChevronDown, Zap, Coffee, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalenderZelle {
  tag: number;
  stunde: number;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface KalenderData {
  zellen: KalenderZelle[];
  gesamt_avg: number;
  peak_tag: number;
  peak_stunde: number;
}

const WOCHENTAG_NAMEN = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export default function FahrerPhase1945MeineSchichtPlanung({
  locationId,
  driverId,
  isOnline,
  className,
}: {
  locationId: string | null;
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}) {
  const [daten, setDaten] = useState<KalenderData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    try {
      const res = await fetch(`/api/delivery/admin/tourauslastungs-kalender?location_id=${locationId}`);
      if (!res.ok) return;
      const json: KalenderData = await res.json();
      setDaten(json);
    } catch {}
  };

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, locationId, driverId]);

  if (!isOnline) return null;

  const jetzt = new Date();
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  const morgenTagIdx = (morgen.getDay() + 6) % 7;

  const morgenZellen = daten?.zellen.filter((z) => z.tag === morgenTagIdx) ?? [];
  const schichtZellen = morgenZellen.filter((z) => z.stunde >= 8 && z.stunde <= 20);
  const rushHourZellen = schichtZellen.filter((z) => z.ampel === 'rot');
  const peakStunde = schichtZellen.reduce(
    (best, z) => (z.anzahl > best.anzahl ? z : best),
    { stunde: 12, anzahl: 0, tag: morgenTagIdx, ampel: 'gruen' as const },
  );

  let tipp = '';
  let TippIcon = Coffee;
  if (rushHourZellen.length >= 3) {
    tipp = `Rush-Hour erwartet! Besonders um ${String(peakStunde.stunde).padStart(2, '0')}:00 Uhr — früh eintreffen.`;
    TippIcon = AlertTriangle;
  } else if (rushHourZellen.length >= 1) {
    tipp = `Mäßige Auslastung. Peak gegen ${String(peakStunde.stunde).padStart(2, '0')}:00 Uhr — auf Pausen vorbereiten.`;
    TippIcon = Zap;
  } else {
    tipp = `Ruhige Schicht erwartet. Gute Zeit für sorgfältige Touren!`;
    TippIcon = Coffee;
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Meine Schicht-Planung</span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-3">
            <p className="text-xs text-violet-500 dark:text-violet-400 font-medium">Nächste Schicht</p>
            <p className="text-base font-bold text-violet-800 dark:text-violet-200 mt-0.5">
              {WOCHENTAG_NAMEN[morgenTagIdx]}, {morgen.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
            </p>
            <p className="text-sm text-violet-600 dark:text-violet-400">08:00 – 20:00 Uhr</p>
          </div>

          {schichtZellen.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Stündliche Auslastung (08–20 Uhr)</p>
              <div className="flex items-end gap-0.5 h-8">
                {schichtZellen.map((z) => {
                  const maxAnzahl = Math.max(...schichtZellen.map((c) => c.anzahl), 1);
                  const bgColor =
                    z.ampel === 'rot' ? 'bg-red-400' : z.ampel === 'gelb' ? 'bg-amber-300' : 'bg-green-300';
                  return (
                    <div
                      key={z.stunde}
                      className={cn('flex-1 rounded-sm', bgColor)}
                      style={{ height: `${Math.max(4, (z.anzahl / maxAnzahl) * 32)}px` }}
                      title={`${String(z.stunde).padStart(2, '0')}:00 — ${z.anzahl} Best.`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                <span>08</span>
                <span>14</span>
                <span>20</span>
              </div>
            </div>
          )}

          <div className={cn(
            'flex items-start gap-2 rounded-lg px-3 py-2 border',
            rushHourZellen.length >= 3
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : rushHourZellen.length >= 1
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
          )}>
            <TippIcon className={cn(
              'w-4 h-4 shrink-0 mt-0.5',
              rushHourZellen.length >= 3 ? 'text-red-500' : rushHourZellen.length >= 1 ? 'text-amber-500' : 'text-green-500',
            )} />
            <p className="text-xs text-slate-700 dark:text-slate-300">{tipp}</p>
          </div>

          {!daten && (
            <p className="text-xs text-slate-400 text-center">Lade Schichtdaten…</p>
          )}
        </div>
      )}
    </div>
  );
}
