'use client';

import * as React from 'react';

interface MenuItem {
  id: string;
  name: string;
  allergene?: string[] | null;
  beschreibung?: string | null;
}

interface Props {
  item: MenuItem | null;
  onClose: () => void;
}

const ALLERGEN_ICONS: Record<string, string> = {
  gluten:      '🌾',
  weizen:      '🌾',
  laktose:     '🥛',
  milch:       '🥛',
  eier:        '🥚',
  ei:          '🥚',
  nüsse:       '🥜',
  nuss:        '🥜',
  erdnuss:     '🥜',
  soja:        '🫘',
  fisch:       '🐟',
  schalentiere:'🦐',
  krebstiere:  '🦞',
  sellerie:    '🥬',
  senf:        '🟡',
  sesam:       '🌱',
  lupinen:     '🌿',
  weichtiere:  '🐚',
  sulfite:     '🍷',
  schwefeldioxid: '🍷',
};

function getAllergenIcon(allergen: string): string {
  const key = allergen.toLowerCase();
  for (const [k, v] of Object.entries(ALLERGEN_ICONS)) {
    if (key.includes(k)) return v;
  }
  return '⚠️';
}

export function Phase1640AllergenHinweisModal({ item, onClose }: Props) {
  // Hydration-safe: nur client-seitig rendern
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  if (!mounted || !item) return null;

  const allergene = item.allergene ?? [];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-200">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">Allergene & Zusatzstoffe</p>
            <p className="text-[11px] text-amber-700 truncate">{item.name}</p>
          </div>
          <button
            className="rounded-full w-7 h-7 flex items-center justify-center bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
            onClick={onClose}
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {allergene.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium text-stone-700">Keine bekannten Allergene</p>
              <p className="text-xs text-muted-foreground mt-1">
                Bitte informiere uns bei Unverträglichkeiten.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Dieses Produkt enthält folgende Allergene:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allergene.map((allergen) => (
                  <div
                    key={allergen}
                    className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="text-lg flex-shrink-0">{getAllergenIcon(allergen)}</span>
                    <span className="text-xs font-medium text-amber-900 capitalize leading-tight">
                      {allergen}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground/70 mt-4 text-center">
            Bei Fragen zu Allergenen wende dich bitte an unser Team.
          </p>
        </div>
      </div>
    </div>
  );
}
