'use client';

import React, { useEffect, useState } from 'react';

interface SchichtSlot {
  datum: string;
  uhrzeit: string;
  fahrer_count: number;
  luecke: boolean;
}

interface FahrerSchicht {
  fahrer_id: string;
  name: string;
  schichten: Array<{ datum: string; von: string; bis: string }>;
}

interface ApiData {
  fahrer: FahrerSchicht[];
  slots: SchichtSlot[];
  luecken_count: number;
  generiert_um: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr(): string {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
}

export function DispatchPhase1544FahrerVerfuegbarkeitsKalenderWidget() {
  const [data, setData] = useState<ApiData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/fahrer-verfuegbarkeit');
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-4 w-52 bg-muted rounded mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
      </div>
    </div>
  );

  const today    = todayStr();
  const tomorrow = tomorrowStr();
  const relevantDates = [today, tomorrow];

  const fahrerHeute    = data.fahrer.filter(f => f.schichten.some(s => s.datum === today));
  const fahrerMorgen   = data.fahrer.filter(f => f.schichten.some(s => s.datum === tomorrow));
  const luecken        = data.slots.filter(s => relevantDates.includes(s.datum) && s.luecke);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h3 className="text-sm font-semibold">Fahrer-Verfügbarkeit</h3>
        </div>
        <div className="flex items-center gap-2">
          {data.luecken_count > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              ⚠ {data.luecken_count} Lücke{data.luecken_count !== 1 ? 'n' : ''}
            </span>
          )}
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Heute', datum: today, fahrer: fahrerHeute },
          { label: 'Morgen', datum: tomorrow, fahrer: fahrerMorgen },
        ].map(({ label, datum, fahrer }) => (
          <div key={datum} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">{label}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                fahrer.length < 2 ? 'bg-red-200 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                fahrer.length < 3 ? 'bg-yellow-200 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' :
                'bg-green-200 dark:bg-green-900/50 text-green-700 dark:text-green-300'
              }`}>
                {fahrer.length} Fahrer
              </span>
            </div>
            {fahrer.length === 0 ? (
              <p className="text-xs text-red-500 dark:text-red-400">Keine Schichten geplant!</p>
            ) : (
              <div className="space-y-1">
                {fahrer.slice(0, 3).map(f => {
                  const schicht = f.schichten.find(s => s.datum === datum);
                  return (
                    <div key={f.fahrer_id} className="flex items-center justify-between text-[11px]">
                      <span className="truncate font-medium">{f.name}</span>
                      {schicht && (
                        <span className="text-muted-foreground font-mono whitespace-nowrap ml-1">
                          {schicht.von}–{schicht.bis}
                        </span>
                      )}
                    </div>
                  );
                })}
                {fahrer.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{fahrer.length - 3} weitere</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {luecken.length > 0 && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 px-3 py-2">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Lücken ({"<"} 2 Fahrer):</p>
          <div className="flex flex-wrap gap-1">
            {luecken.slice(0, 6).map(s => (
              <span key={`${s.datum}-${s.uhrzeit}`} className="text-[10px] px-1.5 py-0.5 rounded bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 font-mono">
                {s.datum.slice(5)} {s.uhrzeit}
              </span>
            ))}
            {luecken.length > 6 && <span className="text-[10px] text-muted-foreground">+{luecken.length - 6}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
