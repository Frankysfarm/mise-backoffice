import { createServerClient } from '@/lib/supabase/server';
import { ProgramForm } from './components/program-form';

export default async function EditLoyaltyProgramPage({
  params: { programId },
}: {
  params: { programId: string };
}) {
  const svc = createServerClient();

  const { data: program } = await svc
    .from('loyalty_programs')
    .select('*')
    .eq('id', programId)
    .single();

  return (
    <div className=container mx-auto p-4>
      <h1 className=text-3xl font-bold mb-8>Programm: {program?.name}</h1>

      <div className=space-y-8>
        <ProgramForm program={program} />
      </div>
    </div>
  );
}
