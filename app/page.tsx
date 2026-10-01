'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Shield, Sparkles, Wand2, Palette, Image as ImageIcon } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream flex flex-col selection:bg-accent-border">
      {/* Header */}
      <header className="px-6 py-5 border-b border-cream-border/60 bg-cream/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <span className="text-white text-base font-bold font-display">C</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-charcoal">
              CoutureAI <span className="text-accent">Studio</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-charcoal hover:text-accent transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-6 w-full">
          {/* Main Hero Banner */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-bg text-accent text-xs font-semibold border border-accent-border mb-8 shadow-xs">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>AI-Powered Garment Photoshoots</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-charcoal leading-[1.12] tracking-tight">
              Studio-quality<br />
              catalog images in{' '}
              <span className="text-accent">minutes</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-charcoal-muted leading-relaxed max-w-2xl mx-auto font-normal">
              Upload your fabric swatches, choose an AI model, and generate stunning
              photoshoot-ready catalog images. No studio, no expensive model bookings.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-accent text-white text-base font-semibold hover:bg-accent-hover active:bg-accent-pressed transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 group"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/admin/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-charcoal text-cream text-base font-semibold hover:bg-charcoal-soft active:bg-charcoal transition-all shadow-sm hover:shadow flex items-center justify-center gap-2.5"
              >
                <Shield className="w-4 h-4 text-cream/70" />
                <span>Admin Panel</span>
              </Link>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-4">
            {[
              {
                title: 'Dynamic Templates',
                desc: 'Admin creates custom templates with specific image slots, garment options, and poses.',
                icon: <Palette className="w-6 h-6 text-accent" />,
              },
              {
                title: 'AI Model Selection',
                desc: 'Choose from curated Indian & Western model personas for consistent, brand-ready photoshoots.',
                icon: <ImageIcon className="w-6 h-6 text-accent" />,
              },
              {
                title: 'Instant Generation',
                desc: 'Upload swatches, customize garment details, and receive 4K studio images with consistent lighting.',
                icon: <Wand2 className="w-6 h-6 text-accent" />,
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-8 rounded-2xl bg-white border border-cream-border hover:border-accent/40 hover:shadow-md transition-all duration-300 group flex flex-col"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-bg border border-accent-border/50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="font-display text-lg font-bold text-charcoal mb-2.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-charcoal-muted leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-cream-border/60 bg-white/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-charcoal-muted">
          <span>© 2026 CoutureAI Studio. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-charcoal transition-colors">Customer Login</Link>
            <Link href="/admin/login" className="hover:text-charcoal transition-colors">Admin Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
