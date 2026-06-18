import { redirect } from 'next/navigation';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { CostPerOrderClient } from './client';

export const dynamic = 'force-dynamic';

export default async function CostPerOrderPage() {
  await requireManagerPlus().catch(() => redirect('/start'));
  return <CostPerOrderClient />;
}
