'use client';

import { useState } from 'react';

interface Props {
  orderId: string;
  bestellnummer: string;
  zahlungsart: string; // 'bar' | 'karte' | 'online'
  gesamtbetrag: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export function LieferungCheckliste({
  orderId: _orderId,
  bestellnummer,
  zahlungsart,
  gesamtbetrag,
  onConfirm,
  onDismiss,
}: Props) {
  const betragFormatiert = `${gesamtbetrag.toFixed(2).replace('.', ',')} €`;

  const cashLabel =
    zahlungsart === 'bar'
      ? `Wechselgeld bereit (Betrag: ${betragFormatiert})`
      : 'Zahlung online/Karte — keine Baraktion nötig';

  const initialItems: ChecklistItem[] = [
    { id: 'artikel', label: 'Alle Artikel vollständig', checked: false },
    { id: 'adresse', label: 'Richtige Adresse bestätigt', checked: false },
    { id: 'zahlung', label: cashLabel, checked: false },
    { id: 'hinweis', label: 'Kundenhinweis gelesen', checked: false },
  ];

  const [items, setItems] = useState<ChecklistItem[]>(initialItems);

  const allChecked = items.every((item) => item.checked);

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }

  function handleConfirm() {
    if (allChecked) {
      onConfirm();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900/95 border border-gray-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <p className="text-xs font-medium text-matcha-400 uppercase tracking-widest">
              Vor der Ankunft
            </p>
            <h2 className="text-lg font-semibold text-white leading-tight">
              Lieferung #{bestellnummer}
            </h2>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Schließen"
            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Checklist */}
        <ul className="px-5 py-4 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-3 cursor-pointer group">
                <span className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleItem(item.id)}
                    className="sr-only"
                  />
                  <span
                    className={`
                      flex items-center justify-center w-6 h-6 rounded-md border-2 transition-colors
                      ${
                        item.checked
                          ? 'bg-matcha-600 border-matcha-600'
                          : 'bg-transparent border-gray-600 group-hover:border-gray-400'
                      }
                    `}
                  >
                    {item.checked && (
                      <svg
                        className="w-3.5 h-3.5 text-white"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                </span>
                <span
                  className={`text-sm leading-snug transition-colors ${
                    item.checked ? 'text-gray-400 line-through' : 'text-white'
                  }`}
                >
                  {item.label}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {/* Progress indicator */}
        <div className="px-5 pb-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-matcha-600 transition-all duration-300"
                style={{
                  width: `${(items.filter((i) => i.checked).length / items.length) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">
              {items.filter((i) => i.checked).length}/{items.length}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-800 mt-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allChecked}
            className={`
              flex-1 py-3 rounded-xl text-sm font-semibold transition-colors
              ${
                allChecked
                  ? 'bg-matcha-600 text-white hover:bg-matcha-700 active:bg-matcha-800'
                  : 'bg-matcha-900/50 text-matcha-700 cursor-not-allowed'
              }
            `}
          >
            Angekommen bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}
