import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'muted';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-cream-dark text-charcoal-soft',
    accent: 'bg-accent-bg text-accent border border-accent-border',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    muted: 'bg-cream text-charcoal-muted border border-cream-border',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-0.5
        rounded-full text-xs font-semibold
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
