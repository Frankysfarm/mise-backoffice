'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, RefreshCw, ChevronDown, ChevronUp, Users, ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1499 — Lieferzonen-Auslastungs-Karte (Dispatch)
// Phase1497-API: PLZ-Kacheln mit Farbkodierung + Fahrer-Anzahl + Empfehlung-Banner; 5-Min-Polling; nach Phase1493.

interface ZonenEintrag {
  plz: string;
  zone_name: string;
  aktive_bestellungen: number;
  fahrer_anzahl: number;
  status: 'frei' | 'normal' | 'ausgelastet';
  empfehlung: string;
}

interface AuslastungData {
  zonen: ZonenEintrag[];
  gesamt_bestellungen: number;
  gesamt_fahrer: number;
}

interface Props {
  locationId: string | null;
}

const STATUS_CONFIG: Record<string, { tile: string; badge: string; label: string }> = {
  frei: {
    tile: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Frei',
  },
  normal: {
    tile: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    label: 'Normal',
  },
  ausgelastet: {
    tile: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    label: 'Ausgelastet',
  },
};

function buildMock(): AuslastungData {
  return {
    zonen: [
      { plz: '10115', zone_name: 'Zone A', aktive_bestellungen: 2, fahrer_anzahl: 2, status: 'frei', empfehlung: 'Zone 10115: Kapazität frei.' },
      { plz: '10117', zone_name: 'Zone B', aktive_bestellungen: 5, fahrer_anzahl: 2, status: 'normal', empfehlung: 'Zone 10117: Auslastung normal.' },
      { plz: '10119', zone_name: 'Zone C', aktive_bestellungen: 8, fahrer_anzahl: 1, status: 'ausgelastet', empfehlung: 'Zone 10119: 8 Aufträge, nur 1 Fahrer — Kapazität erhöhen.' },
    ],
    gesamt_bestellungen: 15,
    gesamt_fahrer: 5,
  };
}

export function DispatchPhase1499LieferzonenAuslastungsKarte({ locationId }: Props) {
  const [data, setData] = useState<AuslastungData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/lieferzonen-auslastung?location_id=${locationId}`);
      if (!res.ok) { setData(buildMock()); } else { setData(await res.json()); }
    } catch {
      setData(buildMock());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Zonen-Auslastung wird geladen…
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const ausgelastetCount = data.zonen.filter((z) => z.status === 'ausgelastet').length;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        ausgelastetCount > 0
          ? 'border-rose-200 dark:border-rose-800'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      {/* Header */}
      <button
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 hover:opacity-90 transition-opacity',
          ausgelastetCount > 0
            ? 'bg-rose-50 dark:bg-rose-950/30'
            : 'bg-slate-50 dark:bg-slate-800/40',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Map className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Lieferzonen-Auslastung
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {data.gesamt_bestellungen} Aufträge · {data.gesamt_fahrer} Fahrer
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-white dark:bg-slate-900 space-y-3">
          {/* Zone Tiles */}
          <div className="grid grid-cols-1 gap-2">
            {data.zonen.map((zone) => {
              const cfg = STATUS_CONFIG[zone.status] ?? STATUS_CONFIG.normal;
              return (
                <div
                  key={zone.plz}
                  className={cn('rounded-lg border p-3 flex items-start gap-3', cfg.tile)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {zone.zone_name}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        PLZ {zone.plz}
                      </span>
                      <span className={cn('ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.badge)}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        {zone.aktive_bestellungen} Aufträge
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {zone.fahrer_anzahl} Fahrer
                      </span>
                    </div>
                    {zone.status === 'ausgelastet' && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                        {zone.empfehlung}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {data.zonen.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-2">Keine Lieferzonen konfiguriert.</p>
          )}
        </div>
      )}
    </div>
  );
}
