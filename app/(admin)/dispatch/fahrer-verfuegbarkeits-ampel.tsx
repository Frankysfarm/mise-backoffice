'use client';

/**
 * FahrerVerfügbarkeitsAmpel
 * Kompakte Echtzeit-Übersicht über Fahrverfügbarkeit im Dispatch.
 * Zeigt: online/frei/unterwegs/zurück — farbkodiert als horizontale Ampelleiste.
 */

import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, RotateCcw } from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  last_update: string | null;
  employee: { id: string; vorname: string; nachname: string; avatar_url: string | null; telefon: string | null } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
};

function fahrerZustand(d: Driver, batches: Batch[]): 'frei' | 'unterwegs' | 'zurueck' {
  if (!d.aktueller_batch_id) return 'frei';
  const b = batches.find(b => b.id === d.aktueller_batch_id);
  if (!b) return 'frei';
  if (b.status === 'pickup' || b.status === 'aktiv' || b.status === 'on_route') return 'unterwegs';
  return 'zurueck';
}

function etaRemainingMin(d: Driver, batches: Batch[]): number | null {
  if (!d.aktueller_batch_id) return null;
  const b = batches.find(b => b.id === d.aktueller_batch_id);
  if (!b || !b.startzeit || !b.total_eta_min) return null;
  const eta = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
  const rem = Math.max(0, Math.floor((eta - Date.now()) / 60_000));
  return rem;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
}

const ZUSTAND_META = {
  frei:       { label: 'Frei',       bg: 'bg-matcha-100', text: 'text-matcha-800', dot: 'bg-matcha-500', Icon: CheckCircle2 },
  unterwegs:  { label: 'Unterwegs',  bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500',   Icon: Bike         },
  zurueck:    { label: 'Zurück',     bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-400',  Icon: RotateCcw    },
};

export function FahrerVerfügbarkeitsAmpel({ drivers, batches }: Props) {
  const online = drivers.filter(d => d.ist_online);
  if (online.length === 0) return null;

  const grouped: Record<'frei' | 'unterwegs' | 'zurueck', Driver[]> = { frei: [], unterwegs: [], zurueck: [] };
  for (const d of online) {
    grouped[fahrerZustand(d, batches)].push(d);
  }

  const freePct   = (grouped.frei.length       / online.length) * 100;
  const onWayPct  = (grouped.unterwegs.length  / online.length) * 100;
  const backPct   = (grouped.zurueck.length    / online.length) * 100;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Bike className="h-4 w-4 text-muted-foreground" />
        <span className="font-display text-xs font-bold uppercase tracking-wider">Fahrer-Ampel</span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">{online.length} online</span>
      </div>

      {/* Farbleiste */}
      <div className="flex h-3 w-full overflow-hidden" title="Grün = frei, Blau = unterwegs, Amber = auf dem Rückweg">
        {freePct  > 0 && <div className="bg-matcha-400 transition-all" style={{ width: `${freePct}%` }}  />}
        {onWayPct > 0 && <div className="bg-blue-400   transition-all" style={{ width: `${onWayPct}%` }} />}
        {backPct  > 0 && <div className="bg-amber-400  transition-all" style={{ width: `${backPct}%` }}  />}
      </div>

      {/* Fahrer-Liste kompakt */}
      <div className="px-3 py-2 space-y-1">
        {(['frei', 'unterwegs', 'zurueck'] as const).map(z => {
          const meta = ZUSTAND_META[z];
          const list = grouped[z];
          if (list.length === 0) return null;
          const Icon = meta.Icon;
          return (
            <div key={z} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5', meta.bg)}>
              <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.text)} />
              <span className={cn('text-[10px] font-bold uppercase tracking-wider w-16 shrink-0', meta.text)}>
                {meta.label}
              </span>
              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                {list.map(d => {
                  const name = d.employee ? `${d.employee.vorname[0]}. ${d.employee.nachname}` : d.employee_id.slice(0, 6);
                  const eta = z === 'unterwegs' ? etaRemainingMin(d, batches) : null;
                  return (
                    <span key={d.employee_id} className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black',
                      meta.bg, meta.text, 'border border-black/10',
                    )}>
                      {name}
                      {eta !== null && (
                        <span className="flex items-center gap-0.5 opacity-70">
                          <Clock className="h-2.5 w-2.5" />
                          {eta}m
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className={cn('ml-auto text-[11px] font-black tabular-nums shrink-0', meta.text)}>
                {list.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
