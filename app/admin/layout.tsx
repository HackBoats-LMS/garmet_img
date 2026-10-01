'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Layers, Users, Cpu, LogOut, ChevronRight, Package, Tag, CalendarDays, ShieldCheck } from 'lucide-react';
import { signOut } from 'next-auth/react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid },
  { href: '/admin/inventory', label: 'Inventory', icon: Package },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/templates', label: 'Templates', icon: Layers },
  { href: '/admin/model-selection', label: 'AI Engine & Models', icon: Cpu },
  { href: '/admin/models', label: 'Model Personas', icon: Users },
  { href: '/admin/admins', label: 'Admins', icon: ShieldCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't wrap login page with admin layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-cream selection:bg-accent-border">
      {/* Sidebar */}
      <aside className="w-64 bg-charcoal flex flex-col shrink-0 sticky top-0 h-screen border-r border-white/5">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-md">
              <span className="text-white text-base font-bold font-display">C</span>
            </div>
            <div>
              <span className="font-display text-base font-bold text-cream block leading-tight">
                CoutureAI
              </span>
              <span className="text-[11px] text-accent font-semibold tracking-wider uppercase">Admin Portal</span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
                  transition-all duration-200 group
                  ${isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-cream-dark/60 hover:text-cream hover:bg-white/5'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 opacity-80" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-6 border-t border-white/5">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-cream-dark/60 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 w-full cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen">
        <div className="max-w-5xl mx-auto px-10 py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
