'use client';
// `Soon` with optional `href`: when href is set it renders a real link to an
// existing (working) backoffice screen instead of the "Bald verfügbar" alert.
export function Soon({ children, style, title = 'Bald verfügbar', href }: { children: React.ReactNode; style?: any; title?: string; href?: string }) {
  if (href) {
    return (
      <a href={href} style={{ ...style, textDecoration: 'none', display: style?.display ?? 'inline-flex', alignItems: style?.alignItems ?? 'center' }}>
        {children}
      </a>
    );
  }
  return <button onClick={() => alert('Bald verfügbar — diese Funktion kommt in Kürze.')} title={title} style={style}>{children}</button>;
}
