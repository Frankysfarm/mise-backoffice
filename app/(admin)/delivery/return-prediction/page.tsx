import { requireManagerPlus } from '@/lib/auth/requireRole';
import { ReturnPredictionClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ReturnPredictionPage() {
  await requireManagerPlus();
  return <ReturnPredictionClient />;
}
