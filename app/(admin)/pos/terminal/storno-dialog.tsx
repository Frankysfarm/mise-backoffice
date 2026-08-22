'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, Check, Loader2, Minus, Plus, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

const STORNO_GRUENDE = [
  'Fehlbuchung',
  'Warenrückgabe',
  'Reklamation',
  'Falscher Artikel',
  'Kunde verlangt Stornierung',
  'Technischer Fehler',
];

const MANAGER_PIN_SCHWELLWERT = 20;

type OrderItem = {
  id: string;
  name: string;
  menge: number;
  einzelpreis: number;
  gesamtpreis: number;
  mwst_satz: number | null;
  notiz: string | null;
  storno_ref_id: string | null;
};

export function StornoDialog({
  transaction, onClose, onDone,
}: {
  transaction: { id: string; brutto_gesamt: number; customer_order_id?: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [selected, setSelected] = useState<Record<string, number>>({}); // item_id → Menge zu stornieren
  const [grund, setGrund] = useState('');
  const [freitext, setFreitext] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!transaction.customer_order_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from('order_items')
        .select('id, name, menge, einzelpreis, gesamtpreis, mwst_satz, notiz, storno_ref_id')
        .eq('order_id', transaction.customer_order_id);
      // nur nicht-stornierte Original-Items (keine negativen, keine storno_ref)
      const originals = (data as any[] ?? []).filter((i) => Number(i.menge) > 0 && !i.storno_ref_id);
      // welche wurden schon storniert?
      const alreadyStorned = new Set((data as any[] ?? []).filter((i) => i.storno_ref_id).map((i) => i.storno_ref_id));
      setItems(originals.filter((i) => !alreadyStorned.has(i.id)));
      setLoading(false);
    })();
  }, [transaction.customer_order_id]); // eslint-disable-line

  function toggleItem(id: string, menge: number) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = menge;
      return next;
    });
  }

  function updateMenge(id: string, delta: number, max: number) {
    setSelected((prev) => {
      const current = prev[id] ?? 0;
      const neu = Math.max(0, Math.min(max, current + delta));
      const next = { ...prev };
      if (neu === 0) delete next[id];
      else next[id] = neu;
      return next;
    });
  }

  const partialTotal = items.reduce((s, it) => {
    const menge = selected[it.id] ?? 0;
    return s + menge * Number(it.einzelpreis);
  }, 0);

  const amountToStorno = mode === 'full' ? Number(transaction.brutto_gesamt) : partialTotal;
  const needsManager = amountToStorno > MANAGER_PIN_SCHWELLWERT;

  async function submit() {
    const fullGrund = [grund, freitext.trim()].filter(Boolean).join(' — ');
    if (fullGrund.length < 3) {
      setErr('Grund ist Pflicht');
      return;
    }

    if (mode === 'partial' && Object.keys(selected).length === 0) {
      setErr('Mindestens 1 Position auswählen');
      return;
    }

    setSubmitting(true);
    setErr(null);
    try {
      let managerId: string | null = null;
      if (needsManager) {
        // Server-seitige Prüfung via RPC — PIN verlässt Client nicht im Klartext (sha256 + salt)
        const { data: verify } = await supabase.rpc('verify_manager_pin', { p_pin: managerPin });
        if (!(verify as any)?.ok) {
          setErr('Manager-PIN ungültig');
          setSubmitting(false);
          return;
        }
        managerId = (verify as any).manager_employee_id;
      }

      if (mode === 'full') {
        const { data } = await supabase.rpc('storno_transaction', {
          p_transaction_id: transaction.id,
          p_grund: fullGrund,
          p_manager_employee_id: managerId,
        });
        if ((data as any)?.ok) onDone();
        else setErr((data as any)?.error ?? 'Fehler');
      } else {
        // Teil-Storno
        const itemsData = Object.entries(selected).map(([orderItemId, menge]) => ({
          order_item_id: orderItemId,
          menge_storno: menge,
        }));
        const { data } = await supabase.rpc('storno_transaction_items', {
          p_transaction_id: transaction.id,
          p_items_data: itemsData,
          p_grund: fullGrund,
          p_manager_employee_id: managerId,
        });
        if ((data as any)?.ok) onDone();
        else setErr((data as any)?.error ?? 'Fehler');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canStornoPartial = transaction.customer_order_id && items.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <header className="p-5 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-600 text-white grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">Storno</div>
            <h2 className="font-display text-xl font-black">
              {mode === 'full' ? `${euro(Number(transaction.brutto_gesamt))} stornieren` : `${euro(partialTotal)} ausgewählt`}
            </h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-gray-100 grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Mode-Toggle */}
        {canStornoPartial && (
          <div className="px-5 py-3 border-b bg-gray-50">
            <div className="flex gap-1 bg-white rounded-xl p-1 border">
              <button
                onClick={() => setMode('full')}
                className={cn(
                  'flex-1 h-10 rounded-lg text-sm font-bold transition',
                  mode === 'full' ? 'bg-red-600 text-white' : 'hover:bg-gray-100',
                )}
              >
                Komplett stornieren
              </button>
              <button
                onClick={() => setMode('partial')}
                className={cn(
                  'flex-1 h-10 rounded-lg text-sm font-bold transition',
                  mode === 'partial' ? 'bg-red-600 text-white' : 'hover:bg-gray-100',
                )}
              >
                Einzelne Positionen
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Positions-Auswahl */}
          {mode === 'partial' && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Welche Positionen stornieren?
              </div>
              {loading ? (
                <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></div>
              ) : items.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  Keine nicht-stornierten Positionen gefunden.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((it) => {
                    const sel = selected[it.id] ?? 0;
                    const isSelected = sel > 0;
                    return (
                      <div
                        key={it.id}
                        className={cn(
                          'rounded-xl border-2 p-3 transition',
                          isSelected ? 'bg-red-50 border-red-400' : 'bg-white border-gray-200',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(it.id, it.menge)}
                            className="h-5 w-5 accent-red-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{it.name}</div>
                            <div className="text-xs text-gray-500">
                              {it.menge}× à {euro(Number(it.einzelpreis))} = {euro(Number(it.gesamtpreis))}
                            </div>
                            {it.notiz && <div className="text-[10px] italic text-orange-700">„{it.notiz}"</div>}
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1 bg-white rounded-full p-0.5 border">
                              <button
                                onClick={() => updateMenge(it.id, -1, it.menge)}
                                className="h-7 w-7 rounded-full hover:bg-gray-100 grid place-items-center"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="font-bold w-6 text-center text-sm">{sel}</span>
                              <button
                                onClick={() => updateMenge(it.id, +1, it.menge)}
                                disabled={sel >= it.menge}
                                className="h-7 w-7 rounded-full bg-red-600 text-white grid place-items-center disabled:opacity-40"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t flex justify-between text-xs font-bold text-red-700">
                            <span>Storno-Betrag</span>
                            <span>-{euro(sel * Number(it.einzelpreis))}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Grund */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Grund *</label>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {STORNO_GRUENDE.map((g) => (
                <button
                  key={g}
                  onClick={() => setGrund(g)}
                  className={cn(
                    'rounded-lg border-2 p-2 text-xs font-semibold text-left transition',
                    grund === g ? 'bg-red-600 text-white border-red-600' : 'bg-white hover:bg-gray-50',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Details (optional)</label>
            <textarea
              value={freitext}
              onChange={(e) => setFreitext(e.target.value)}
              rows={2}
              placeholder="Freitext …"
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          {needsManager && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                Manager-Freigabe nötig (&gt; {MANAGER_PIN_SCHWELLWERT} € · du hast {euro(amountToStorno)})
              </div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full h-12 rounded-xl border-2 bg-white text-center font-display text-2xl font-black tracking-[0.5em]"
              />
            </div>
          )}

          {err && <div className="text-xs text-red-700 bg-red-50 rounded-lg p-2">{err}</div>}
        </div>

        <footer className="p-5 border-t bg-gray-50">
          <button
            onClick={submit}
            disabled={
              submitting || !grund ||
              (mode === 'partial' && Object.keys(selected).length === 0) ||
              (needsManager && managerPin.length < 4)
            }
            className="w-full h-12 rounded-xl bg-red-600 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 hover:bg-red-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {mode === 'full' ? `Beleg stornieren (${euro(Number(transaction.brutto_gesamt))})` : `${Object.keys(selected).length} Position(en) stornieren (${euro(partialTotal)})`}
          </button>

          <div className="mt-2 text-[10px] text-gray-500 text-center leading-relaxed">
            Stornos werden als TSE-signierte Gegenbuchung angelegt. Original-Beleg bleibt unveränderbar (GoBD).
          </div>
        </footer>
      </div>
    </div>
  );
}
