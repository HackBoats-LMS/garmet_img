'use client';

import React from 'react';
import { GarmentCategory, GarmentConfig, UploadedReference } from '../types';
import { GARMENT_CONFIGS } from '../utils/constants';
import { CheckCircle2, Image as ImageIcon } from 'lucide-react';

interface GarmentCategoryTabsProps {
  selectedCategory: GarmentCategory;
  onSelectCategory: (category: GarmentCategory) => void;
  references: Record<string, UploadedReference>;
}

export const GarmentCategoryTabs: React.FC<GarmentCategoryTabsProps> = ({
  selectedCategory,
  onSelectCategory,
  references,
}) => {
  return (
    <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>1. Select Garment Type</span>
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
              (Each type provides specialized reference slots like Pallu, Blouse, Neck Yoke, Kalis)
            </span>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {GARMENT_CONFIGS.map((garment) => {
          const isSelected = selectedCategory === garment.id;
          
          // Count uploaded or filled references for this category
          const filledSlotsCount = garment.slots.filter((slot) => {
            const ref = references[slot.id];
            return ref && (ref.previewUrl || ref.customNotes || ref.colorName);
          }).length;

          return (
            <button
              key={garment.id}
              onClick={() => onSelectCategory(garment.id)}
              className={`group relative flex flex-col items-start p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-200 ${
                isSelected
                  ? 'border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100 shadow-sm ring-1 ring-amber-500/50'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/60 hover:bg-white dark:hover:bg-zinc-850'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">
                  {garment.icon}
                </span>
                {isSelected ? (
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                ) : filledSlotsCount > 0 ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <ImageIcon className="w-2.5 h-2.5" />
                    {filledSlotsCount}
                  </span>
                ) : null}
              </div>

              <div className="w-full">
                <div className="font-semibold text-xs sm:text-sm tracking-tight truncate">
                  {garment.name}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {garment.subtitle}
                </div>
              </div>

              {isSelected && (
                <div className="absolute bottom-1 right-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
