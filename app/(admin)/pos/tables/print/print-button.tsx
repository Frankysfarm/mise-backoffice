'use client';

export function PrintButton({ color }: { color: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: color,
        color: 'white',
        padding: '.75rem 1.5rem',
        borderRadius: 999,
        fontWeight: 700,
        border: 'none',
        cursor: 'pointer',
        fontSize: '1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
      }}
    >
      Alle drucken
    </button>
  );
}
