import { redirect } from 'next/navigation';
import { getCurrentEmployee, type CurrentEmployee, type EmployeeRole } from './getCurrentEmployee';

export async function requireRole(allowed: EmployeeRole[]): Promise<CurrentEmployee> {
  const emp = await getCurrentEmployee();
  if (!emp) redirect('/login');
  if (!allowed.includes(emp.rolle)) redirect('/login?reason=forbidden');
  return emp;
}

export async function requireAdmin(): Promise<CurrentEmployee> {
  return requireRole(['backoffice', 'admin']);
}

export async function requireManagerPlus(): Promise<CurrentEmployee> {
  return requireRole(['manager', 'backoffice', 'admin']);
}

/**
 * POS-Bereich (Kassieren, Bestelleingang, Küche, Drucker).
 * Alle eingeloggten Mitarbeiter inkl. Service-Rollen + Kiosk-Accounts.
 * Backoffice-Rollen sind auch zugelassen.
 */
export async function requirePosAccess(): Promise<CurrentEmployee> {
  return requireRole([
    'mitarbeiter', 'teamleiter', 'manager', 'backoffice', 'admin',
    'server', 'bartender', 'cook', 'dishwasher',
  ]);
}
