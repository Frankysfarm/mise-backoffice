import { redirect } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Mail, Phone, UserRound } from 'lucide-react';
import { requirePosAccess } from '@/lib/auth/requireRole';
import { createServiceClient } from '@/lib/supabase/server';
import { berlinScheduleMoment, isResponsibilityScheduleActive, type ResponsibilitySchedule } from '@/lib/operations/responsibility-scope';
import { AvatarUploader } from '@/components/avatar-uploader';
import { EmployeeAvatar } from '@/components/employee-avatar';

export const dynamic = 'force-dynamic';

type EmployeeResponsibility = ResponsibilitySchedule & {
  id: string;
  responsibility_role: string;
  department: { id: string; name: string } | { id: string; name: string }[] | null;
};

type EmployeeWithReports = {
  id: string;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  rolle: string;
  position_title: string | null;
  avatar_url: string | null;
  status: string;
  employment_type: string | null;
  reports_to_employee_id: string | null;
};

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    mitarbeiter: 'Mitarbeiter', teamleiter: 'Teamleitung', manager: 'Manager',
    backoffice: 'Backoffice', admin: 'Administration', server: 'Service',
    bartender: 'Bar', cook: 'Küche', dishwasher: 'Spülküche',
  };
  return labels[role] ?? role;
}

export default async function ProfilPage() {
  const employee = await requirePosAccess();
  if (!employee.tenant_id) redirect('/login?reason=no_access');
  const currentEmployee = employee as typeof employee & { reports_to_employee_id: string | null };

  const service = createServiceClient();
  const [{ data: profile }, { data: responsibilities }, { data: manager }] = await Promise.all([
    service.from('employees')
      .select('id,vorname,nachname,email,telefon,rolle,position_title,avatar_url,status,employment_type')
      .eq('id', employee.id)
      .eq('tenant_id', employee.tenant_id)
      .maybeSingle(),
    service.from('department_responsibility_assignments')
      .select('id,responsibility_role,weekday_scope,shift_start,shift_end,valid_from,valid_until,department:departments(id,name)')
      .eq('tenant_id', employee.tenant_id)
      .eq('location_id', employee.location_id ?? '')
      .eq('employee_id', employee.id)
      .eq('aktiv', true),
    currentEmployee.reports_to_employee_id
      ? service.from('employees')
          .select('id,vorname,nachname,position_title,rolle,avatar_url')
          .eq('id', currentEmployee.reports_to_employee_id)
          .eq('tenant_id', employee.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!profile) redirect('/login?reason=no_access');

  const moment = berlinScheduleMoment();
  const activeResponsibilities = ((responsibilities ?? []) as EmployeeResponsibility[])
    .filter((item) => isResponsibilityScheduleActive(item, moment));

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-2xl bg-slate-100 pb-12">
        <header className="relative overflow-hidden bg-slate-950 px-5 pb-20 pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-8">
          <div className="relative flex items-center gap-3">
            <a href="/mitarbeiter" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15">
              <ArrowLeft size={18} />
            </a>
            <div>
              <div className="text-lg font-bold tracking-tight">mise team</div>
              <div className="text-xs text-slate-300">Mein Profil</div>
            </div>
          </div>
        </header>

        <section className="relative -mt-12 px-4 sm:px-8">
          <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl shadow-slate-950/10 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <AvatarUploader employee={profile} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight">{profile.vorname} {profile.nachname}</h1>
                <p className="mt-1 text-sm text-slate-500">{roleLabel(profile.rolle)}{profile.position_title ? ` · ${profile.position_title}` : ''}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.email && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"><Mail size={12} /> {profile.email}</span>}
                  {profile.telefon && <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"><Phone size={12} /> {profile.telefon}</span>}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 px-4 sm:grid-cols-2 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Direkte Führung</div>
            {manager ? (
              <div className="mt-2 flex items-center gap-3">
                <EmployeeAvatar employee={manager} size="sm" />
                <div>
                  <div className="text-sm font-bold text-slate-800">{manager.vorname} {manager.nachname}</div>
                  <div className="text-xs text-slate-500">{manager.position_title || roleLabel(manager.rolle)}</div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Noch keine Führungskraft hinterlegt.</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Beschäftigung</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{profile.employment_type ? `${profile.employment_type.charAt(0).toUpperCase()}${profile.employment_type.slice(1)}` : '—'}</div>
            <div className="text-xs text-slate-500">Status: {profile.status}</div>
          </div>
        </section>

        <section className="mt-6 px-4 sm:px-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[.14em] text-indigo-700">Verantwortung</div>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Meine Bereiche</h2>
            </div>
            <BriefcaseBusiness className="text-slate-400" size={22} />
          </div>
          {activeResponsibilities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
              <UserRound className="mx-auto mb-2 text-slate-400" size={24} />
              Dir ist aktuell kein Bereich zugeordnet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeResponsibilities.map((item) => {
                const department = Array.isArray(item.department) ? item.department[0] : item.department;
                return (
                  <article key={item.id} className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
                    <div className="text-sm font-bold text-indigo-950">{department?.name ?? 'Bereich'}</div>
                    <div className="mt-1 text-xs font-semibold text-indigo-700">{item.responsibility_role === 'hauptverantwortung' ? 'Hauptverantwortung' : 'Stellvertretung'}</div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
