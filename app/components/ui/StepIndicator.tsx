'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <div className={`flex items-center w-full ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={index}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center relative">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-300
                  ${isCompleted
                    ? 'bg-accent text-white shadow-sm'
                    : isActive
                      ? 'bg-accent text-white shadow-md ring-4 ring-accent/20'
                      : 'bg-cream-dark text-charcoal-muted'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium text-center whitespace-nowrap
                  ${isActive ? 'text-accent font-semibold' : isCompleted ? 'text-charcoal' : 'text-charcoal-light'}
                `}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`
                  flex-1 h-0.5 mx-2 mt-[-18px] rounded-full transition-colors duration-300
                  ${isCompleted ? 'bg-accent' : 'bg-cream-dark'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
