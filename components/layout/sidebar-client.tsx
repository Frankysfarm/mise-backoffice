'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MapPin, Building2, Calendar, GraduationCap,
  CheckSquare, Sparkles, Package, UtensilsCrossed, Banknote, Wrench,
  BookOpen, Bell, FileText, Settings, Award, Home, Bike, ChefHat,
  Receipt, Calculator, CreditCard, Ticket, Plug, Mail, Rocket, Grid,
  ArrowLeft, Store, Clock, Shield, Monitor, Lock, HelpCircle, Phone, History,
  ChevronRight, Upload, Percent, Palette, Globe, Wallet, Gift, Megaphone,
  ShoppingBag, FolderOpen, ClipboardList, BarChart2, Trophy, Brain, CalendarCheck2,
  FileDown, Star, Zap, Navigation, TrendingUp, UserX, Activity, Radio, MapPinned,
  MessageSquare, Map as MapIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, MapPin, Building2, Calendar, GraduationCap,
  CheckSquare, Sparkles, Package, UtensilsCrossed, Banknote, Wrench,
  BookOpen, Bell, FileText, Settings, Award, Home, Bike, ChefHat,
  Receipt, Calculator, CreditCard, Ticket, Plug, Mail, Rocket, Grid,
  Store, Clock, Shield, Monitor, Lock, HelpCircle, Phone, History,
  Upload, Percent, Palette, Globe, Wallet, Gift, Megaphone, ShoppingBag,
  FolderOpen, ClipboardList, BarChart2, Trophy, Brain, CalendarCheck2,
  FileDown, Star, Zap, Navigation, TrendingUp, UserX, Activity, Radio, MapPinned,
  MessageSquare, MapIcon,
};

export type SidebarItem = {
  href: string;
  icon: string;
  label: string;
  group?: string;
};
export type SidebarModule = {
  moduleId: string;
  label: string;
  icon: string;
  items: SidebarItem[];
};

type Props = {
  modules: SidebarModule[];
  overview: SidebarModule;
  admin: SidebarModule;
};

function isHrefActive(href: string, path: string): boolean {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(href + '/');
}

function detectActive(
  path: string,
  modules: SidebarModule[],
  overview: SidebarModule,
  admin: SidebarModule,
): SidebarModule {
  // 1) Längstes-prefix-match über alle aktiven Modul-Items.
  //    Wenn ein Modul den Pfad „besitzt" (z. B. /settings/tax-rates ist in
  //    ordering, /settings/stripe ebenso), bleibt der Owner in diesem Modul —
  //    auch wenn die Route unter /settings/* liegt.
  let best: { module: SidebarModule; len: number } | null = null;
  for (const section of [...modules, admin]) {
    for (const i of section.items) {
      if (isHrefActive(i.href, path)) {
        if (!best || i.href.length > best.len) {
          best = { module: section, len: i.href.length };
        }
      }
    }
  }
  if (best) return best.module;

  // 2) Keine Sektion hat den Pfad — generischer /settings, /locations,
  //    /departments fällt in den Admin-Bereich.
  if (
    path.startsWith('/settings') ||
    path.startsWith('/locations') ||
    path.startsWith('/departments')
  ) {
    return admin;
  }

  return overview;
}

export function SidebarClient({ modules, overview, admin }: Props) {
  const path = usePathname() ?? '/';
  const current = detectActive(path, modules, overview, admin);
  const CurrentIcon = ICON_MAP[current.icon] ?? Home;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col">
      {/* BRAND HEADER */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-zinc-100">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-matcha-700 to-matcha-900 grid place-items-center text-white shadow-soft">
          <svg viewBox="0 0 40 40" className="h-5 w-5">
            <circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-black text-zinc-900 leading-none">mise</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-700 mt-1">
            {current.label}
          </div>
        </div>
      </div>

      {/* MODULE-WECHSEL */}
      <div className="px-3 pt-3">
        <Link
          href="/modules"
          className={cn(
            'group flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold transition',
            path === '/modules'
              ? 'bg-matcha-900 text-white'
              : 'border-2 border-zinc-200 text-zinc-700 hover:border-matcha-400 hover:bg-matcha-50/50',
          )}
        >
          <Grid className="h-4 w-4" />
          <span className="flex-1">Alle Module</span>
          <ChevronRight className={cn(
            'h-3.5 w-3.5 transition-transform',
            path === '/modules' ? 'opacity-80' : 'opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5',
          )} />
        </Link>
      </div>

      {/* NAV ITEMS */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {(() => {
          const groupOrder: string[] = [];
          const groupItems: Record<string, SidebarItem[]> = {};
          for (const it of current.items) {
            const g = it.group ?? '';
            if (!(g in groupItems)) {
              groupOrder.push(g);
              groupItems[g] = [];
            }
            groupItems[g].push(it);
          }

          return groupOrder.map((g) => (
            <div key={g || '__no_group__'}>
              {g && (
                <div className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                  {g}
                </div>
              )}
              <ul className="space-y-0.5">
                {groupItems[g].map(({ href, icon, label }) => {
                  const Icon = ICON_MAP[icon] ?? Home;
                  const active = isHrefActive(href, path);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          'group/item flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition relative',
                          active
                            ? 'bg-matcha-900 text-white font-bold shadow-soft'
                            : 'text-zinc-700 hover:bg-zinc-100',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-gold" />
                        )}
                        <Icon className={cn(
                          'h-4 w-4 shrink-0',
                          active ? 'text-gold' : 'text-zinc-500 group-hover/item:text-zinc-700',
                        )} />
                        <span className="truncate">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ));
        })()}

        {current.moduleId === '__overview__' && modules.length > 0 && (
          <div className="mt-4 rounded-2xl border-2 border-dashed border-matcha-200 bg-matcha-50/40 p-3.5 text-xs text-zinc-700">
            <div className="font-bold text-matcha-900 mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {modules.length} {modules.length === 1 ? 'Modul' : 'Module'} aktiv
            </div>
            <div className="leading-relaxed">
              Oben auf <span className="font-bold text-matcha-700">„Alle Module"</span> klicken um zu wechseln.
            </div>
          </div>
        )}
      </nav>

      {/* FOOTER */}
      {current.moduleId !== '__overview__' && current.moduleId !== '__admin__' && (
        <div className="px-3 pb-3 pt-2 border-t border-zinc-100">
          <Link
            href="/modules"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Modul wechseln
          </Link>
        </div>
      )}
    </aside>
  );
}
