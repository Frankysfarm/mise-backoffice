import { notFound, redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { isMiseOsScreen, MISE_OS_NATIVE_ROUTES } from '@/lib/mise-os';

export const dynamic = 'force-dynamic';

export default async function MiseOsLaunchPage({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!isMiseOsScreen(screen)) notFound();
  await requireManagerPlus();
  redirect(MISE_OS_NATIVE_ROUTES[screen]);
}
