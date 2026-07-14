'use client';

import React, { useEffect, useState } from 'react';

interface ZoneTipp {
  zone: string;
  bestellungen: number;
  aktive_fahrer: number;
  empfohlen: boolean;
}

interface Props {
  isOnline?: boolean;
}

export function FahrerPhase1540ZonenTippKarte({ isOnline = false }: Props) {
  const [zonen, setZonen] = useState<ZoneTipp[]>([]);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/zonen-belastung');
      if (!res.ok) return;
      const json = await res.json();
      const mapped: ZoneTipp[] = (json.zonen ?? []).map((z: { zone: string; wartende_bestellungen: number; aktive_fahrer: number; status: string }) => ({
        zone: z.zone,
        bestellungen: z.wartende_bestellungen,
        aktive_fahrer: z.aktive_fahrer,
        empfohlen: z.status !== 'überlastet' && z.wartende_bestellungen > 2,
      }));
      setZonen(mapped);
    } catch {}
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 20 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline]);

  if (!isOnline || zonen.length === 0) return null;

  const empfohlen = zonen.filter(z => z.empfohlen);
  if (empfohlen.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📍</span>
        <h3 className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Zonen-Tipps Heute</h3>
      </div>
      <p className="text-xs text-muted-foreground">Zonen mit vielen Bestellungen und wenig Konkurrenz:</p>
      <div className="space-y-2">
        {empfohlen.map(z => (
          <div key={z.zone} className="rounded-lg bg-white/70 dark:bg-black/20 px-3 py-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Zone {z.zone}</span>
              <span className="text-xs text-muted-foreground ml-2">{z.aktive_fahrer} Fahrer aktiv</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{z.bestellungen}</div>
              <div className="text-[10px] text-muted-foreground">Bestellungen</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
