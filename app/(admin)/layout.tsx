import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import { HelpChatWidget } from '@/components/help/chat-widget';
import { OnboardingCheck } from '@/components/onboarding/check';
import { requireManagerPlus, requirePosAccess } from '@/lib/auth/requireRole';
import { getActiveModules, matchRouteToModule } from '@/lib/modules';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get('x-pathname') ?? '/';

  // POS-Bereich (Kassieren, Bestelleingang, Küche) ist für alle eingeloggten Mitarbeiter offen.
  // Restliches Backoffice bleibt manager+ only.
  const isPosArea = pathname === '/pos' || pathname.startsWith('/pos/');
  const employee = isPosArea ? await requirePosAccess() : await requireManagerPlus();

  const moduleId = matchRouteToModule(pathname);
  if (moduleId) {
    const active = await getActiveModules();
    if (!active.has(moduleId)) {
      redirect(`/modules?locked=${moduleId}`);
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex-1">
        <Header employee={employee} />
        <main className="container py-8">{children}</main>
      </div>
      <Toaster />
      <HelpChatWidget />
      <OnboardingCheck />
    </div>
  );
}
