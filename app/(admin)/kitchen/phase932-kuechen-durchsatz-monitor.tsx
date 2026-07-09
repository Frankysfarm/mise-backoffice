'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Gauge, Zap, Clock } from 'lucide-react';

/**
 * Phase 932 — Küchen-Durchsatz-Monitor (Kitchen)
 *
 * Client-seitig: Bestellungen pro Stunde + Peak-Stunde + Hochrechnung.
 * Kein API-Aufruf — berechnet aus orders prop.
 */

interface Order {
  id: string;
  bestellt_am: string | null;
  status: string;
}

interface Props {
  orders: Order[];
}

interface StundeData {
  stunde: number;
  label: string;
  anzahl: number;
}

const STATUS_AKTIV = new Set([
  'neu', 'bestätigt', 'in_zubereitung', 'fertig',
  'unterwegs', 'abgeholt', 'dispatched', 'in_delivery',
]);

function pad(n: number) { return n.toString().padStart(2, '0'); }

export function KitchenPhase932KuechenDurchsatzMonitor({ orders }: Props) {
  const { stundenGraf, bestellungenHeute, fertigHeute, aktuelleStunde, hochrechnung, peakStunde, durchsatzProH } = useMemo(() => {
    const jetzt = new Date();
    const tagesbeginn = new Date(jetzt);
    tagesbeginn.setHours(0, 0, 0, 0);

    const ordersHeute = orders.filter((o) => {
      if (!o.bestellt_am) return false;
      return new Date(o.bestellt_am) >= tagesbeginn;
    });

    const stundenGraf: StundeData[] = [];
    for (let h = 0; h <= jetzt.getHours(); h++) {
      const anzahl = ordersHeute.filter((o) => {
        const d = new Date(o.bestellt_am!);
        return d.getHours() === h;
      }).length;
      stundenGraf.push({ stunde: h, label: `${pad(h)}:00`, anzahl });
    }

    const aktuelleStunde = jetzt.getHours();
    const minSeit = jetzt.getMinutes() + 1;
    const aktuelleAnzahl = stundenGraf[stundenGraf.length - 1]?.anzahl ?? 0;
    const durchsatzProH = minSeit > 0 ? Math.round((aktuelleAnzahl / minSeit) * 60 * 10) / 10 : 0;

    const peakEintrag = stundenGraf.slice(0, -1).reduce(
      (best, s) => s.anzahl > best.anzahl ? s : best,
      stundenGraf[0] ?? { stunde: 0, label: '', anzahl: 0 },
    );

    const stundenUebrig = 23 - aktuelleStunde;
    const hochrechnung = Math.round(ordersHeute.length + durchsatzProH * stundenUebrig);

    return {
      stundenGraf,
      bestellungenHeute: ordersHeute.length,
      fertigHeute: ordersHeute.filter((o) => !STATUS_AKTIV.has(o.status)).length,
      aktuelleStunde,
      hochrechnung,
      peakStunde: peakEintrag,
      durchsatzProH,
    };
  }, [orders]);

  const maxAnzahl = Math.max(...stundenGraf.map((s) => s.anzahl), 1);

  const ampelColor = durchsatzProH >= 6
    ? 'text-red-600 bg-red-50 border-red-200'
    : durchsatzProH >= 3
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-matcha-600 bg-matcha-50 border-matcha-200';

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-matcha-600" />
        <span className="text-sm font-semibold text-stone-800">Küchen-Durchsatz</span>
        <span className={cn('ml-auto text-xs font-bold px-2 py-0.5 rounded-full border', ampelColor)}>
          {durchsatzProH.toFixed(1)} Best./h
        </span>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-stone-50 border border-stone-200 p-2 text-center">
          <div className="text-lg font-bold text-stone-800">{bestellungenHeute}</div>
          <div className="text-[10px] text-stone-500">Heute gesamt</div>
        </div>
        <div className="rounded-lg bg-matcha-50 border border-matcha-200 p-2 text-center">
          <div className="text-lg font-bold text-matcha-700">{fertigHeute}</div>
          <div className="text-[10px] text-matcha-600">Fertig</div>
        </div>
        <div className="rounded-lg bg-sky-50 border border-sky-200 p-2 text-center">
          <div className="text-lg font-bold text-sky-700">{hochrechnung}</div>
          <div className="text-[10px] text-sky-600">Hochrechnung</div>
        </div>
      </div>

      {/* Stunden-Balkendiagramm */}
      {stundenGraf.length > 0 && (
        <div>
          <div className="text-[11px] text-stone-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />Bestellungen je Stunde heute
          </div>
          <div className="flex items-end gap-0.5 h-14">
            {stundenGraf.map((s) => (
              <div
                key={s.stunde}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${s.label}: ${s.anzahl} Bestellungen`}
              >
                <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                  <div
                    className={cn(
                      'w-full rounded-t-sm',
                      s.stunde === aktuelleStunde
                        ? 'bg-sky-400'
                        : s.stunde === peakStunde?.stunde
                          ? 'bg-amber-400'
                          : 'bg-matcha-400',
                    )}
                    style={{ height: `${(s.anzahl / maxAnzahl) * 100}%`, minHeight: s.anzahl > 0 ? '2px' : '0' }}
                  />
                </div>
                {s.stunde % 3 === 0 && (
                  <span className="text-[8px] text-stone-400">{pad(s.stunde)}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-1 text-[10px] text-stone-400">
            <span><span className="inline-block w-2 h-2 rounded-sm bg-sky-400 align-middle mr-0.5" />Aktuell</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 align-middle mr-0.5" />Peak</span>
            <span><span className="inline-block w-2 h-2 rounded-sm bg-matcha-400 align-middle mr-0.5" />Frühere Stunden</span>
          </div>
        </div>
      )}

      {peakStunde && peakStunde.anzahl > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <Zap className="w-3 h-3 shrink-0" />
          Peak heute: <strong>{peakStunde.label}</strong> mit {peakStunde.anzahl} Bestellungen.
        </div>
      )}
    </div>
  );
}
