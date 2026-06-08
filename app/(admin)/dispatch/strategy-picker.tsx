'use client';

import { useState, useTransition } from 'react';
import { Zap, Scale, PiggyBank, Check, Loader2 } from 'lucide-react';
import { setDispatchStrategy, type DispatchStrategy } from './strategy-action';

const OPTIONS: { key: DispatchStrategy; icon: typeof Zap; title: string; desc: string }[] = [
  { key: 'speed', icon: Zap, title: 'Speed', desc: 'Sofort raus, kaum Buendeln — Essen maximal heiss.' },
  { key: 'balance', icon: Scale, title: 'Balance', desc: 'Buendelt wenn es sich anbietet. Guter Mittelweg.' },
  { key: 'spar', icon: PiggyBank, title: 'Spar', desc: 'Wartet kurz & buendelt maximal — wenigste Fahrten, beste Ersparnis.' },
];

export function StrategyPicker({ current }: { current: DispatchStrategy }) {
  const [sel, setSel] = useState<DispatchStrategy>(current);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function choose(k: DispatchStrategy) {
    if (k === sel || pending) return;
    const prev = sel;
    setSel(k);
    setSaved(false);
    start(async () => {
      const r = await setDispatchStrategy(k);
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setSel(prev);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-semibold text-zinc-900">Dispatch-Strategie (Frank)</div>
          <div className="text-xs text-zinc-500">Wie aggressiv Frank Bestellungen zu Touren buendelt.</div>
        </div>
        {pending && <Loader2 size={16} className="animate-spin text-zinc-400" />}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <Check size={14} /> Gespeichert
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {OPTIONS.map((o) => {
          const active = sel === o.key;
          const Icon = o.icon;
          return (
            <button
              key={o.key}
              onClick={() => choose(o.key)}
              disabled={pending}
              className={`text-left rounded-xl border p-3 transition ${
                active
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-zinc-900">
                <Icon size={16} className={active ? 'text-emerald-600' : 'text-zinc-400'} /> {o.title}
              </div>
              <div className="text-xs text-zinc-500 mt-1">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
