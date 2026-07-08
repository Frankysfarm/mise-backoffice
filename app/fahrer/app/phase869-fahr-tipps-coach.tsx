'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

interface Tipp {
  titel: string;
  beschreibung: string;
  kategorie: 'pause' | 'zone' | 'effizienz' | 'sicherheit';
}

interface Props {
  driverId: string;
  locationId?: string | null;
}

const TIPP_POOL: Tipp[] = [
  { titel: 'Pause einlegen', beschreibung: 'Du bist seit über 2 Stunden aktiv. Eine kurze Pause erhöht deine Konzentration und Sicherheit.', kategorie: 'pause' },
  { titel: 'Zone A bevorzugen', beschreibung: 'Zone A hat aktuell hohe Bestelldichte. Kurze Wege = mehr Touren pro Stunde.', kategorie: 'zone' },
  { titel: 'Batch-Routen nutzen', beschreibung: 'Gruppiere Stopps in derselben Straße. Weniger Umwege = mehr Effizienz.', kategorie: 'effizienz' },
  { titel: 'Helm-Check', beschreibung: 'Bitte prüfe deinen Schutzausrüstung vor der nächsten Tour.', kategorie: 'sicherheit' },
  { titel: 'Wasser trinken', beschreibung: 'Bleib hydratiert! Bei langen Schichten sinkt die Aufmerksamkeit ohne ausreichend Flüssigkeit.', kategorie: 'pause' },
  { titel: 'Zone B expandieren', beschreibung: 'Zone B hat freie Kapazität. Wechsel erhöht deinen Tagesverdienst.', kategorie: 'zone' },
  { titel: 'Kürzeste Route nutzen', beschreibung: 'Prüfe deine Navi-Route vor Abfahrt. Verkehr auf der Hauptstraße aktuell +4 Min.', kategorie: 'effizienz' },
  { titel: 'Fahrzeugcheck', beschreibung: 'Kontrolliere Reifen und Beleuchtung vor der ersten Tour des Tages.', kategorie: 'sicherheit' },
];

const KATEGORIE_COLOR: Record<Tipp['kategorie'], string> = {
  pause: 'text-blue-600 dark:text-blue-400',
  zone: 'text-matcha-700 dark:text-matcha-400',
  effizienz: 'text-amber-600 dark:text-amber-400',
  sicherheit: 'text-red-600 dark:text-red-400',
};

const KATEGORIE_BG: Record<Tipp['kategorie'], string> = {
  pause: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
  zone: 'bg-matcha-50 dark:bg-matcha-950 border-matcha-200 dark:border-matcha-800',
  effizienz: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800',
  sicherheit: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
};

export function FahrerPhase869FahrTippsCoach({ driverId, locationId }: Props) {
  const [tipps, setTipps] = useState<Tipp[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) { setLoading(false); return; }
    let mounted = true;

    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/admin/schicht-briefing?location_id=${locationId}&driver_id=${driverId}`
          : `/api/delivery/admin/schicht-briefing?driver_id=${driverId}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (mounted && Array.isArray(json.tipps) && json.tipps.length > 0) {
            setTipps(json.tipps.slice(0, 3));
            setLoading(false);
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted) {
        const shuffled = [...TIPP_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
        setTipps(shuffled);
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 300_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [driverId, locationId]);

  if (loading || tipps.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="flex-1 text-xs font-bold text-foreground">Tipps für deine Schicht</span>
        <span className="text-[10px] text-muted-foreground mr-1">{tipps.length} Hinweise</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {tipps.map((t, i) => (
            <div key={i} className={cn('rounded-md border px-3 py-2 space-y-0.5', KATEGORIE_BG[t.kategorie])}>
              <div className={cn('text-[11px] font-bold', KATEGORIE_COLOR[t.kategorie])}>{t.titel}</div>
              <div className="text-[11px] text-foreground/80 leading-snug">{t.beschreibung}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
