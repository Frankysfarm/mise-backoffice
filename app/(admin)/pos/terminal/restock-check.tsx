'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Check, Infinity as InfinityIcon, Loader2, Package, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type PendingItem = {
  id: string;
  name: string;
  bild_url: string | null;
  preis: number;
  category_name: string | null;
  war_ausverkauft: boolean;
};

type Answer = { verfuegbar: boolean; bestand_menge: number | null };

export function RestockCheck({
  locationId, onDone,
}: {
  locationId: string;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('items_pending_restock', { p_location_id: locationId });
      const list = (data as any[] ?? []);
      setItems(list);
      // Default: alle „wieder verfügbar, unbegrenzt"
      const init: Record<string, Answer> = {};
      list.forEach((it) => { init[it.id] = { verfuegbar: true, bestand_menge: null }; });
      setAnswers(init);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...prev[id], verfuegbar: !prev[id].verfuegbar },
    }));
  }

  function setMenge(id: string, menge: number | null) {
    setAnswers((prev) => ({
      ...prev,
      [id]: { ...prev[id], bestand_menge: menge, verfuegbar: true },
    }));
  }

  async function submit() {
    setPending(true);
    const updates = Object.entries(answers).map(([item_id, a]) => ({
      item_id,
      verfuegbar: a.verfuegbar,
      bestand_menge: a.bestand_menge,
    }));
    await supabase.rpc('shift_start_restock', { p_updates: updates });
    onDone();
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-[56] bg-white grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Wenn keine Items → direkt weiter
  if (items.length === 0) {
    onDone();
    return null;
  }

  const verfuegbarCount = Object.values(answers).filter((a) => a.verfuegbar).length;

  return (
    <div className="fixed inset-0 z-[56] bg-white flex flex-col">
      <header className="px-5 py-4 border-b bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Schicht-Start · Bestands-Check</div>
          <h1 className="font-display text-2xl font-black">Welche Produkte sind heute wieder da?</h1>
          <p className="text-sm text-gray-600 mt-1">
            {items.length} Produkt(e) waren gestern ausverkauft. Tipp an = wieder verfügbar.
            Optional: Stückzahl eingeben (zählt runter bei Bestellung, geht wieder auf „aus" bei 0).
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-3">
          {items.map((it) => {
            const a = answers[it.id] ?? { verfuegbar: true, bestand_menge: null };
            return (
              <div
                key={it.id}
                className={cn(
                  'rounded-2xl border-2 p-4 transition',
                  a.verfuegbar ? 'bg-matcha-50 border-matcha-500' : 'bg-gray-50 border-gray-200 opacity-70',
                )}
              >
                <div className="flex items-start gap-4">
                  {it.bild_url ? (
                    <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      <Image src={it.bild_url} fill alt={it.name} className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-100 grid place-items-center text-3xl shrink-0">🍽</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold">{it.name}</div>
                    <div className="text-xs text-gray-500">
                      {it.category_name ?? '—'} · {euro(Number(it.preis))}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(it.id)}
                    className={cn(
                      'h-12 px-5 rounded-xl font-display font-bold transition',
                      a.verfuegbar
                        ? 'bg-matcha-700 text-white'
                        : 'bg-white border-2 border-gray-300 text-gray-600',
                    )}
                  >
                    {a.verfuegbar ? '✓ Verfügbar' : 'Noch nicht'}
                  </button>
                </div>

                {a.verfuegbar && (
                  <div className="mt-3 pt-3 border-t border-matcha-200 flex items-center gap-2 flex-wrap">
                    <div className="text-xs text-gray-500 w-full mb-1">Stückzahl heute (optional):</div>
                    <button
                      onClick={() => setMenge(it.id, null)}
                      className={cn(
                        'h-9 px-3 rounded-lg border-2 text-xs font-bold inline-flex items-center gap-1',
                        a.bestand_menge === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white',
                      )}
                    >
                      <InfinityIcon className="h-3 w-3" /> Unbegrenzt
                    </button>
                    {[5, 10, 20, 50].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMenge(it.id, n)}
                        className={cn(
                          'h-9 w-12 rounded-lg border-2 text-sm font-bold',
                          a.bestand_menge === n ? 'bg-matcha-700 text-white border-matcha-700' : 'bg-white',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={0}
                      value={a.bestand_menge !== null && ![5, 10, 20, 50].includes(a.bestand_menge) ? a.bestand_menge : ''}
                      onChange={(e) => setMenge(it.id, e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="frei"
                      className="h-9 w-16 rounded-lg border-2 bg-white text-center font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="border-t bg-white p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-sm">
            <strong>{verfuegbarCount}</strong> von {items.length} werden aktiviert
          </div>
          <button
            onClick={onDone}
            className="h-11 px-4 rounded-xl border-2 bg-white hover:bg-gray-50 text-sm font-bold"
          >
            Überspringen
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-gray-900 text-white font-display font-bold inline-flex items-center gap-2 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Bestätigen & los
          </button>
        </div>
      </footer>
    </div>
  );
}
