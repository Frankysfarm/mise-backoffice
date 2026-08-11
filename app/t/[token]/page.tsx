import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Öffentliche QR-Adresse /t/[token] — leitet direkt zum isolierten
 * Tischbestell-Shop weiter. Der bestehende Liefer-Shop bleibt unangetastet.
 *
 * Die Token-Logik + Datenladen passiert jetzt in /opt/biss-app/src/app/t/[token]/page.tsx.
 */
export default async function LegacyTokenRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/tisch/t/${encodeURIComponent(token)}`);
}
