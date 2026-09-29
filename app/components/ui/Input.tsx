import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export function Input({ label, error, helpText, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
          {label}
        </label>
      )}
      <input
        id={inputId}
        suppressHydrationWarning
        className={`
          w-full px-4 py-3 rounded-xl
          bg-white border border-cream-border
          text-charcoal text-sm placeholder:text-charcoal-light/70
          focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
          transition-all duration-200 shadow-sm
          ${error ? 'border-error focus:border-error focus:ring-error/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-error font-medium">{error}</p>}
      {helpText && !error && <p className="text-xs text-charcoal-light">{helpText}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        suppressHydrationWarning
        className={`
          w-full px-4 py-3 rounded-xl
          bg-white border border-cream-border
          text-charcoal text-sm placeholder:text-charcoal-light/70
          focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20
          resize-none transition-all duration-200 shadow-sm
          ${error ? 'border-error focus:border-error focus:ring-error/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-error font-medium">{error}</p>}
    </div>
  );
}
