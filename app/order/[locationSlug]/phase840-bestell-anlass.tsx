'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const ANLAESSE = [
  { emoji: '🎂', label: 'Geburtstag' },
  { emoji: '🏢', label: 'Büro' },
  { emoji: '👨‍👩‍👧', label: 'Familie' },
  { emoji: '🍕', label: 'Freunde' },
  { emoji: '🎉', label: 'Feier' },
  { emoji: '❤️', label: 'Date Night' },
  { emoji: '📦', label: 'Selbst' },
];

interface Props {
  value: string;
  onChange: (anlass: string) => void;
}

export function Phase840BestAnlass({ value, onChange }: Props) {
  const [selected, setSelected] = useState<string>('');

  const pick = (label: string, emoji: string) => {
    const next = selected === label ? '' : label;
    setSelected(next);
    onChange(next ? `Anlass: ${emoji} ${next}` : '');
  };

  const clear = () => {
    setSelected('');
    onChange('');
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-500">Bestellanlass (optional)</span>
        {selected && (
          <button onClick={clear} className="flex items-center gap-0.5 text-[10px] text-stone-400 hover:text-stone-600">
            <X className="h-3 w-3" /> Zurücksetzen
          </button>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {ANLAESSE.map(({ emoji, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => pick(label, emoji)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected === label
                ? 'border-matcha-500 bg-matcha-500 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
            }`}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {value && (
        <div className="mt-2 text-[10px] text-stone-400">
          Wird als Bestellnotiz gespeichert: &quot;{value}&quot;
        </div>
      )}
    </div>
  );
}
