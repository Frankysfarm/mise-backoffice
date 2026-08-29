import { notFound, redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { isMiseOsScreen } from '@/lib/mise-os';

export const dynamic = 'force-dynamic';

const NATIVE_ROUTES: Record<string, string> = {
  dashboard: '/neo', builder: '/neo/app/ablaeufe', schulung: '/neo/app/schulungen',
  bereiche: '/neo/app/mitarbeiter', dienstplan: '/neo/app/dienstplan',
  rezeptbuch: '/neo/app/rezeptbuch', lager: '/neo/app/lager', compliance: '/neo/app/compliance',
};

export default async function MiseOsLaunchPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!isMiseOsScreen(screen)) notFound();
  await requireManagerPlus();
  redirect(NATIVE_ROUTES[screen]);
}
