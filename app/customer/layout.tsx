'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, User, ChevronLeft } from 'lucide-react';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isOrderPage = pathname.includes('/order/');

  return (
    <div className="min-h-screen bg-cream flex flex-col selection:bg-accent-border">
      {/* Minimal Luxury Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-cream-border/60 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isOrderPage && (
              <Link
                href="/customer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream hover:bg-cream-dark text-xs font-semibold text-charcoal-soft transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Categories</span>
              </Link>
            )}
            <Link href="/customer" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <span className="text-white text-xs font-bold font-display">C</span>
              </div>
              <span className="font-display text-base font-bold tracking-tight text-charcoal">
                CoutureAI <span className="text-accent">Studio</span>
              </span>
            </Link>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-cream-border/60">
              <Link
                href="/customer"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pathname === '/customer'
                    ? 'bg-cream-dark text-charcoal font-bold'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-cream'
                }`}
              >
                Studio
              </Link>
              <Link
                href="/customer/gallery"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  pathname === '/customer/gallery'
                    ? 'bg-charcoal text-white font-bold shadow-xs'
                    : 'text-charcoal-muted hover:text-charcoal hover:bg-cream'
                }`}
              >
                <span>My Gallery</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/customer/gallery"
              className="md:hidden px-3 py-1.5 rounded-lg bg-cream hover:bg-cream-dark text-xs font-semibold text-charcoal"
            >
              Gallery
            </Link>
            {session?.user && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cream border border-cream-border/60 text-xs font-semibold text-charcoal-soft">
                <User className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">{session.user.name || session.user.email}</span>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-xl text-charcoal-muted hover:text-error hover:bg-red-50 transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
