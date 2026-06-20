import { requireManagerPlus } from '@/lib/auth/requireRole';
import { GeofenceClient } from './client';

export const dynamic = 'force-dynamic';

export default async function GeofencePage() {
  await requireManagerPlus();
  return <GeofenceClient />;
}
