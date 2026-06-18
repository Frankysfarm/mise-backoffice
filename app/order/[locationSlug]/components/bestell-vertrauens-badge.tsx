'use client';

import * as React from 'react';

// Mock — API-Anbindung folgt
interface Props {
  locationSlug: string;
}

export function BestellVertrauensBadge({ locationSlug: _locationSlug }: Props) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex flex-wrap gap-2 px-4 py-2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Pünktlichkeit */}
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="7" />
          <path d="M5 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        98% pünktlich
      </span>

      {/* Lieferzeit */}
      <span className="inline-flex items-center gap-1 text-xs font-medium text-matcha-700 bg-matcha-50 border border-matcha-200 rounded-full px-3 py-1">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="7" />
          <path d="M8 4v4l2.5 2.5" strokeLinecap="round" />
        </svg>
        Ø 28 Min Lieferzeit
      </span>

      {/* Bewertung */}
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l1.85 3.75L14 5.5l-3 2.92.71 4.12L8 10.5l-3.71 1.96L5 8.42 2 5.5l4.15-.75L8 1z" />
        </svg>
        4.8★ Bewertung
      </span>
    </div>
  );
}
