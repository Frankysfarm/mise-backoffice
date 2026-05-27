'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Banknote, CreditCard, Printer, RotateCcw, Smartphone, X } from 'lucide-react';

type Bon = {
  id: string;
  bon_nummer: string;
  typ: string;
  brutto_gesamt: number;
  zahlungsart: string;
  storniert: boolean;
  storno_von: string | null;
  created_at: string;
  kunde_name: string | null;
  bon_data: any;
};

type Props = {
  open: boolean;
  registerId: string | null;
  onClose: () => void;
};

export function ReceiptHistory({ open, registerId, onClose }: Props) {
  const supabase = createClient();
  const [bons, setBons] = useState<Bon[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Bon | null>(null);
  const [stornoing, setStornoing] = useState(false);

  useEffect(() => {
    if (!open || !registerId) return;
    void load();
    const ch = supabase
      .channel('pos_bons')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_transactions', filter: `register_id=eq.${registerId}` },
        () => void load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registerId]);

  async function load() {
    if (!registerId) return;
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('pos_transactions')
      .select('id,bon_nummer,typ,brutto_gesamt,zahlungsart,storniert,storno_von,created_at,kunde_name,bon_data')
      .eq('register_id', registerId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);
    setBons((data as any) ?? []);
    setLoading(false);
  }

  async function storno(bon: Bon) {
    if (!registerId) return;
    if (bon.typ !== 'verkauf' || bon.storniert) return;
    if (!confirm(`Bon ${bon.bon_nummer} wirklich stornieren?`)) return;
    setStornoing(true);
    try {
      await supabase.from('pos_transactions').insert({
        register_id: registerId,
        typ: 'storno',
        netto_gesamt: -Math.abs(bon.brutto_gesamt),
        brutto_gesamt: -Math.abs(bon.brutto_gesamt),
        zahlungsart: bon.zahlungsart,
        storno_von: bon.id,
        storno_grund: 'Storniert über POS-Historie',
        bon_data: { storno: true, original_bon: bon.bon_nummer },
      } as any);
      await supabase
        .from('pos_transactions')
        .update({ storniert: true })
        .eq('id', bon.id);
      setSelected(null);
      await load();
    } finally {
      setStornoing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="w-full max-w-md bg-[#0d1f16] border-l border-white/10 flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-white font-bold text-lg font-display">Heutige Bons</div>
            <div className="text-white/50 text-xs">{bons.length} Transaktionen</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white p-2" aria-label="Schließen">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && bons.length === 0 && (
            <div className="text-white/40 text-sm text-center py-10">Lade …</div>
          )}
          {!loading && bons.length === 0 && (
            <div className="text-white/40 text-sm text-center py-10">Noch keine Bons heute.</div>
          )}
          <div className="space-y-1.5">
            {bons.map((b) => <BonRow key={b.id} bon={b} onSelect={() => setSelected(b)} />)}
          </div>
        </div>
      </aside>

      {selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl font-mono text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="text-center border-b pb-3 mb-3">
              <div className="text-2xl">🍵</div>
              <div className="font-bold">Franky's Farm</div>
              <div className="text-xs text-gray-500">{new Date(selected.created_at).toLocaleString('de-DE')}</div>
            </div>
            <div className="font-bold text-center mb-3">Bon {selected.bon_nummer}</div>
            {selected.storniert && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg p-2 mb-3 text-center font-bold">
                STORNIERT
              </div>
            )}
            {selected.typ === 'storno' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2 mb-3 text-center">
                Storno-Bon für {selected.bon_data?.original_bon ?? '—'}
              </div>
            )}
            {selected.bon_data?.positionen && (
              <div className="border-t border-dashed pt-2 space-y-0.5">
                {selected.bon_data.positionen.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{p.menge}× {p.name}</span>
                    <span>{Number(p.gesamt).toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-double mt-2 pt-2 flex justify-between font-bold text-lg">
              <span>{selected.typ === 'storno' ? 'STORNO' : 'GESAMT'}</span>
              <span>{Number(selected.brutto_gesamt).toFixed(2)} €</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">Zahlungsart: {selected.zahlungsart.toUpperCase()}</div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gray-100 hover:bg-gray-200 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Drucken
              </button>
              {selected.typ === 'verkauf' && !selected.storniert && (
                <button
                  onClick={() => storno(selected)}
                  disabled={stornoing}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <RotateCcw size={16} /> Stornieren
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BonRow({ bon, onSelect }: { bon: Bon; onSelect: () => void }) {
  const time = new Date(bon.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const payIcon =
    bon.zahlungsart === 'bar' ? <Banknote size={14} /> :
    bon.zahlungsart === 'karte' ? <CreditCard size={14} /> :
    <Smartphone size={14} />;

  const isMovement = ['einlage', 'entnahme', 'trinkgeld'].includes(bon.typ);
  const isStorno = bon.typ === 'storno';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left',
        'hover:bg-white/5',
        bon.storniert && 'opacity-50 line-through',
      )}
    >
      <div className="text-white/40 font-mono text-xs w-14 shrink-0">{time}</div>
      <div className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
        isStorno ? 'bg-red-500/20 text-red-400' :
        isMovement ? 'bg-amber-500/20 text-amber-400' :
        'bg-white/10 text-white/70',
      )}>
        {payIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-xs font-mono">{bon.bon_nummer}</div>
        <div className="text-white/50 text-xs capitalize">
          {isMovement ? bon.typ : isStorno ? `Storno: ${bon.bon_data?.original_bon ?? ''}` : (bon.kunde_name ?? 'Verkauf')}
        </div>
      </div>
      <div className={cn(
        'font-bold text-sm',
        bon.brutto_gesamt < 0 ? 'text-red-400' : 'text-white',
      )}>
        {bon.brutto_gesamt < 0 ? '' : '+ '}{bon.brutto_gesamt.toFixed(2)} €
      </div>
    </button>
  );
}
