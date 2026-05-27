'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  AlertTriangle, Check, Clock, History, Loader2, Printer, Undo2, X,
} from 'lucide-react';
import { StornoDialog } from './storno-dialog';

type Tx = {
  id: string;
  bon_token: string;
  typ: string;
  brutto_gesamt: number;
  zahlungsart: string;
  created_at: string;
  storno_ref_id: string | null;
  storno_grund: string | null;
  trainingsbon: boolean;
  tse_signature: string | null;
  customer_order_id: string | null;
};

export function TransactionsHistory({
  tenantId, shiftId, onClose,
}: {
  tenantId: string;
  shiftId: string | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [storno, setStorno] = useState<Tx | null>(null);
  const [filter, setFilter] = useState<'all' | 'shift' | 'today'>('shift');

  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function load() {
    setLoading(true);
    let q = supabase.from('pos_transactions')
      .select('id, bon_token, typ, brutto_gesamt, zahlungsart, created_at, storno_ref_id, storno_grund, trainingsbon, tse_signature, customer_order_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter === 'shift' && shiftId) {
      q = q.eq('shift_id', shiftId);
    } else if (filter === 'today') {
      q = q.gte('created_at', new Date().toISOString().slice(0, 10));
    }
    const { data } = await q;
    setTxs((data as any[]) ?? []);
    setLoading(false);
  }

  // welche Original-Transaktionen sind schon storniert?
  const stornoRefIds = new Set(txs.filter((t) => t.storno_ref_id).map((t) => t.storno_ref_id));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <header className="p-5 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-900 text-white grid place-items-center">
            <History className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Transaktionen</div>
            <h2 className="font-display text-xl font-black">Belege stornieren / Bon erneut drucken</h2>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-gray-100 grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Filter */}
        <div className="px-5 py-3 border-b flex gap-2">
          {[
            { id: 'shift', label: 'Meine Schicht', disabled: !shiftId },
            { id: 'today', label: 'Heute' },
            { id: 'all', label: 'Alle (100)' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => !f.disabled && setFilter(f.id as any)}
              disabled={f.disabled}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-bold transition',
                filter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200',
                f.disabled && 'opacity-40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
          ) : txs.length === 0 ? (
            <div className="py-10 text-center text-gray-500">Keine Transaktionen im Zeitraum.</div>
          ) : (
            <div className="space-y-2">
              {txs.map((t) => {
                const isStorno = t.typ === 'storno' || Number(t.brutto_gesamt) < 0;
                const alreadyStorned = stornoRefIds.has(t.id);
                const canStorno = !isStorno && !alreadyStorned && !t.trainingsbon;

                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl p-3 border',
                      isStorno ? 'bg-red-50 border-red-200' :
                      alreadyStorned ? 'bg-gray-50 border-gray-200 opacity-60' :
                      t.trainingsbon ? 'bg-amber-50 border-amber-200' :
                      'bg-white border-gray-200',
                    )}
                  >
                    <div className={cn(
                      'h-10 w-10 rounded-xl grid place-items-center shrink-0',
                      isStorno ? 'bg-red-600 text-white' :
                      alreadyStorned ? 'bg-gray-400 text-white' :
                      t.trainingsbon ? 'bg-amber-500 text-white' :
                      'bg-matcha-100 text-matcha-800',
                    )}>
                      {isStorno ? <Undo2 className="h-5 w-5" /> :
                       t.trainingsbon ? '🎓' :
                       t.tse_signature ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">#{t.id.slice(0, 8)}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(t.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isStorno && <span className="text-[10px] font-bold uppercase text-red-700">STORNO</span>}
                        {alreadyStorned && <span className="text-[10px] font-bold uppercase text-gray-600">STORNIERT</span>}
                        {t.trainingsbon && <span className="text-[10px] font-bold uppercase text-amber-700">TRAINING</span>}
                      </div>
                      {t.storno_grund && (
                        <div className="text-xs italic text-red-700 mt-0.5">„{t.storno_grund}"</div>
                      )}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t.zahlungsart} · TSE-Sig: {t.tse_signature ? '✓' : '⚠ fehlt'}
                      </div>
                    </div>
                    <div className={cn('font-display font-black text-lg', isStorno ? 'text-red-700' : '')}>
                      {euro(Number(t.brutto_gesamt))}
                    </div>
                    <a
                      href={`/bon/${t.bon_token}`}
                      target="_blank"
                      className="h-9 w-9 rounded-lg border bg-white hover:bg-gray-50 grid place-items-center"
                      title="Bon öffnen"
                    >
                      <Printer className="h-4 w-4" />
                    </a>
                    {canStorno && (
                      <button
                        onClick={() => setStorno(t)}
                        className="h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-red-700"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Stornieren
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="p-4 border-t bg-gray-50 text-xs text-gray-500 flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Stornos werden TSE-signiert, der Originalbeleg bleibt unveränderbar (GoBD).
          Ab 20 € wird Manager-PIN verlangt.
        </footer>
      </div>

      {storno && (
        <StornoDialog
          transaction={{
            id: storno.id,
            brutto_gesamt: Number(storno.brutto_gesamt),
            customer_order_id: storno.customer_order_id,
          }}
          onClose={() => setStorno(null)}
          onDone={() => {
            setStorno(null);
            load();
          }}
        />
      )}
    </div>
  );
}
