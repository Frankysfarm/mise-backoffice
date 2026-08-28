import { notFound } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { isMiseOsScreen } from '@/lib/mise-os';
import { MiseOsLaunchClient } from './launch-client';

export const dynamic = 'force-dynamic';

export default async function MiseOsLaunchPage({ params }: { params: { screen: string } }) {
  if (!isMiseOsScreen(params.screen)) notFound();
  await requireManagerPlus();
  return <MiseOsLaunchClient screen={params.screen} />;
}
