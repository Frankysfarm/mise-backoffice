'use client';

// Phase 1285 — Zutaten-Nachbestellungs-Alert (Kitchen)
// Wenn bestimmte Artikel in der letzten Stunde >X mal bestellt:
//   geschätzter Restbestand + Nachbestellungs-Empfehlung + Timer bis Restbestand 0
// Props-basiert (orders) · useMemo · nur sichtbar wenn Alarm-Einträge vorhanden

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
}

interface Order {
  id: string;
  created_at?: string | null;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
  stundenFenster?: number;   // Stunden-Fenster für Analyse (default 1)
  schwelle?: number;         // Bestellungen ab der Alarm (default 6)
}

interface ArtikelBestand {
  artikel: string;
  bestellungenLetzte1h: number;
  hochgerechneterVerbrauch: number; // /h
  geschaetzterRestbestand: number;  // Einheiten
  minutenBisLeer: number | null;
  empfehlung: string;
  stufe: 'info' | 'warnung' | 'kritisch';
}

// Schätzwerte für Anfangsbestand je Schicht (Einheiten)
const ANFANGSBESTAND: Record<string, number> = {
  burger:    30,
  pizza:     25,
  döner:     40,
  pasta:     35,
  pommes:    60,
  salat:     20,
  sandwich:  25,
  wrap:      20,
  suppe:     15,
  dessert:   30,
};

function matchArtikel(name: string): string | null {
  const lower = name.toLowerCase();
  for (const key of Object.keys(ANFANGSBESTAND)) {
    if (lower.includes(key)) return key;
  }
  return null;
}

function getNachbestellEmpfehlung(artikel: string, hochrechnung: number): string {
  const menge = Math.ceil(hochrechnung * 2);
  const empfehlungen: Record<string, string> = {
    burger:   `${menge} Hackfleisch-Portionen + ${menge} Brötchen nachbestellen`,
    pizza:    `${menge} Teig-Rohlinge + ${menge} Tomatensauce-Portionen`,
    döner:    `${menge} Fleisch-Portionen + ${menge} Fladenbrote`,
    pasta:    `${menge} Nudel-Portionen + Sauce prüfen`,
    pommes:   `${menge} kg Kartoffeln + Frittieröl prüfen`,
    salat:    `${menge} Salatköpfe + Dressing-Vorrat prüfen`,
    sandwich: `${menge} Brot-Einheiten + Beläge prüfen`,
    wrap:     `${menge} Tortillas + Füllungen prüfen`,
    suppe:    `${menge} Liter Brühe + Einlagen prüfen`,
    dessert:  `${menge} Dessert-Portionen vorbereiten`,
  };
  return empfehlungen[artikel] ?? `${menge} Einheiten nachbestellen`;
}

export function KitchenPhase1285ZutatenNachbestellungAlert({ orders, stundenFenster = 1, schwelle = 6 }: Props) {
  const [open, setOpen] = useState(true);

  const alarme = useMemo((): ArtikelBestand[] => {
    const jetzt = Date.now();
    const fensterMs = stundenFenster * 3_600_000;
    const cutoff = jetzt - fensterMs;

    const zaehler = new Map<string, number>();

    for (const order of orders) {
      const orderTime = order.created_at ? new Date(order.created_at).getTime() : 0;
      if (orderTime < cutoff) continue;
      for (const item of order.items ?? []) {
        const name = item.name ?? '';
        const key = matchArtikel(name);
        if (!key) continue;
        const qty = item.quantity ?? 1;
        zaehler.set(key, (zaehler.get(key) ?? 0) + qty);
      }
    }

    const result: ArtikelBestand[] = [];
    for (const [artikel, bestellungen] of zaehler.entries()) {
      if (bestellungen < schwelle) continue;
      const anfang = ANFANGSBESTAND[artikel] ?? 20;
      const schichtStartedAgoH = 4; // geschätzte vergangene Schichtdauer
      const verbrauchBisher = Math.min(anfang, Math.round(bestellungen * 1.1));
      const restbestand = Math.max(0, anfang - verbrauchBisher);
      const hochrechnung = bestellungen / stundenFenster;
      const minutenBisLeer = restbestand > 0 && hochrechnung > 0
        ? Math.round((restbestand / hochrechnung) * 60)
        : null;

      let stufe: ArtikelBestand['stufe'] = 'info';
      if (restbestand === 0) stufe = 'kritisch';
      else if (minutenBisLeer !== null && minutenBisLeer <= 30) stufe = 'kritisch';
      else if (minutenBisLeer !== null && minutenBisLeer <= 60) stufe = 'warnung';

      result.push({
        artikel,
        bestellungenLetzte1h: bestellungen,
        hochgerechneterVerbrauch: Math.round(hochrechnung * 10) / 10,
        geschaetzterRestbestand: restbestand,
        minutenBisLeer,
        empfehlung: getNachbestellEmpfehlung(artikel, hochrechnung),
        stufe,
      });
    }

    return result.sort((a, b) => {
      const order = { kritisch: 0, warnung: 1, info: 2 };
      return order[a.stufe] - order[b.stufe];
    });
  }, [orders, stundenFenster, schwelle]);

  if (alarme.length === 0) return null;

  const kritischCount = alarme.filter((a) => a.stufe === 'kritisch').length;

  const STUFE_STYLE = {
    kritisch: {
      bg: 'bg-red-50 dark:bg-red-950',
      border: 'border-red-200 dark:border-red-800',
      badge: 'bg-red-500 text-white',
      icon: 'text-red-500',
    },
    warnung: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      border: 'border-amber-200 dark:border-amber-800',
      badge: 'bg-amber-400 text-white',
      icon: 'text-amber-500',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      badge: 'bg-blue-400 text-white',
      icon: 'text-blue-500',
    },
  };

  const headerStyle = kritischCount > 0 ? STUFE_STYLE.kritisch : alarme[0].stufe === 'warnung' ? STUFE_STYLE.warnung : STUFE_STYLE.info;

  return (
    <div className={cn('rounded-xl border overflow-hidden', headerStyle.bg, headerStyle.border)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <ShoppingCart className={cn('h-4 w-4 shrink-0', headerStyle.icon)} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Zutaten-Nachbestellungs-Alert
        </span>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full mr-2', headerStyle.badge)}>
          {alarme.length} Artikel{kritischCount > 0 && ` · ${kritischCount} kritisch`}
        </span>
        {open ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alarme.map((alarm) => {
            const st = STUFE_STYLE[alarm.stufe];
            return (
              <div key={alarm.artikel} className={cn('rounded-lg border p-3 bg-background space-y-2', alarm.stufe === 'kritisch' && 'border-red-300 dark:border-red-700')}>
                <div className="flex items-center gap-2 flex-wrap">
                  <Package className={cn('h-4 w-4 shrink-0', st.icon)} />
                  <span className="text-sm font-bold capitalize">{alarm.artikel}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', st.badge)}>
                    {alarm.stufe.charAt(0).toUpperCase() + alarm.stufe.slice(1)}
                  </span>
                  {alarm.stufe === 'kritisch' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse ml-auto" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-black tabular-nums">{alarm.bestellungenLetzte1h}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Letzte 1h</div>
                  </div>
                  <div>
                    <div className="text-lg font-black tabular-nums">{alarm.geschaetzterRestbestand}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Restbestand</div>
                  </div>
                  <div>
                    {alarm.minutenBisLeer !== null ? (
                      <>
                        <div className={cn('text-lg font-black tabular-nums flex items-center justify-center gap-0.5', alarm.minutenBisLeer <= 30 && 'text-red-600')}>
                          <Clock className="h-3.5 w-3.5" />
                          {alarm.minutenBisLeer}m
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Bis leer</div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-black text-red-600">LEER</div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Bestand</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-md bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground flex items-start gap-1.5">
                  <ShoppingCart className="h-3 w-3 shrink-0 mt-0.5 text-primary" />
                  <span>{alarm.empfehlung}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
