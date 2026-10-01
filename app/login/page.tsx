'use client';

import React from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Button } from '@/app/components/ui/Button';
import { Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const handleGoogleLogin = () => {
    // We are an internal tool now, redirect straight to admin on success
    signIn('google', { callbackUrl: '/admin/inventory' });
  };

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left: Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal relative items-center justify-center p-16 overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-12">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-md">
              <span className="text-white text-lg font-bold font-display">C</span>
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-cream">
              CoutureAI <span className="text-accent">Studio</span>
            </span>
          </Link>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-charcoal-soft border border-white/10 text-accent text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Garment Photography</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-cream leading-[1.15]">
            Welcome back to <span className="text-accent">CoutureAI</span>
          </h1>

          <p className="mt-6 text-cream-dark/80 text-base leading-relaxed">
            Log in to continue generating realistic AI model photoshoots for your sarees, kurtis, and ethnic garments.
          </p>
        </div>

        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-white text-sm font-bold font-display">C</span>
              </div>
              <span className="font-display text-base font-bold text-charcoal">
                CoutureAI <span className="text-accent">Studio</span>
              </span>
            </Link>
          </div>

          <div className="mb-10">
            <h2 className="font-display text-3xl font-extrabold text-charcoal">Sign in</h2>
            <p className="mt-2 text-sm text-charcoal-muted">Internal Access Only</p>
          </div>

          <Button
            type="button"
            onClick={handleGoogleLogin}
            variant="secondary"
            size="lg"
            className="w-full h-12 bg-white flex items-center justify-center gap-3 font-semibold text-charcoal hover:bg-cream-dark border-cream-dark shadow-sm transition-all cursor-pointer"
          >
            <Image 
              src="https://www.svgrepo.com/show/475656/google-color.svg" 
              alt="Google" 
              width={20} 
              height={20} 
            />
            Continue with Google
          </Button>

          <p className="mt-8 text-center text-[10px] text-charcoal-light">
            Authorized personnel only. By continuing, you agree to our Internal Security Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
