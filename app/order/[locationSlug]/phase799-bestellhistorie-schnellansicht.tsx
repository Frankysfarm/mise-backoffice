'use client';

import { useEffect, useState } from 'react';
import { History, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';

const STORAGE_KEY = 'mise_bestell_historie';
const MAX_EINTRAEGE = 3;

interface HistorieEintrag {
  orderId: string;
  datum: string;
  summe: number;
  artikel: string[];
  status: string;
}

interface Props {
  currentOrderId?: string | null;
  currentItems?: string[];
  currentTotal?: number;
  locationSlug: string;
}

function ladeHistorie(): HistorieEintrag[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistorieEintrag[];
  } catch {
    return [];
  }
}

function speichereHistorie(eintraege: HistorieEintrag[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eintraege.slice(0, MAX_EINTRAEGE)));
  } catch {
    // localStorage not available
  }
}

export function Phase799BestellhistorieSchnellansicht({
  currentOrderId,
  currentItems = [],
  currentTotal = 0,
}: Props) {
  const [historie, setHistorie] = useState<HistorieEintrag[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const existing = ladeHistorie();
    setHistorie(existing);

    // Aktuelle Bestellung in Historie aufnehmen (wenn vorhanden und noch nicht drin)
    if (currentOrderId && currentTotal > 0) {
      const neuEintrag: HistorieEintrag = {
        orderId: currentOrderId,
        datum: new Date().toISOString(),
        summe: currentTotal,
        artikel: currentItems.slice(0, 4),
        status: 'neu',
      };
      const ohneAktuell = existing.filter((e) => e.orderId !== currentOrderId);
      const aktualisiert = [neuEintrag, ...ohneAktuell];
      speichereHistorie(aktualisiert);
      setHistorie(aktualisiert);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrderId]);

  if (historie.length === 0) return null;

  const euro = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n / 100);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
        onClick={() => setOffen((v) => !v)}
        aria-expanded={offen}
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Letzte Bestellungen</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
            {historie.length}
          </span>
        </div>
        {offen ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="border-t divide-y">
          {historie.map((eintrag) => (
            <div key={eintrag.orderId} className="px-4 py-2.5 flex items-start gap-3">
              <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatDate(eintrag.datum)}</span>
                  <span className="text-xs font-semibold tabular-nums">{euro(eintrag.summe)}</span>
                </div>
                {eintrag.artikel.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {eintrag.artikel.join(', ')}
                    {eintrag.artikel.length >= 4 ? ' …' : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div className="px-4 py-1.5">
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                speichereHistorie([]);
                setHistorie([]);
              }}
            >
              Verlauf löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
