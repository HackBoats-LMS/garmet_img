'use client';

import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'} group`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 items-center rounded-full
          transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-accent
          ${checked ? 'bg-accent' : 'bg-cream-dark'}
          ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 rounded-full bg-white shadow-sm
            transform transition-transform duration-200
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>

      {(label || description) && (
        <div className="pt-0.5">
          {label && <span className="text-sm font-medium text-charcoal block">{label}</span>}
          {description && <span className="text-xs text-charcoal-muted block mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}
