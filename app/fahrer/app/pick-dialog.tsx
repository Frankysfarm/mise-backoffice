'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, X, Loader2, AlertCircle, ShoppingBag } from 'lucide-react';

type Item = {
  id: string;
  name: string;
  menge: number;
  notiz: string | null;
  pick_confirmed_at: string | null;
  pick_missing: boolean | null;
};

export function PickDialog({
  orderBestellnummer,
  items,
  batchId,
  onClose,
  onComplete,
}: {
  orderBestellnummer: string;
  items: Item[];
  batchId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const supabase = createClient();
  const [pending, setPending] = useState<string | null>(null);
  const [local, setLocal] = useState(items);

  const firstUnconfirmed = local.find((i) => !i.pick_confirmed_at);
  const allDone = !firstUnconfirmed;

  async function confirm(id: string, missing = false) {
    setPending(id);
    const { error } = await supabase.rpc('confirm_pick_item', {
      p_order_item_id: id,
      p_missing: missing,
      p_note: missing ? 'Fahrer meldet: Item fehlt' : null,
    });
    setPending(null);
    if (error) { alert(error.message); return; }
    setLocal((xs) => xs.map((x) => x.id === id
      ? { ...x, pick_confirmed_at: new Date().toISOString(), pick_missing: missing }
      : x));
  }

  async function complete() {
    setPending('complete');
    const { data, error } = await supabase.rpc('confirm_pickup_complete', { p_batch_id: batchId });
    setPending(null);
    if (error || !(data as any)?.ok) {
      alert(error?.message ?? (data as any)?.error ?? 'Fehler');
      return;
    }
    onComplete();
  }

  const confirmed = local.filter((i) => i.pick_confirmed_at).length;

  return (
    <div className="fixed inset-0 z-50 bg-matcha-900 text-white flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Pick-Kontrolle</div>
          <div className="font-display font-bold text-lg">#{orderBestellnummer}</div>
        </div>
        <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-white/10 grid place-items-center">
          <X size={20} />
        </button>
      </header>

      <div className="px-4 py-2 bg-white/5 flex items-center gap-2 text-xs">
        <ShoppingBag size={14} className="text-accent" />
        <span className="font-bold">{confirmed} / {local.length}</span>
        <span className="text-matcha-300">Items bestätigt</span>
        <div className="flex-1 h-1.5 bg-white/10 rounded-full ml-2 overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(confirmed / local.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {local.map((item, idx) => {
          const done = !!item.pick_confirmed_at;
          const missing = !!item.pick_missing;
          const isCurrent = !done && item.id === firstUnconfirmed?.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border-2 p-4 transition ${
                done
                  ? missing ? 'border-red-500/40 bg-red-500/10' : 'border-accent bg-accent/5'
                  : isCurrent ? 'border-accent bg-accent/10 shadow-lg shadow-accent/20' : 'border-white/10 bg-white/5 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl grid place-items-center font-display font-black shrink-0 ${
                  done
                    ? missing ? 'bg-red-500 text-white' : 'bg-accent text-matcha-900'
                    : 'bg-white/10 text-matcha-200'
                }`}>
                  {done ? (missing ? <AlertCircle size={18} /> : <Check size={18} />) : (idx + 1)}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-lg leading-tight">
                    {item.menge}× {item.name}
                  </div>
                  {item.notiz && (
                    <div className="mt-1 text-xs text-matcha-300 italic">→ {item.notiz}</div>
                  )}
                </div>
              </div>

              {isCurrent && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => confirm(item.id, false)}
                    disabled={pending === item.id}
                    className="flex-1 h-12 rounded-xl bg-accent text-matcha-900 font-display font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {pending === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Ist dabei
                  </button>
                  <button
                    onClick={() => confirm(item.id, true)}
                    disabled={pending === item.id}
                    className="h-12 px-4 rounded-xl bg-red-500/20 text-red-200 border-2 border-red-500/40 font-bold inline-flex items-center justify-center gap-2"
                  >
                    <X size={16} />
                    Fehlt
                  </button>
                </div>
              )}

              {done && missing && (
                <div className="mt-2 text-xs text-red-200 font-semibold inline-flex items-center gap-1">
                  <AlertCircle size={12} /> Küche wurde informiert
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="p-4 border-t border-white/10">
        <button
          onClick={complete}
          disabled={!allDone || pending === 'complete'}
          className="w-full h-14 rounded-2xl bg-accent text-matcha-900 font-display font-black text-lg inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          {pending === 'complete' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {allDone ? 'Alles dabei — losfahren' : `Noch ${local.length - confirmed} prüfen`}
        </button>
      </footer>
    </div>
  );
}
