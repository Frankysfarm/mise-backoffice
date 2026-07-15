'use client';

import React, { useMemo, useState } from 'react';

interface OrderInput {
  id: string;
  bestellnummer?: string;
  status: string;
  bestellt_am?: string | null;
  name?: string;
  zone?: string | null;
}

interface BatchInput {
  id: string;
  status?: string;
  gestartet_am?: string | null;
  stops?: StopInput[];
}

interface StopInput {
  id: string;
  geliefert_am?: string | null;
}

interface ChecklistItem {
  id: string;
  label: string;
  detail?: string;
  urgent?: boolean;
}

interface Props {
  orders: OrderInput[];
  batches: BatchInput[];
  stops: StopInput[];
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export function KitchenPhase1638SchichtUebergabeCheckliste({ orders, batches, stops }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const { offeneBestellungen, offeneTouren, checklist } = useMemo(() => {
    const offen = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
    const offeneTours = batches.filter((b) => {
      if (!b.stops || b.stops.length === 0) return false;
      return b.stops.some((s) => !s.geliefert_am);
    });

    const items: ChecklistItem[] = [];

    // Offene Bestellungen als Checklisten-Items
    offen.forEach((o) => {
      const minAlt = o.bestellt_am ? minutesAgo(o.bestellt_am) : null;
      const urgent = minAlt !== null && minAlt > 20;
      items.push({
        id: `order-${o.id}`,
        label: `Bestellung ${o.bestellnummer ?? o.id.slice(0, 6)} — ${o.status}`,
        detail: minAlt !== null ? `Vor ${minAlt} Min eingegangen${o.zone ? ` · Zone ${o.zone}` : ''}` : undefined,
        urgent,
      });
    });

    // Nicht abgeschlossene Touren
    offeneTours.forEach((b) => {
      const abg = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
      const ges = b.stops?.length ?? 0;
      const minAlt = b.gestartet_am ? minutesAgo(b.gestartet_am) : null;
      items.push({
        id: `batch-${b.id}`,
        label: `Tour ${b.id.slice(0, 6)} — ${abg}/${ges} Stopps geliefert`,
        detail: minAlt !== null ? `Gestartet vor ${minAlt} Min` : undefined,
        urgent: minAlt !== null && minAlt > 40,
      });
    });

    // Standard-Schicht-Hinweise
    items.push(
      { id: 'hint-equipment', label: 'Küchengeräte abgeschaltet / gesichert', urgent: false },
      { id: 'hint-cleanup',   label: 'Arbeitsplatz gereinigt und übergeben', urgent: false },
      { id: 'hint-nextshift', label: 'Nächste Schicht informiert', urgent: false },
    );

    return { offeneBestellungen: offen, offeneTouren: offeneTours, checklist: items };
  }, [orders, batches, stops]);

  const totalItems = checklist.length;
  const doneItems  = checklist.filter((i) => checked.has(i.id)).length;
  const allDone    = doneItems === totalItems;
  const pct        = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 100;
  const urgent     = checklist.some((i) => i.urgent && !checked.has(i.id));

  if (totalItems === 0) return null;

  return (
    <div className={`rounded-2xl border overflow-hidden shadow-sm mb-4 ${
      allDone ? 'border-emerald-200 bg-emerald-50' :
      urgent   ? 'border-red-200 bg-white' :
                 'border-amber-200 bg-white'
    }`}>
      {/* Header */}
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 text-white ${
          allDone ? 'bg-emerald-600' : urgent ? 'bg-red-600' : 'bg-amber-600'
        }`}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-sm font-bold uppercase tracking-wider flex-1 text-left">
          Schicht-Übergabe-Checkliste
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-white/25 rounded-full px-2 py-0.5 font-bold tabular-nums">
            {doneItems}/{totalItems}
          </span>
          {offeneBestellungen.length > 0 && (
            <span className="bg-white/15 rounded-full px-2 py-0.5">
              {offeneBestellungen.length} offen
            </span>
          )}
          <span className="opacity-70 text-[10px]">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {/* Fortschrittsbalken */}
          <div className="px-1 pb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Übergabe-Fortschritt</span>
              <span className="tabular-nums font-medium">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  allDone ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Checkliste */}
          <div className="space-y-1.5">
            {checklist.map((item) => {
              const done = checked.has(item.id);
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    done
                      ? 'bg-emerald-50 border border-emerald-200'
                      : item.urgent
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-stone-50 border border-stone-200 hover:bg-stone-100'
                  }`}
                  onClick={() => toggle(item.id)}
                >
                  {/* Checkbox */}
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    done ? 'bg-emerald-500 border-emerald-500' : item.urgent ? 'border-red-400' : 'border-stone-400'
                  }`}>
                    {done && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${
                      done ? 'line-through text-emerald-700' : item.urgent ? 'text-red-700' : 'text-stone-800'
                    }`}>
                      {item.urgent && !done && <span className="mr-1">⚠️</span>}
                      {item.label}
                    </p>
                    {item.detail && (
                      <p className={`text-[10px] mt-0.5 ${done ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {item.detail}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fertig-Banner */}
          {allDone && (
            <div className="rounded-xl bg-emerald-100 border border-emerald-300 px-3 py-2 text-center">
              <p className="text-xs font-bold text-emerald-700">✓ Schicht vollständig übergeben</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
