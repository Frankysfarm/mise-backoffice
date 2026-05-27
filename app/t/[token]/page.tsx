import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Alte Mise-Backoffice-Route /t/[token] — leitet jetzt zur biss-app weiter,
 * damit der QR-Tisch-Storefront die gleiche Optik wie die Lieferseite hat.
 *
 * Die Token-Logik + Datenladen passiert jetzt in /opt/biss-app/src/app/t/[token]/page.tsx.
 */
export default async function LegacyTokenRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/biss-app/t/${encodeURIComponent(token)}`);
}
