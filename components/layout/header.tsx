import Link from 'next/link';
import { LogOut, Calendar, ChevronDown } from 'lucide-react';
import type { CurrentEmployee } from '@/lib/auth/getCurrentEmployee';

const ROLE_LABEL: Record<string, string> = {
  mitarbeiter: 'Mitarbeiter',
  teamleiter: 'Teamleiter',
  manager: 'Manager',
  backoffice: 'Backoffice',
  admin: 'Admin',
  server: 'Service',
  bartender: 'Bartender',
  cook: 'Koch',
  dishwasher: 'Spüler',
};

function todayDe(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

export function Header({ employee }: { employee: CurrentEmployee }) {
  const initials = [employee.vorname?.[0], employee.nachname?.[0]]
    .filter(Boolean).join('').toUpperCase() || '?';
  const fullName = [employee.vorname, employee.nachname].filter(Boolean).join(' ') || 'Mitarbeiter';
  const role = ROLE_LABEL[employee.rolle] ?? employee.rolle;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-4 sm:px-6 backdrop-blur-md">
      <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
        <Calendar className="h-3.5 w-3.5" />
        <span className="font-medium capitalize">{todayDe()}</span>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <Link
          href="/employees"
          className="group flex items-center gap-3 rounded-full pl-1.5 pr-3 py-1 border border-zinc-200 hover:border-matcha-400 hover:bg-matcha-50/50 transition"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-matcha-700 to-matcha-900 text-white grid place-items-center font-display font-black text-sm shadow-sm">
            {initials}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <div className="text-sm font-semibold text-zinc-900 group-hover:text-matcha-900">{fullName}</div>
            <div className="text-[11px] uppercase tracking-wider text-matcha-700 font-bold">{role}</div>
          </div>
          <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-zinc-400 group-hover:text-matcha-700" />
        </Link>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition"
            aria-label="Abmelden"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </form>
      </div>
    </header>
  );
}
