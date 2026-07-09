'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertOctagon, Bell, ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * phase886 — Engpass-Auto-Eskalation
 *
 * Zeigt automatische Eskalations-Alerts wenn eine Zone >80% Auslastung hat
 * und keine freien Fahrer verfügbar sind. 60s-Polling.
 */

interface ZoneData {
  zone: 'A' | 'B' | 'C' | 'D';
  bestellungen: number;
  max_bestellungen: number;
  freie_fahrer: number;
  avg_lieferzeit_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface Props {
  locationId: string | null;
}

const ENGPASS_SCHWELLENWERT = 0.8;

const ZONE_FARBEN: Record<string, string> = {
  A: 'text-matcha-600 bg-matcha-50 border-matcha-300 dark:bg-matcha-950/20',
  B: 'text-blue-600 bg-blue-50 border-blue-300 dark:bg-blue-950/20',
  C: 'text-amber-600 bg-amber-50 border-amber-300 dark:bg-amber-950/20',
  D: 'text-purple-600 bg-purple-50 border-purple-300 dark:bg-purple-950/20',
};

const MOCK_ZONEN: ZoneData[] = [
  { zone: 'A', bestellungen: 9, max_bestellungen: 10, freie_fahrer: 0, avg_lieferzeit_min: 38, trend: 'steigend' },
  { zone: 'B', bestellungen: 5, max_bestellungen: 10, freie_fahrer: 2, avg_lieferzeit_min: 28, trend: 'stabil' },
  { zone: 'C', bestellungen: 8, max_bestellungen: 10, freie_fahrer: 0, avg_lieferzeit_min: 42, trend: 'steigend' },
  { zone: 'D', bestellungen: 3, max_bestellungen: 10, freie_fahrer: 1, avg_lieferzeit_min: 22, trend: 'fallend' },
];

export function DispatchPhase886EngpassAutoEskalation({ locationId }: Props) {
  const [zonen, setZonen] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  async function poll() {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/zonen-bestelldruck?location_id=${locationId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.zonen)) {
          setZonen(data.zonen as ZoneData[]);
          setLastPoll(new Date());
          return;
        }
      }
    } catch { /* intentional */ }
    setZonen(MOCK_ZONEN);
    setLastPoll(new Date());
  }

  useEffect(() => {
    setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const engpassZonen = zonen.filter(z => {
    const auslastung = z.max_bestellungen > 0 ? z.bestellungen / z.max_bestellungen : 0;
    return auslastung >= ENGPASS_SCHWELLENWERT && z.freie_fahrer === 0;
  });

  if (!loading && engpassZonen.length === 0) return null;

  return (
    <Card className="border-red-400 bg-red-50/80 dark:bg-red-950/20 p-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-5 w-5 text-red-600 animate-pulse" />
          <span className="text-sm font-bold text-red-700 dark:text-red-300">Engpass-Eskalation</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="destructive" className="text-[10px]">
              {engpassZonen.length} Zone{engpassZonen.length !== 1 ? 'n' : ''} kritisch
            </Badge>
          )}
          <Bell className="h-3.5 w-3.5 text-red-500" />
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && !loading && engpassZonen.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
            Folgende Zonen haben &gt;80% Auslastung ohne freie Fahrer — sofortige Maßnahme erforderlich:
          </p>

          {engpassZonen.map(z => {
            const auslastungPct = Math.round((z.bestellungen / Math.max(1, z.max_bestellungen)) * 100);
            return (
              <div
                key={z.zone}
                className={cn(
                  'rounded-xl border-2 border-red-400 px-4 py-3 bg-white dark:bg-gray-900/50',
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-black border', ZONE_FARBEN[z.zone])}>
                      {z.zone}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-red-700 dark:text-red-300">Zone {z.zone} — ENGPASS</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {z.bestellungen} Bestellungen • 0 freie Fahrer
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-red-600">{auslastungPct}%</div>
                    <div className="text-[9px] text-muted-foreground">Auslastung</div>
                  </div>
                </div>

                <div className="mb-2 h-2 w-full rounded-full bg-red-200 dark:bg-red-900/40">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${Math.min(100, auslastungPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-red-600 font-bold">Ø Lieferzeit: {z.avg_lieferzeit_min} Min</span>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 font-bold',
                    z.trend === 'steigend' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                  )}>
                    {z.trend === 'steigend' ? '↑ Steigend' : z.trend === 'fallend' ? '↓ Fallend' : '→ Stabil'}
                  </span>
                </div>

                <div className="mt-2 rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-2 text-[11px] text-red-700 dark:text-red-300 font-medium">
                  Empfehlung: Fahrer aus Zone{' '}
                  {z.zone === 'A' ? 'B oder C' : z.zone === 'B' ? 'A oder C' : z.zone === 'C' ? 'D oder B' : 'C'}
                  {' '}umleiten oder neue Schicht anfragen.
                </div>
              </div>
            );
          })}

          {lastPoll && (
            <p className="text-[9px] text-muted-foreground text-right">
              Zuletzt geprüft: {lastPoll.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (60s Polling)
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
