import { requireManagerPlus } from '@/lib/auth/requireRole';
import { NotificationsClient } from './client';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireManagerPlus();
  return <NotificationsClient />;
}
