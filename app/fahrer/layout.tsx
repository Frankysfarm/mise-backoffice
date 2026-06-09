import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mise Fahrer',
  description: 'Deine Fahrer-App für Mise',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mise Fahrer',
  },
  icons: {
    apple: [{ url: '/fahrer-icon-192.png' }],
    shortcut: '/fahrer-icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#F2F4F2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/* Drive-Design (Wald) — helle Farbwelt, Logik bleibt unveraendert */
export default function FahrerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
      />
      <div className="drive min-h-screen">{children}</div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .drive {
          --accent:#0F9C50; --accent-press:#0B7E40; --on-accent:#FFFFFF; --accent-tint:#E6F4EC;
          --bg:#F2F4F2; --surface:#FFFFFF; --surface-2:#F6F8F6;
          --ink:#0B0F0D; --ink-2:#586460; --ink-3:#909893;
          --line:#E5E9E6; --line-2:#EFF2F0;
          --danger:#E5484D; --danger-tint:#FCEBEC; --warn:#E07C0B; --warn-tint:#FBF0DF;
          background:var(--bg); color:var(--ink);
          font-family:'Hanken Grotesk',-apple-system,system-ui,sans-serif; letter-spacing:-0.01em;
        }
        .drive .mono { font-family:'JetBrains Mono',ui-monospace,monospace; letter-spacing:-0.02em; }
      `,
        }}
      />
    </>
  );
}
