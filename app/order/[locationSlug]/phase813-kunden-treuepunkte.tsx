'use client';

import { useEffect, useState } from 'react';
import { Star, Gift, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string;
  orderId?: string | null;
}

interface TreuePunkte {
  punkte: number;
  stufe: 'Bronze' | 'Silber' | 'Gold' | 'Platin';
  naechsteStufe: string | null;
  punkteBisNaechsteStufe: number | null;
  einloesbar: boolean;
  einloesWert: number;
}

const MOCK: TreuePunkte = {
  punkte: 340,
  stufe: 'Silber',
  naechsteStufe: 'Gold',
  punkteBisNaechsteStufe: 160,
  einloesbar: true,
  einloesWert: 3.4,
};

const STUFEN = [
  { name: 'Bronze', ab: 0, farbe: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
  { name: 'Silber', ab: 200, farbe: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-200 dark:border-slate-700' },
  { name: 'Gold', ab: 500, farbe: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-800' },
  { name: 'Platin', ab: 1000, farbe: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-800' },
];

function getStufe(punkte: number): typeof STUFEN[0] {
  return [...STUFEN].reverse().find((s) => punkte >= s.ab) ?? STUFEN[0];
}

export function Phase813KundenTreuepunkte({ locationId, orderId }: Props) {
  const [data, setData] = useState<TreuePunkte | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const key = `treuepunkte_${locationId}`;
    const stored = localStorage.getItem(key);

    let punkte = 0;
    if (stored) {
      try { punkte = JSON.parse(stored) as number; } catch { punkte = 0; }
    }

    if (orderId) {
      const pointsForOrder = 10;
      const addedKey = `treuepunkte_added_${orderId}`;
      if (!localStorage.getItem(addedKey)) {
        punkte += pointsForOrder;
        localStorage.setItem(key, JSON.stringify(punkte));
        localStorage.setItem(addedKey, '1');
      }
    }

    const stufeInfo = getStufe(punkte);
    const stufeIdx = STUFEN.findIndex((s) => s.name === stufeInfo.name);
    const naechste = stufeIdx < STUFEN.length - 1 ? STUFEN[stufeIdx + 1] : null;

    setData({
      punkte,
      stufe: stufeInfo.name as TreuePunkte['stufe'],
      naechsteStufe: naechste?.name ?? null,
      punkteBisNaechsteStufe: naechste ? naechste.ab - punkte : null,
      einloesbar: punkte >= 100,
      einloesWert: Math.floor(punkte / 100) * 1.0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, orderId]);

  if (!data) return null;

  const stufeInfo = getStufe(data.punkte);
  const naechste = data.naechsteStufe ? STUFEN.find((s) => s.name === data.naechsteStufe) : null;
  const fortschrittPct = naechste
    ? Math.min(
        100,
        Math.round(
          ((data.punkte - stufeInfo.ab) / (naechste.ab - stufeInfo.ab)) * 100,
        ),
      )
    : 100;

  return (
    <div className={`rounded-xl border ${stufeInfo.bg} ${stufeInfo.border} px-4 py-3 shadow-sm`}>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Star className={`h-4 w-4 ${stufeInfo.farbe} shrink-0`} />
          <span className={`text-xs font-semibold ${stufeInfo.farbe}`}>
            Treuepunkte · {data.stufe}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-black tabular-nums ${stufeInfo.farbe}`}>
            {data.punkte} P
          </span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Stufenfortschritt */}
          {naechste && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">
                  Fortschritt zu {naechste.name}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  noch {data.punkteBisNaechsteStufe} P
                </span>
              </div>
              <div className="h-2 rounded-full bg-background/60 overflow-hidden border border-black/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    data.stufe === 'Bronze'
                      ? 'bg-orange-400'
                      : data.stufe === 'Silber'
                      ? 'bg-slate-400'
                      : data.stufe === 'Gold'
                      ? 'bg-yellow-400'
                      : 'bg-purple-400'
                  }`}
                  style={{ width: `${fortschrittPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
                <span>{stufeInfo.name}</span>
                <span>{naechste.name}</span>
              </div>
            </div>
          )}

          {/* Einlösen */}
          {data.einloesbar && (
            <div className="flex items-center gap-2 rounded-lg bg-white/60 dark:bg-black/20 border border-black/10 px-3 py-2">
              <Gift className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-foreground">
                  {data.punkte} Punkte einlösen
                </div>
                <div className="text-[9px] text-muted-foreground">
                  = {data.einloesWert.toFixed(2)} € Rabatt auf deine nächste Bestellung
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-600 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  alert(`${data.einloesWert.toFixed(2)} € Rabatt wird beim nächsten Checkout angewendet.`);
                }}
              >
                Einlösen
              </button>
            </div>
          )}

          {!data.einloesbar && (
            <div className="text-[10px] text-muted-foreground text-center py-1">
              Ab 100 Punkten können Sie Punkte einlösen (noch {100 - data.punkte} P).
            </div>
          )}

          {/* Stufenübersicht */}
          <div className="grid grid-cols-4 gap-1">
            {STUFEN.map((s) => (
              <div
                key={s.name}
                className={`rounded-lg border px-1.5 py-1 text-center ${
                  data.stufe === s.name ? `${s.bg} ${s.border}` : 'bg-muted/40 border-border'
                }`}
              >
                <div className={`text-[9px] font-bold ${data.stufe === s.name ? s.farbe : 'text-muted-foreground'}`}>
                  {s.name}
                </div>
                <div className="text-[8px] text-muted-foreground">{s.ab}+</div>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted-foreground">
            10 Punkte pro Bestellung · 100 P = 1,00 € Rabatt
          </p>
        </div>
      )}
    </div>
  );
}
