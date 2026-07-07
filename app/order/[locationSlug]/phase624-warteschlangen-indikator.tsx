'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Zap, CheckCircle2 } from 'lucide-react';

interface Props {
  locationId: string;
}

interface WarteschlangeDaten {
  auslastungPct: number;
  wartezeit: number;
  status: 'niedrig' | 'mittel' | 'hoch';
}

function berechneWartezeit(pct: number): number {
  if (pct < 40) return 15;
  if (pct < 70) return 25;
  if (pct < 90) return 35;
  return 45;
}

export function Phase624WarteschlangenIndikator({ locationId }: Props) {
  const [data, setData] = useState<WarteschlangeDaten | null>(null);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/sla-snapshot?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('no data');
      const json = await res.json();

      const gesamtLieferungen: number = json.gesamtLieferungen ?? 0;
      const pünktlich: number = json.pünktlich ?? gesamtLieferungen;
      const auslastungPct = gesamtLieferungen > 0
        ? Math.round(((gesamtLieferungen - pünktlich) / gesamtLieferungen) * 100)
        : 20;

      const wartezeit = berechneWartezeit(auslastungPct);
      const status: WarteschlangeDaten['status'] =
        auslastungPct < 40 ? 'niedrig' : auslastungPct < 75 ? 'mittel' : 'hoch';

      setData({ auslastungPct, wartezeit, status });
    } catch {
      setData({ auslastungPct: 20, wartezeit: 20, status: 'niedrig' });
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data) return null;

  const { status, wartezeit } = data;
  const config = {
    niedrig: {
      bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-200',
      sub: 'text-green-600 dark:text-green-400',
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      label: 'Küche gut verfügbar',
    },
    mittel: {
      bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-200',
      sub: 'text-amber-600 dark:text-amber-400',
      icon: <Zap className="h-4 w-4 text-amber-500" />,
      label: 'Küche mäßig ausgelastet',
    },
    hoch: {
      bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      sub: 'text-red-600 dark:text-red-400',
      icon: <Clock className="h-4 w-4 text-red-500" />,
      label: 'Küche stark ausgelastet',
    },
  }[status];

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${config.bg}`}>
      <div className="shrink-0">{config.icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold ${config.text}`}>{config.label}</div>
        <div className={`text-[11px] ${config.sub}`}>
          Aktuell ca. {wartezeit} Min Lieferzeit
        </div>
      </div>
    </div>
  );
}
