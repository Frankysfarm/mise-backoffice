import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { LocationKpiWallClient } from './client';

export const dynamic = 'force-dynamic';

export default async function LocationKpiWallPage() {
  await requireManagerPlus().catch(() => redirect('/start'));
  return <LocationKpiWallClient />;
}
