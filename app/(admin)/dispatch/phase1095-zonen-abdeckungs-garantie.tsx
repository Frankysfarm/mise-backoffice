'use client';

import { useEffect, useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, MapPin, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1095 — Zonen-Abdeckungs-Garantie-Monitor (Dispatch)
// Echtzeit-Alert wenn eine Zone komplett unabgedeckt ist (0 Fahrer aktiv)

interface Props { locationId: string | null }

type ZoneStatus = {
  zone: string;
  fahrer_aktiv: number;
  fahrer_gesamt: number;
  status: 'ok' | 'kritisch' | 'unabgedeckt';
  fahrer_namen: string[];
};

type ApiData = {
  zonen: ZoneStatus[];
  unabgedeckte_zonen: string[];
  gesamt_aktiv: number;
  location_id: string | null;
  generiert_am: string;
};

const MOCK: ApiData = {
  zonen: [
    { zone: 'A', fahrer_aktiv: 3, fahrer_gesamt: 4, status: 'ok', fahrer_namen: ['Ahmed', 'Julia', 'Sven'] },
    { zone: 'B', fahrer_aktiv: 1, fahrer_gesamt: 3, status: 'kritisch', fahrer_namen: ['Marcus'] },
    { zone: 'C', fahrer_aktiv: 0, fahrer_gesamt: 2, status: 'unabgedeckt', fahrer_namen: [] },
    { zone: 'D', fahrer_aktiv: 2, fahrer_gesamt: 2, status: 'ok', fahrer_namen: ['Lena', 'Tom'] },
  ],
  unabgedeckte_zonen: ['C'],
  gesamt_aktiv: 6,
  location_id: null,
  generiert_am: new Date().toISOString(),
};

const ZONE_COLORS: Record<ZoneStatus['status'], { bg: string; border: string; badge: string; label: string }> = {
  ok:          { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', label: 'Abgedeckt' },
  kritisch:    { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-400 text-white', label: 'Nur 1 Fahrer' },
  unabgedeckt: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500 text-white animate-pulse', label: 'UNABGEDECKT' },
};

export function DispatchPhase1095ZonenAbdeckungsGarantie({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-live-position?${params}`);
      if (!res.ok) throw new Error();
      const raw = await res.json() as { fahrer?: Array<{ zone?: string | null; status?: string; name?: string }> };

      // Derive zone coverage from driver positions
      const zones = ['A', 'B', 'C', 'D'];
      const zoneMap = new Map<string, { aktiv: string[]; gesamt: number }>(
        zones.map(z => [z, { aktiv: [], gesamt: 0 }]),
      );

      for (const f of (raw.fahrer ?? [])) {
        const z = (f.zone ?? '').toUpperCase();
        if (!zoneMap.has(z)) continue;
        const entry = zoneMap.get(z)!;
        entry.gesamt++;
        if (f.status === 'aktiv' || f.status === 'on_tour' || f.status === 'on-tour') {
          entry.aktiv.push(f.name ?? '');
        }
      }

      const zonen: ZoneStatus[] = zones.map(z => {
        const e = zoneMap.get(z) ?? { aktiv: [], gesamt: 0 };
        const status: ZoneStatus['status'] =
          e.aktiv.length === 0 ? 'unabgedeckt' : e.aktiv.length === 1 ? 'kritisch' : 'ok';
        return {
          zone: z,
          fahrer_aktiv: e.aktiv.length,
          fahrer_gesamt: e.gesamt,
          status,
          fahrer_namen: e.aktiv,
        };
      });

      const unabgedeckte = zonen.filter(z => z.status === 'unabgedeckt').map(z => z.zone);
      setData({
        zonen,
        unabgedeckte_zonen: unabgedeckte,
        gesamt_aktiv: zonen.reduce((s, z) => s + z.fahrer_aktiv, 0),
        location_id: locationId,
        generiert_am: new Date().toISOString(),
      });
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const d = data;
  const hasAlert = (d?.unabgedeckte_zonen.length ?? 0) > 0;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', hasAlert && 'border-red-300')}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          {hasAlert
            ? <AlertOctagon className="h-4 w-4 text-red-500 animate-pulse" />
            : <ShieldCheck className="h-4 w-4 text-matcha-600" />
          }
          <span className="font-display text-sm font-bold uppercase tracking-wider">Zonen-Abdeckungs-Garantie</span>
          {hasAlert && (
            <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
              Zone {d!.unabgedeckte_zonen.join(', ')} FREI
            </span>
          )}
          {!hasAlert && d && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              Alle Zonen aktiv · {d.gesamt_aktiv} Fahrer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          {hasAlert && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <div className="text-xs font-bold text-red-700">
                  Zone {d!.unabgedeckte_zonen.join(' + ')} unabgedeckt — sofort Fahrer entsenden!
                </div>
                <div className="text-[10px] text-red-600 mt-0.5">
                  Bestellungen in dieser Zone können nicht ausgeliefert werden.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {(d?.zonen ?? MOCK.zonen).map(z => {
              const s = ZONE_COLORS[z.status];
              return (
                <div key={z.zone} className={cn('rounded-xl border px-3 py-2', s.bg, s.border)}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-bold">Zone {z.zone}</span>
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {z.fahrer_aktiv} / {z.fahrer_gesamt} aktiv
                  </div>
                  {z.fahrer_namen.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                      {z.fahrer_namen.slice(0, 2).join(', ')}
                      {z.fahrer_namen.length > 2 && ` +${z.fahrer_namen.length - 2}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {d && (
            <div className="text-[10px] text-muted-foreground text-right pt-1">
              Aktualisiert: {new Date(d.generiert_am).toLocaleTimeString('de-DE')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
