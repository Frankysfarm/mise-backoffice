'use client';

import { useEffect, useState } from 'react';
import { Phone, MessageSquare, Radio, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

type Kanal = 'anruf' | 'nachricht' | 'funk';

interface KontaktEintrag {
  id: string;
  uhrzeit: string;
  fahrer_name: string;
  kanal: Kanal;
  betreff: string;
  ergebnis: 'erreicht' | 'nicht_erreicht';
}

function buildMock(): KontaktEintrag[] {
  const now = Date.now();
  const ago = (min: number) =>
    new Date(now - min * 60_000).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return [
    { id: '1', uhrzeit: ago(2), fahrer_name: 'Max M.', kanal: 'anruf', betreff: 'Tour-Status abgefragt', ergebnis: 'erreicht' },
    { id: '2', uhrzeit: ago(7), fahrer_name: 'Anna K.', kanal: 'nachricht', betreff: 'Adresse unklar', ergebnis: 'erreicht' },
    { id: '3', uhrzeit: ago(15), fahrer_name: 'Tom S.', kanal: 'anruf', betreff: 'Kundenkontakt Problem', ergebnis: 'nicht_erreicht' },
    { id: '4', uhrzeit: ago(22), fahrer_name: 'Jana L.', kanal: 'funk', betreff: 'Neue Tour angenommen', ergebnis: 'erreicht' },
    { id: '5', uhrzeit: ago(31), fahrer_name: 'Max M.', kanal: 'nachricht', betreff: 'Pause gemeldet', ergebnis: 'erreicht' },
    { id: '6', uhrzeit: ago(45), fahrer_name: 'Peter R.', kanal: 'anruf', betreff: 'Fahrzeugproblem', ergebnis: 'erreicht' },
    { id: '7', uhrzeit: ago(58), fahrer_name: 'Anna K.', kanal: 'anruf', betreff: 'Tour-Abschluss bestätigt', ergebnis: 'erreicht' },
    { id: '8', uhrzeit: ago(67), fahrer_name: 'Tom S.', kanal: 'nachricht', betreff: 'Verspätung angekündigt', ergebnis: 'erreicht' },
    { id: '9', uhrzeit: ago(81), fahrer_name: 'Jana L.', kanal: 'anruf', betreff: 'Schichtbeginn bestätigt', ergebnis: 'nicht_erreicht' },
    { id: '10', uhrzeit: ago(95), fahrer_name: 'Peter R.', kanal: 'funk', betreff: 'Routen-Update', ergebnis: 'erreicht' },
  ];
}

const KANAL_ICONS: Record<Kanal, typeof Phone> = {
  anruf: Phone,
  nachricht: MessageSquare,
  funk: Radio,
};

const KANAL_LABELS: Record<Kanal, string> = {
  anruf: 'Anruf',
  nachricht: 'Nachricht',
  funk: 'Funk',
};

export function DispatchPhase802FahrerKontaktLog({ locationId: _locationId }: Props) {
  const [eintraege, setEintraege] = useState<KontaktEintrag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // Kein DB-Tabelle für Kontakt-Logs vorhanden — Mock-Daten
    setEintraege(buildMock());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 120_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-32 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const erreicht = eintraege.filter((e) => e.ergebnis === 'erreicht').length;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Fahrer-Kontakt-Log</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {erreicht}/{eintraege.length} erreicht
          </span>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {eintraege.map((e) => {
          const Icon = KANAL_ICONS[e.kanal];
          const erreichtColor =
            e.ergebnis === 'erreicht'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-500 dark:text-red-400';

          return (
            <div
              key={e.id}
              className="flex items-start gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2"
            >
              <Icon
                className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
                  e.ergebnis === 'erreicht'
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-muted-foreground'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold truncate">{e.fahrer_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[9px] font-medium ${erreichtColor}`}>
                      {e.ergebnis === 'erreicht' ? '✓' : '✗'}
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {e.uhrzeit}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-muted-foreground bg-muted/60 rounded px-1 py-0.5">
                    {KANAL_LABELS[e.kanal]}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">{e.betreff}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">Letzte 10 Dispatch→Fahrer-Kontakte · 2-Min-Update</p>
    </div>
  );
}
