import { requireManagerPlus } from '@/lib/auth/requireRole';
import { ZoneRevenueOptimizerClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ZoneRevenueOptimizerPage() {
  await requireManagerPlus();
  return <ZoneRevenueOptimizerClient />;
}
