'use client';

import React, { useState } from 'react';
import { Copy, Check, MessageSquare, Camera, Globe, Sparkles, RefreshCw, Send } from 'lucide-react';
import { StockItemData } from '@/app/types/stock';
import { generateAllPlatformCopies } from '@/app/utils/brandStrategist';

interface Props {
  stockItem: StockItemData;
  onUpdateCopies?: (copies: { whatsapp: string; instagram: string; website: string }) => void;
}

export function BrandCopyGenerator({ stockItem, onUpdateCopies }: Props) {
  const [activePlatform, setActivePlatform] = useState<'whatsapp' | 'instagram' | 'website'>('whatsapp');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const defaultCopies = React.useMemo(() => {
    return generateAllPlatformCopies(stockItem);
  }, [stockItem]);

  const [copies, setCopies] = useState({
    whatsapp: stockItem.whatsappCopy || defaultCopies.whatsapp,
    instagram: stockItem.instagramCopy || defaultCopies.instagram,
    website: stockItem.websiteCopy || defaultCopies.website,
  });

  React.useEffect(() => {
    const updated = generateAllPlatformCopies(stockItem);
    setCopies({
      whatsapp: stockItem.whatsappCopy || updated.whatsapp,
      instagram: stockItem.instagramCopy || updated.instagram,
      website: stockItem.websiteCopy || updated.website,
    });
  }, [stockItem.stockCode, stockItem.title, stockItem.rawDescription, stockItem.price]);

  const handleCopy = (text: string, platformKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(platformKey);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRegenerateFromBrand = () => {
    const fresh = generateAllPlatformCopies(stockItem);
    setCopies(fresh);
    if (onUpdateCopies) onUpdateCopies(fresh);
  };

  const handleChangeText = (text: string) => {
    const updated = { ...copies, [activePlatform]: text };
    setCopies(updated);
    if (onUpdateCopies) onUpdateCopies(updated);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(copies.whatsapp);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleAIGenerate = async () => {
    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const response = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockItem }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate AI captions');
      }
      const data = await response.json();
      const fresh = {
        whatsapp: data.whatsapp || copies.whatsapp,
        instagram: data.instagram || copies.instagram,
        website: data.website || copies.website,
      };
      setCopies(fresh);
      if (onUpdateCopies) onUpdateCopies(fresh);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-900">
              Ready-to-Use Customer Message & Social Captions
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-formatted with silk mark details, price, and luxury boutique tone for instant customer broadcasting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAIGenerate}
            disabled={isGeneratingAI}
            className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors shrink-0 cursor-pointer font-medium disabled:opacity-50"
          >
            {isGeneratingAI ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>AI Enhance Copy</span>
          </button>

          <button
            type="button"
            onClick={handleRegenerateFromBrand}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shrink-0 cursor-pointer font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {aiError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
          Error: {aiError}
        </div>
      )}

      {/* Platform Switcher Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActivePlatform('whatsapp')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activePlatform === 'whatsapp'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
          <span>WhatsApp Broadcast</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePlatform('instagram')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activePlatform === 'instagram'
              ? 'bg-pink-50 text-pink-800 border border-pink-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Camera className="w-3.5 h-3.5 text-pink-600" />
          <span>Instagram Caption</span>
        </button>

        <button
          type="button"
          onClick={() => setActivePlatform('website')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activePlatform === 'website'
              ? 'bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>Website Spec & SEO</span>
        </button>
      </div>

      {/* Copy Box with Live Editable Textarea */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-slate-200 text-xs text-slate-600">
          <span className="font-medium text-[11px]">
            {activePlatform === 'whatsapp' && '📱 Ready for WhatsApp 1-on-1 Customer DMs & Broadcast Lists'}
            {activePlatform === 'instagram' && '📸 High-reach Instagram post copy with tags'}
            {activePlatform === 'website' && '🌐 Product description with care & fabric details'}
          </span>

          <div className="flex items-center gap-2">
            {activePlatform === 'whatsapp' && (
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleCopy(copies[activePlatform], activePlatform)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              {copiedKey === activePlatform ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>

        <textarea
          rows={6}
          value={copies[activePlatform]}
          onChange={(e) => handleChangeText(e.target.value)}
          className="w-full p-4 bg-transparent text-slate-800 text-xs leading-relaxed focus:outline-none resize-y font-mono"
        />
      </div>
    </div>
  );
}

