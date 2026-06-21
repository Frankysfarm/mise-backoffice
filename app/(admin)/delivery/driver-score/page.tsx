import { requireManagerPlus } from '@/lib/auth/requireRole';
import { DriverScoreClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fahrer Score-Verlauf' };

export default async function DriverScorePage() {
  const employee = await requireManagerPlus();
  return <DriverScoreClient employeeId={employee.id} />;
}
