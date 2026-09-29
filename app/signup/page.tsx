'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Mail, Phone, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: mode === 'email' ? email : undefined,
          phone: mode === 'phone' ? phone : undefined,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create account');
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const loginResult = await signIn('credentials', {
        email: mode === 'email' ? email : undefined,
        phone: mode === 'phone' ? phone : undefined,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push('/login');
      } else {
        router.push('/customer');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    signIn('google', { callbackUrl: '/customer' });
  };

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left: Luxury Brand Panel */}
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
            Transform your boutique with <span className="text-accent">AI models</span>
          </h1>

          <p className="mt-6 text-cream-dark/80 text-base leading-relaxed">
            Create high-converting, catalog-ready garment images in seconds. No studios, no logistics, just upload your fabric and generate.
          </p>
        </div>

        {/* Ambient Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-charcoal-soft/50 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Right: Signup Form */}
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

          <div>
            <h2 className="font-display text-3xl font-extrabold text-charcoal">Create account</h2>
            <p className="mt-2 text-sm text-charcoal-muted">Sign up to get started with your photoshoots</p>
          </div>

          {/* Mode Switcher */}
          <div className="mt-8 flex gap-1.5 p-1.5 bg-cream-dark/60 rounded-xl">
            {[
              { id: 'email' as const, label: 'Email Address', icon: <Mail className="w-4 h-4" /> },
              { id: 'phone' as const, label: 'Phone Number', icon: <Phone className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setMode(tab.id); setError(''); }}
                className={`
                  flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold
                  transition-all duration-200 cursor-pointer
                  ${mode === tab.id
                    ? 'bg-white text-charcoal shadow-sm'
                    : 'text-charcoal-muted hover:text-charcoal'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ananya Sharma"
              required
            />

            {mode === 'email' ? (
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@boutique.com"
                required
              />
            ) : (
              <Input
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
              />
            )}

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-9 text-charcoal-light hover:text-charcoal cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />

            <div className="pt-2">
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Create Account
              </Button>
            </div>
          </form>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-cream-border" />
            <span className="text-xs text-charcoal-muted uppercase font-semibold tracking-wider">or</span>
            <div className="flex-1 h-px bg-cream-border" />
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="mt-6 w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white border border-cream-border text-sm font-semibold text-charcoal hover:bg-cream-light hover:shadow-sm transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <p className="mt-8 text-center text-sm text-charcoal-muted">
            Already have an account?{' '}
            <Link href="/login" className="text-accent font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
