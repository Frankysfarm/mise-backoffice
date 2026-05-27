import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type EmployeeRole = 'mitarbeiter' | 'teamleiter' | 'manager' | 'backoffice' | 'admin' | 'server' | 'bartender' | 'cook' | 'dishwasher';

export type CurrentEmployee = {
  id: string;
  auth_user_id: string | null;
  vorname: string;
  nachname: string;
  email: string | null;
  rolle: EmployeeRole;
  department_id: string | null;
  location_id: string | null;
  tenant_id: string | null;
};

export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('employees')
    .select('id,auth_user_id,vorname,nachname,email,rolle,department_id,location_id,tenant_id')
    .eq('auth_user_id', user.id)
    .maybeSingle<CurrentEmployee>();
  return data;
});
