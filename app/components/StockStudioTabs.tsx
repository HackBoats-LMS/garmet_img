'use client';

import React from 'react';
import { Camera, Package, MessageSquare, CreditCard, Sparkles } from 'lucide-react';

export type StudioTabId = 'photoshoot' | 'inventory' | 'whatsapp' | 'billing';

interface Props {
  activeTab: StudioTabId;
  onSelectTab: (tab: StudioTabId) => void;
  activeStockCode: string;
  stockCount: number;
}

export function StockStudioTabs({ activeTab, onSelectTab, activeStockCode, stockCount }: Props) {
  const tabs = [
    {
      id: 'photoshoot' as StudioTabId,
      label: '1. AI Photoshoot Studio',
      subtitle: 'Upload Swatches & Generate Poses',
      icon: Camera,
    },
    {
      id: 'inventory' as StudioTabId,
      label: '2. Stock Catalog',
      subtitle: `${stockCount} Garments Saved`,
      icon: Package,
    },
    {
      id: 'whatsapp' as StudioTabId,
      label: '3. WhatsApp & Social Studio',
      subtitle: 'Customer Posters & Marketing Copy',
      icon: MessageSquare,
    },
    {
      id: 'billing' as StudioTabId,
      label: '4. Inventory & Billing',
      subtitle: 'Mark Sold Out & Clean Storage',
      icon: CreditCard,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-18 z-20 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between overflow-x-auto no-scrollbar">
        <div className="flex gap-2 py-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-left transition-all flex items-center gap-2.5 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 shadow-xs border border-emerald-300 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold leading-none">{tab.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{tab.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {activeStockCode && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-500">Active Stock:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] shadow-2xs">
              {activeStockCode}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

