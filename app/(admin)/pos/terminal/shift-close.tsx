'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Banknote, Check, CreditCard, Loader2, LogOut, Smartphone, X } from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { CashCounter } from './cash-counter';

type ShiftSummary = {
  summe_bar: number;
  summe_karte: number;
  summe_online: number;
  summe_gesamt: number;
  anzahl_transaktionen: number;
};

export function ShiftCloseDialog({
  shiftId, startWechselgeld, onClose, onClosed,
}: {
  shiftId: string;
  startWechselgeld: number;
  onClose: () => void;
  onClosed: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [kassenbestand, setKassenbestand] = useState('');
  const [notiz, setNotiz] = useState('');
  const [closing, setClosing] = useState(false);
  const [diff, setDiff] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('pos_transactions')
        .select('typ, brutto_gesamt, zahlungsart')
        .eq('shift_id', shiftId);
      const rows = (data as any[]) ?? [];
      const bar = rows.filter((r) => r.zahlungsart === 'bar').reduce((s, r) => s + Number(r.brutto_gesamt), 0);
      const karte = rows.filter((r) => r.zahlungsart === 'karte').reduce((s, r) => s + Number(r.brutto_gesamt), 0);
      const online = rows.filter((r) => r.zahlungsart === 'online').reduce((s, r) => s + Number(r.brutto_gesamt), 0);
      setSummary({
        summe_bar: bar,
        summe_karte: karte,
        summe_online: online,
        summe_gesamt: bar + karte + online,
        anzahl_transaktionen: rows.filter((r) => r.typ === 'verkauf').length,
      });
      setKassenbestand(String((startWechselgeld + bar).toFixed(2)));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const expected = summary ? startWechselgeld + summary.summe_bar : 0;
  const current = parseFloat(kassenbestand.replace(',', '.')) || 0;
  const liveDiff = current - expected;

  async function closeShift() {
    setClosing(true);
    try {
      const { data } = await supabase.rpc('close_shift', {
        p_shift_id: shiftId,
        p_end_kassenbestand: current,
        p_notiz: notiz || null,
      });
      if ((data as any)?.ok) {
        setDiff((data as any).differenz);
        setTimeout(onClosed, 1500);
      }
    } finally {
      setClosing(false);
    }
  }

  if (loading || !summary) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  if (diff !== null) {
    return (
      <div className="fixed inset-0 z-50 bg-white grid place-items-center p-6">
        <div className="max-w-md text-center">
          <div className={`mx-auto h-20 w-20 rounded-full grid place-items-center mb-4 ${
            Math.abs(diff) < 0.01 ? 'bg-matcha-600' : Math.abs(diff) < 5 ? 'bg-amber-500' : 'bg-red-600'
          } text-white`}>
            <Check className="h-10 w-10" />
          </div>
          <h1 className="font-display text-3xl font-black mb-2">Schicht abgeschlossen</h1>
          <p className="text-gray-600 mb-6">
            {Math.abs(diff) < 0.01
              ? 'Kasse stimmt exakt. 💪'
              : diff > 0
                ? `+${euro(diff)} mehr in der Kasse als erwartet`
                : `${euro(diff)} weniger in der Kasse als erwartet`}
          </p>
          <div className="text-sm text-gray-500">Z-Bericht wurde archiviert (10 Jahre GoBD)</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <header className="p-5 border-b flex items-center gap-3 bg-white sticky top-0">
          <div className="h-10 w-10 rounded-xl bg-gray-900 text-white grid place-items-center">
            <LogOut className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Schicht beenden</div>
            <h2 className="font-display text-xl font-black">Z-Bericht</h2>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full hover:bg-gray-100 grid place-items-center">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* Summen */}
          <div className="rounded-2xl bg-gray-50 p-4 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Umsätze deiner Schicht</div>
            <RowIcon icon={<Banknote className="h-4 w-4" />} label="Bar" value={summary.summe_bar} />
            <RowIcon icon={<CreditCard className="h-4 w-4" />} label="Karte" value={summary.summe_karte} />
            <RowIcon icon={<Smartphone className="h-4 w-4" />} label="Online (Apple/Google Pay)" value={summary.summe_online} />
            <div className="pt-2 border-t flex justify-between font-display font-black">
              <span>Gesamt</span>
              <span>{euro(summary.summe_gesamt)}</span>
            </div>
            <div className="text-xs text-gray-500 text-right">{summary.anzahl_transaktionen} Transaktionen</div>
          </div>

          {/* Kassenbestand */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Ist-Kassenbestand</label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Start: <strong>{euro(startWechselgeld)}</strong> Wechselgeld + <strong>{euro(summary.summe_bar)}</strong> Bar-Umsatz = Erwartet <strong>{euro(expected)}</strong>
            </p>

            {/* Stückel-Zähler */}
            <CashCounter onChange={(total) => setKassenbestand(total.toFixed(2))} />

            {/* Manuell korrigieren */}
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-3 block">Ist-Summe (korrigierbar)</label>
            <input
              value={kassenbestand}
              onChange={(e) => setKassenbestand(e.target.value)}
              type="text"
              inputMode="decimal"
              className="mt-1 w-full h-14 rounded-2xl border-2 bg-white px-4 font-display text-2xl font-black text-center focus:outline-none focus:border-gray-900"
            />
            <div className={cn(
              'mt-2 text-sm text-center font-bold',
              Math.abs(liveDiff) < 0.01 ? 'text-matcha-700'
                : Math.abs(liveDiff) < 5 ? 'text-amber-700'
                : 'text-red-700',
            )}>
              Differenz: {liveDiff >= 0 ? '+' : ''}{euro(liveDiff)}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Notiz (optional)</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={2}
              placeholder="z.B. Warum hast du Differenz?"
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={closeShift}
            disabled={closing || !kassenbestand}
            className="w-full h-14 rounded-2xl bg-gray-900 text-white font-display font-black text-base disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {closing ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            Schicht schließen + Z-Bericht erstellen
          </button>
        </div>
      </div>
    </div>
  );
}

function RowIcon({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-gray-600">{icon} {label}</div>
      <div className="font-bold">{euro(value)}</div>
    </div>
  );
}
