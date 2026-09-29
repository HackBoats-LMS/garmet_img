'use client';

import React from 'react';
import { Sparkles, Camera, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onOpenPresets: () => void;
  onReset: () => void;
  activeCategoryName: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPresets, onReset, activeCategoryName }) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-slate-200/90 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-600 p-[2px] shadow-sm shadow-emerald-500/20">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-emerald-600 font-bold">
              <Camera className="w-5 h-5 text-emerald-600 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900">
                CoutureAI Studio
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                Virtual Model Studio
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              1-Click 4K AI Model Photoshoots for Saree & Apparel Boutiques
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenPresets}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Load ready-made garment boutique examples"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Load Sample Boutique Garments</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 text-xs rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            title="Reset form and start fresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

