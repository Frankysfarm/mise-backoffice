'use client';

import { Gift, ChevronRight } from 'lucide-react';

type MenuItem = { id: string; name: string; preis: number };
type Props = {
  eligibleItems: MenuItem[];
  selectedItemId: string | null;
  onSelect: (item: MenuItem) => void;
  triggerAbBetrag?: number;
  currentSubtotal: number;
};

export function FreeProductBanner({ eligibleItems, selectedItemId, onSelect, triggerAbBetrag, currentSubtotal }: Props) {
  if (eligibleItems.length === 0) return null;

  const remaining = triggerAbBetrag ? Math.max(0, triggerAbBetrag - currentSubtotal) : 0;
  const unlocked = !triggerAbBetrag || currentSubtotal >= triggerAbBetrag;

  return (
    <div className={`rounded-lg border-2 p-4 mb-4 ${unlocked ? 'border-yellow-500 bg-yellow-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Gift size={16} className={unlocked ? 'text-yellow-600' : 'text-gray-500'} />
        <span className="font-bold text-sm">
          {unlocked ? '🎁 Wähle dein Gratis-Produkt!' : `Noch €${remaining.toFixed(2)}`}
        </span>
      </div>
      {unlocked && (
        <div className="grid grid-cols-2 gap-2">
          {eligibleItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`rounded border p-2 text-left text-sm ${
                selectedItemId === item.id ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}
            >
              <div className="font-semibold text-xs">{item.name}</div>
              <div className="text-xs text-gray-500 line-through">€{item.preis.toFixed(2)}</div>
              <div className="text-xs font-bold text-green-700">Gratis</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
