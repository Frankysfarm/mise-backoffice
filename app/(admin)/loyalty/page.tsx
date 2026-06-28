import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function LoyaltyProgramsPage() {
  const svc = createServerClient();
  const { data: { user } } = await svc.auth.getUser();
  
  if (!user?.id) {
    return <div>Unauthorized</div>;
  }

  const { data: employee } = await svc
    .from('employees')
    .select('tenant_id')
    .eq('auth_user_id', user.id)
    .single();

  const { data: programs } = await svc
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', employee?.tenant_id || '')
    .order('created_at', { ascending: false });

  return (
    <div className=container mx-auto p-4>
      <div className=flex justify-between items-center mb-6>
        <h1 className=text-3xl font-bold>Bonusprogramme</h1>
        <Link href=/admin/loyalty/new>
          <Button>Neues Programm</Button>
        </Link>
      </div>

      {!programs || programs.length === 0 ? (
        <p className=text-gray-500>Noch kein Bonusprogramm erstellt.</p>
      ) : (
        <div className=space-y-2>
          {programs.map(prog => (
            <div key={prog.id} className=p-4 border rounded flex justify-between items-center>
              <div>
                <h3 className=font-semibold>{prog.name}</h3>
                <p className=text-sm text-gray-500>
                  {prog.is_active ? '✓ Aktiv' : '○ Inaktiv'}
                </p>
              </div>
              <Link href={`/admin/loyalty/${prog.id}`}>
                <Button variant=outline>Bearbeiten</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
