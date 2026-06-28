'use client';

import { useState } from 'react';
import { LoyaltyItemDisplay } from '@/lib/loyalty/types';

export function LoyaltyPickerModal({
  open,
  items,
  programId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  items: LoyaltyItemDisplay[];
  programId: string;
  onConfirm: (itemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  async function handleConfirm() {
    if (!selectedItemId) {
      alert('Bitte wählen Sie ein Produkt');
      return;
    }

    const res = await fetch('/api/loyalty/redeem', {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId,
        selected_menu_item_ids: [selectedItemId],
      }),
    });

    if (res.ok) {
      onConfirm([selectedItemId]);
    } else {
      alert('Fehler beim Speichern der Bonusauswahl');
    }
  }

  if (!open) return null;

  return (
    <div className=fixed inset-0 bg-black/50 flex items-center justify-center z-50>
      <div className=bg-white rounded-lg p-6 max-w-md w-full>
        <h2 className=text-xl font-bold mb-4>Bonusprodukt wählen</h2>

        <div className=space-y-3 mb-6>
          {items.map(item => (
            <label key={item.menu_item_id} className=flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50>
              <input
                type=radio
                name=bonus
                value={item.menu_item_id}
                checked={selectedItemId === item.menu_item_id}
                onChange={e => setSelectedItemId(e.target.value)}
                className=mr-3
              />
              <div className=flex-1>
                <p className=font-medium>{item.name}</p>
                <p className=text-sm text-gray-600>{item.beschreibung}</p>
                <p className=text-sm font-semibold text-green-600>GRATIS</p>
              </div>
            </label>
          ))}
        </div>

        <div className=flex gap-3>
          <button
            onClick={onCancel}
            className=flex-1 px-4 py-2 border rounded hover:bg-gray-50
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            className=flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700
          >
            Bonusprodukt hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
