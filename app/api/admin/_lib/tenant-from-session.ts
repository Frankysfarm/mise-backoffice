/**
 * Helper: aus Mise-Backoffice User-Session ermittle aktuelle Tenant-ID.
 * Liegt unter app/api/admin/_lib/tenant-from-session.ts auf dem Server.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export interface AdminContext {
  user_id: string;
  tenant_id: string;
  role: string;
  employee_id: string;
}

export async function getAdminContext(): Promise<AdminContext | NextResponse> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 });
  }

  const { data: emp } = await sb
    .from('employees')
    .select('id,tenant_id,rolle')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!emp || !emp.tenant_id) {
    return NextResponse.json(
      { error: 'Kein Tenant-Zugriff für diesen User' },
      { status: 403 },
    );
  }

  return {
    user_id: user.id,
    tenant_id: emp.tenant_id,
    role: emp.rolle ?? 'staff',
    employee_id: emp.id,
  };
}

export function isAdminContext(x: AdminContext | NextResponse): x is AdminContext {
  return 'tenant_id' in x;
}
