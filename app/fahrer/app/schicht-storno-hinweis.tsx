'use client';

/**
 * SchichtStornoHinweis — Phase 416
 *
 * Warnt den Fahrer wenn die aktuelle Stunde ein bekannter Storno-Hotspot ist
 * (basierend auf Storno-Muster-Matrix). Kein-Fahrer + Zone-Probleme
 * sind dispatch-relevant; hier zeigen wir dem Fahrer Awareness für Zone-Probleme.
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';

type StornoCause = 'kueche_verzoegerung' | 'kein_fahrer' | 'kunde_storniert' | 'zone_problem' | 'unbekannt';

interface StornoHotspot {
  dayOfWeek: number;
  hourOfDay: number;
  stornoRate: number;
  primaryCause: StornoCause | null;
  recommendation: string;
}

const DOW_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function SchichtStornoHinweis({ locationId }: { locationId: string | null }) {
  const [hotspot, setHotspot] = useState<StornoHotspot | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/storno-muster-matrix?location_id=${locationId}&action=hotspots`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json() as { hotspots: StornoHotspot[] };
      const now = new Date();
      const currentDow = now.getDay();
      const currentHour = now.getHours();
      const current = data.hotspots.find(
        (h) => h.dayOfWeek === currentDow && h.hourOfDay === currentHour,
      );
      setHotspot(current ?? null);
      setDismissed(false);
    } catch {
      // silently ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    // Re-check on new hour
    const now = new Date();
    const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000;
    const t = setTimeout(() => {
      load();
      const interval = setInterval(load, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }, msUntilNextHour);
    return () => clearTimeout(t);
  }, [load]);

  if (!hotspot || dismissed) return null;

  const isZoneProblem = hotspot.primaryCause === 'zone_problem';
  const isKeinFahrer = hotspot.primaryCause === 'kein_fahrer';

  if (!isZoneProblem && !isKeinFahrer) return null;

  const now = new Date();

  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-amber-800">
          {isZoneProblem ? 'Bekannte Problemzone — jetzt' : 'Hochnachfrage-Stunde'}
        </div>
        <div className="text-xs text-amber-700 mt-0.5">
          {DOW_FULL[now.getDay()]} {now.getHours()}:00–{now.getHours() + 1}:00 Uhr —{' '}
          historische Stornorate {(hotspot.stornoRate * 100).toFixed(0)}%.
          {isZoneProblem && ' Auf Zonenprobleme achten.'}
          {isKeinFahrer && ' Viele Bestellungen, wenig Fahrer — zügig bleiben.'}
        </div>
        <div className="text-[11px] text-amber-600 mt-1">{hotspot.recommendation}</div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-400 hover:text-amber-700 transition"
        aria-label="Schließen"
      >
        <XCircle className="h-4 w-4" />
      </button>
    </div>
  );
}
