'use client';

import { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvgEtaData {
  avg_delivery_min: number | null;
  team_grade?: string | null;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelOf(min: number): Ampel {
  if (min <= 25) return 'gruen';
  if (min <= 40) return 'gelb';
  return 'rot';
}

const AMPEL_STYLE: Record<Ampel, { bg: string; border: string; icon: string; text: string }> = {
  gruen: {
    bg:     'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-700',
    icon:   'text-green-600 dark:text-green-400',
    text:   'text-green-800 dark:text-green-200',
  },
  gelb: {
    bg:     'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    icon:   'text-amber-600 dark:text-amber-400',
    text:   'text-amber-800 dark:text-amber-200',
  },
  rot: {
    bg:     'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-700',
    icon:   'text-red-600 dark:text-red-400',
    text:   'text-red-800 dark:text-red-200',
  },
};

const MOCK_MIN = 28;

export default function Phase1951EchtzeitWartezeitIndikator({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [wartezeit, setWartezeit] = useState<number | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => {
    setGemountet(true);
  }, []);

  const laden = async () => {
    try {
      const res = await fetch(`/api/delivery/public/avg-eta?slug=${locationId}`);
      if (!res.ok) { setWartezeit(MOCK_MIN); return; }
      const json: AvgEtaData = await res.json();
      setWartezeit(json.avg_delivery_min ?? MOCK_MIN);
    } catch {
      setWartezeit(MOCK_MIN);
    }
  };

  useEffect(() => {
    if (!gemountet) return;
    laden();
    const id = setInterval(laden, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId]);

  if (!gemountet || geschlossen || wartezeit === null) return null;

  const ampel = ampelOf(wartezeit);
  const s = AMPEL_STYLE[ampel];

  const subtext =
    ampel === 'gruen'
      ? 'Schnelle Lieferung — jetzt bestellen!'
      : ampel === 'gelb'
      ? 'Normale Auslastung — wir bearbeiten Ihre Bestellung bald.'
      : 'Hohes Aufkommen — wir geben alles für Ihre Bestellung!';

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 border rounded-xl px-4 py-3',
        s.bg,
        s.border,
        className,
      )}
    >
      <div className={cn('shrink-0', s.icon)}>
        <Clock className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold leading-tight', s.text)}>
          Aktuell ca.{' '}
          <span className="font-black tabular-nums">{wartezeit} Min</span>{' '}
          Wartezeit
        </p>
        <p className={cn('text-[11px] mt-0.5 opacity-80', s.text)}>{subtext}</p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X className={cn('w-3.5 h-3.5', s.icon)} />
      </button>
    </div>
  );
}
