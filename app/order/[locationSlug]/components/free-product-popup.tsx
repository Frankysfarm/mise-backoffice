'use client';

import * as React from 'react';
import { Gift, X, Check } from 'lucide-react';

type MenuItem = { id: string; name: string; preis: number };
type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
  eligibleItems: MenuItem[];
  alreadySelected: MenuItem | null;
};

export function FreeProductPopup({ open, onClose, onSelect, eligibleItems, alreadySelected }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-yellow-500 text-white p-5">
          <Gift size={24} className="mb-2" />
          <div className="font-bold text-lg">Dein Gratis-Produkt!</div>
          <p className="text-sm opacity-90 mt-1">Wähle kostenlos ein Produkt</p>
          <button onClick={onClose} className="absolute top-4 right-4">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-2">
          {eligibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onSelect(item); onClose(); }}
              className={`rounded-lg border p-3 text-left text-sm ${
                alreadySelected?.id === item.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="font-semibold">{item.name}</div>
              <div className="text-xs text-gray-500 line-through mt-1">€{item.preis.toFixed(2)}</div>
              <div className="text-xs font-bold text-green-600 bg-green-100 px-1 py-0.5 rounded mt-1 inline-block">Gratis</div>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4">
          <button onClick={onClose} className="w-full py-2 border rounded text-sm text-gray-600">Keine Wahl</button>
        </div>
      </div>
    </div>
  );
}
