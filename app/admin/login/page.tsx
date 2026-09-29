'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import { Shield, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid credentials or insufficient admin permissions');
      } else {
        router.push('/admin');
      }
    } catch {
      setError('An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 selection:bg-accent selection:text-white">
      <div className="w-full max-w-md animate-fade-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-cream-dark/60 hover:text-cream mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-charcoal-soft border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display text-2xl font-bold text-cream">Admin Portal</h1>
            <p className="mt-2 text-sm text-cream-dark/60">
              Sign in with your administrator credentials
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-900/30 border border-red-500/30 text-red-200 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-cream-dark uppercase tracking-wider mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@coutureai.com"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-charcoal border border-white/10 text-cream text-sm placeholder:text-cream-dark/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-inner"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-cream-dark uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 rounded-xl bg-charcoal border border-white/10 text-cream text-sm placeholder:text-cream-dark/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-10 text-cream-dark/50 hover:text-cream cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2">
              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Access Admin Dashboard
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
