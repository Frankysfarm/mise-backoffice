'use client';

/**
 * FahrerIncentiveWidget — Phase 431
 *
 * Zeigt dem Fahrer seine aktuellen Incentive-Ziele mit Fortschrittsbalken.
 * Sichtbar wenn mindestens ein aktives Ziel existiert.
 * Integration: fahrer/app/client.tsx nach SchichtAbschlussBericht.
 */

import { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZielTyp = 'score' | 'puenktlichkeit' | 'lieferungen';

interface Incentive {
  id:             string;
  zielTyp:        ZielTyp;
  zielwert:       number;
  istWert:        number | null;
  bonusEur:       number;
  erreichterAm:   string | null;
  zeitraumStart:  string;
  zeitraumEnd:    string;
  fortschrittPct: number | null;
}

interface Props {
  driverId:   string;
  locationId: string;
}

const ZIEL_LABEL: Record<ZielTyp, string> = {
  score:         'Composite Score',
  puenktlichkeit:'Pünktlichkeit',
  lieferungen:   'Lieferungen',
};

const ZIEL_UNIT: Record<ZielTyp, string> = {
  score:         'Pkt.',
  puenktlichkeit:'%',
  lieferungen:   'Ldg.',
};

export function FahrerIncentiveWidget({ driverId, locationId }: Props) {
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-incentive?location_id=${locationId}&active_only=true`,
        );
        const json = await res.json() as { incentives?: Incentive[] };
        const mine = (json.incentives ?? []).filter(i => true); // driver sees all own (filtered server-side by RLS)
        setIncentives(mine);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [driverId, locationId]);

  if (loading || incentives.length === 0) return null;

  const achieved = incentives.filter(i => i.erreichterAm !== null).length;
  const active   = incentives.filter(i => i.erreichterAm === null).length;

  return (
    <section className="rounded-2xl bg-gradient-to-br from-violet-900 to-violet-800 text-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Trophy className="h-4 w-4 text-yellow-300" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold">Meine Bonus-Ziele</div>
            <div className="text-xs text-violet-300">
              {active > 0 ? `${active} aktiv` : ''}{active > 0 && achieved > 0 ? ' · ' : ''}{achieved > 0 ? `${achieved} erreicht` : ''}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-violet-400" /> : <ChevronDown className="h-4 w-4 text-violet-400" />}
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-3">
          {incentives.map(inc => (
            <DriverIncentiveRow key={inc.id} inc={inc} />
          ))}
        </div>
      )}
    </section>
  );
}

function DriverIncentiveRow({ inc }: { inc: Incentive }) {
  const reached = inc.erreichterAm !== null;
  const pct = inc.fortschrittPct ?? 0;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  return (
    <div className={cn(
      'rounded-xl p-3',
      reached ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-white/10',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {reached
            ? <CheckCircle2 className="h-4 w-4 text-yellow-300 shrink-0" />
            : <Target className="h-4 w-4 text-violet-300 shrink-0" />
          }
          <span className="text-sm font-semibold truncate">{ZIEL_LABEL[inc.zielTyp]}</span>
        </div>
        <span className={cn(
          'text-sm font-black shrink-0',
          reached ? 'text-yellow-300' : 'text-white',
        )}>
          +{inc.bonusEur.toFixed(0)} €
        </span>
      </div>

      <div className="mt-1 text-xs text-violet-300">
        Ziel: {inc.zielwert} {ZIEL_UNIT[inc.zielTyp]}
        {inc.istWert !== null && (
          <span className="ml-1 text-white font-medium">
            · Ist: {inc.istWert} {ZIEL_UNIT[inc.zielTyp]}
          </span>
        )}
        <span className="ml-1">· {fmt(inc.zeitraumStart)} – {fmt(inc.zeitraumEnd)}</span>
      </div>

      {!reached && (
        <div className="mt-2">
          <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-yellow-300 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-violet-400">
            <span>Fortschritt</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {reached && (
        <div className="mt-1 text-xs font-semibold text-yellow-300">
          Ziel erreicht am {new Date(inc.erreichterAm!).toLocaleDateString('de-DE')}
        </div>
      )}
    </div>
  );
}
