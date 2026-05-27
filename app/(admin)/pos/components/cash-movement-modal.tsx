'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ArrowDown, ArrowUp, Coins, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Movement = 'einlage' | 'entnahme' | 'trinkgeld';

const LABELS: Record<Movement, { title: string; desc: string; icon: React.ElementType; color: string }> = {
  einlage: { title: 'Einlage', desc: 'Wechselgeld aus dem Safe in die Kasse', icon: ArrowDown, color: 'text-emerald-400' },
  entnahme: { title: 'Entnahme', desc: 'Bargeld aus der Kasse entnehmen', icon: ArrowUp, color: 'text-amber-400' },
  trinkgeld: { title: 'Trinkgeld', desc: 'Trinkgeld in die Kasse buchen', icon: Coins, color: 'text-[#d4a843]' },
};

type Props = {
  open: boolean;
  registerId: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

export function CashMovementModal({ open, registerId, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [typ, setTyp] = useState<Movement>('einlage');
  const [betrag, setBetrag] = useState('');
  const [grund, setGrund] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function save() {
    if (!registerId) return;
    const n = parseFloat(betrag.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    setSaving(true);
    try {
      const signed = typ === 'entnahme' ? -Math.abs(n) : Math.abs(n);
      await supabase.from('pos_transactions').insert({
        register_id: registerId,
        typ,
        netto_gesamt: signed,
        brutto_gesamt: signed,
        zahlungsart: 'bar',
        bon_data: { grund: grund || null, movement: typ },
      } as any);
      setBetrag('');
      setGrund('');
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a3a2a] rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-xl font-display">Kassenbewegung</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {(Object.keys(LABELS) as Movement[]).map((k) => {
            const L = LABELS[k];
            const active = typ === k;
            const Icon = L.icon;
            return (
              <button
                key={k}
                onClick={() => setTyp(k)}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition',
                  active ? 'bg-[#4ae68a] text-[#0d1f16]' : 'bg-white/5 text-white/70 hover:bg-white/10',
                )}
              >
                <Icon size={18} className={active ? 'text-[#0d1f16]' : L.color} />
                {L.title}
              </button>
            );
          })}
        </div>

        <p className="text-white/50 text-xs mb-4">{LABELS[typ].desc}</p>

        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-xs mb-1 block">Betrag (€)</label>
            <input
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              className="w-full bg-white/10 text-white text-2xl font-bold rounded-xl px-4 py-3 text-center border-0 focus:ring-2 focus:ring-[#4ae68a] font-display"
              autoFocus
            />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1 block">Grund / Notiz (optional)</label>
            <input
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              placeholder={typ === 'einlage' ? 'z. B. Wechselgeld aus Safe' : typ === 'entnahme' ? 'z. B. Einkauf Großmarkt' : 'z. B. Tischschicht 2'}
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 border-0 focus:ring-2 focus:ring-[#4ae68a]"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !betrag}
            className="w-full bg-[#4ae68a] disabled:opacity-40 text-[#0d1f16] py-4 rounded-2xl font-bold text-lg mt-2 transition active:scale-[0.98]"
          >
            {saving ? 'Speichere …' : `${LABELS[typ].title} buchen`}
          </button>
        </div>
      </div>
    </div>
  );
}
