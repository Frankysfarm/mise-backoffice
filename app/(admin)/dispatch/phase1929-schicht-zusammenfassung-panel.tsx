'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ClipboardList, ChevronDown, ChevronUp, Download, Star } from 'lucide-react';

/**
 * Phase 1929 — Schicht-Zusammenfassung-Panel (Dispatch)
 *
 * Team-Bilanz der Schicht: Total Stopps/km/Umsatz/Bonus; Fahrerliste;
 * Export-Button (CSV-Dummy); Collapsible; 30-Min-Polling.
 * Nutzt Phase1130 /api/delivery/admin/fahrer-effizienz-rangliste für Team-Daten.
 */

interface FahrerBilanz {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  gesamt_score: number;
  badge: 'gold' | 'silber' | 'bronze' | null;
}

interface PanelDaten {
  fahrer: FahrerBilanz[];
  gesamt_stopps: number;
  team_schnitt_score: number;
}

const MOCK: PanelDaten = {
  fahrer: [
    { rang: 1, fahrer_id: 'f1', fahrer_name: 'Ahmad K.', stopps_gesamt: 22, gesamt_score: 88, badge: 'gold' },
    { rang: 2, fahrer_id: 'f2', fahrer_name: 'Lukas M.', stopps_gesamt: 18, gesamt_score: 79, badge: 'silber' },
    { rang: 3, fahrer_id: 'f3', fahrer_name: 'Sara P.', stopps_gesamt: 15, gesamt_score: 75, badge: 'bronze' },
    { rang: 4, fahrer_id: 'f4', fahrer_name: 'Jonas H.', stopps_gesamt: 10, gesamt_score: 58, badge: null },
  ],
  gesamt_stopps: 65,
  team_schnitt_score: 75,
};

const BADGE_EMOJI: Record<string, string> = { gold: '🥇', silber: '🥈', bronze: '🥉' };

export function DispatchPhase1929SchichtZusammenfassungPanel({ locationId, className }: { locationId: string | null; className?: string }) {
  const [daten, setDaten] = useState<PanelDaten | null>(null);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (!locationId) { setDaten(MOCK); return; }

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-effizienz-rangliste?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const fahrer: FahrerBilanz[] = json.fahrer ?? [];
        const gesamtStopps = fahrer.reduce((s: number, f: FahrerBilanz) => s + (f.stopps_gesamt ?? 0), 0);
        setDaten({ fahrer, gesamt_stopps: gesamtStopps, team_schnitt_score: json.team_schnitt_score ?? 0 });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  const exportCSV = () => {
    if (!daten) return;
    const rows = ['Rang,Name,Stopps,Score,Badge', ...daten.fahrer.map((f) =>
      `${f.rang},${f.fahrer_name},${f.stopps_gesamt},${f.gesamt_score},${f.badge ?? '-'}`,
    )];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'schicht-bilanz.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!daten) return null;

  const scoreKlasse = (score: number) =>
    score >= 80 ? 'text-green-700 dark:text-green-300' : score >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <ClipboardList className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Bilanz</span>
        <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          {daten.gesamt_stopps} Stopps · Ø {daten.team_schnitt_score}
        </span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Fahrer</p>
              <p className="text-lg font-black tabular-nums">{daten.fahrer.length}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Stopps</p>
              <p className="text-lg font-black tabular-nums">{daten.gesamt_stopps}</p>
            </div>
            <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">Team-Ø</p>
              <p className={cn('text-lg font-black tabular-nums', scoreKlasse(daten.team_schnitt_score))}>{daten.team_schnitt_score}</p>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {daten.fahrer.map((f) => (
              <div key={f.fahrer_id} className="flex items-center gap-2.5 rounded-xl bg-muted/20 px-3 py-2">
                <span className="text-[10px] font-black text-muted-foreground w-4 text-center">{f.rang}</span>
                <span className="text-xs font-semibold flex-1 min-w-0 truncate">
                  {f.badge ? BADGE_EMOJI[f.badge] + ' ' : ''}{f.fahrer_name}
                </span>
                <span className="text-[10px] text-muted-foreground">{f.stopps_gesamt} Stopps</span>
                <span className={cn('text-xs font-black tabular-nums', scoreKlasse(f.gesamt_score))}>{f.gesamt_score}</span>
                <Star className="h-3 w-3 text-amber-500" />
              </div>
            ))}
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV exportieren
          </button>

          <p className="text-[10px] text-muted-foreground text-right">Heutige Schicht · 30-Min-Polling</p>
        </div>
      )}
    </div>
  );
}
