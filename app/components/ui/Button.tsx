'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-accent text-white hover:bg-accent-hover active:bg-accent-pressed shadow-sm hover:shadow-md active:scale-[0.99]',
    secondary:
      'bg-charcoal text-cream hover:bg-charcoal-soft active:bg-charcoal shadow-sm active:scale-[0.99]',
    ghost:
      'bg-white text-charcoal hover:bg-cream active:bg-cream-dark border border-cream-border active:scale-[0.99]',
    danger:
      'bg-error text-white hover:bg-red-700 active:bg-red-800 shadow-sm active:scale-[0.99]',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 min-h-[34px]',
    md: 'text-sm px-5 py-2.5 min-h-[42px]',
    lg: 'text-base px-6 py-3.5 min-h-[48px]',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
