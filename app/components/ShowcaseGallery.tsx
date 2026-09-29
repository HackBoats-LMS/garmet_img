'use client';

import React from 'react';
import { GeneratedShowcase } from '../types';
import { Sparkles, Eye, Download, Camera, Check } from 'lucide-react';

interface ShowcaseGalleryProps {
  showcases: GeneratedShowcase[];
  onSelectShowcase: (showcase: GeneratedShowcase) => void;
}

export const ShowcaseGallery: React.FC<ShowcaseGalleryProps> = ({
  showcases,
  onSelectShowcase,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Showcase Catalog & Recent Try-Ons
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Click any photo to view full 4K render, matched reference slots, and exact prompt
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {showcases.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectShowcase(item)}
            className="group relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 cursor-pointer shadow-sm hover:shadow-xl hover:border-amber-500/50 transition-all duration-300 flex flex-col"
          >
            {/* Image Thumbnail */}
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

              {/* Top Category Badge */}
              <div className="absolute top-2.5 left-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-white/10">
                  {item.garmentCategory}
                </span>
              </div>

              {/* Hover overlay hint */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                  <Eye className="w-3.5 h-3.5" /> View 4K Details
                </span>
              </div>

              {/* Bottom Caption */}
              <div className="absolute bottom-2.5 inset-x-2.5 text-white">
                <h4 className="font-bold text-xs sm:text-sm line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-zinc-300 line-clamp-1 mt-0.5">
                  {item.modelConfig.ethnicity} • {item.pose.slice(0, 20)}...
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
