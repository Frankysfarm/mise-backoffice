'use client';
export function Soon({ children, style, title = 'Bald verfügbar' }: { children: React.ReactNode; style?: any; title?: string }) {
  return <button onClick={() => alert('Bald verfügbar — diese Funktion kommt in Kürze.')} title={title} style={style}>{children}</button>;
}
