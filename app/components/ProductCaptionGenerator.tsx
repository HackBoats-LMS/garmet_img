'use client';

import React, { useState } from 'react';
import {
  MessageSquare, Camera, Globe, RefreshCw, Copy, Check,
  Sparkles, Loader2, Send, Share2, ChevronDown
} from 'lucide-react';

interface PlatformConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  hint: string;
  shareUrl?: (text: string) => string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    hint: 'Broadcast-ready with emojis & CTA',
    shareUrl: (text) => `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: <Camera className="w-3.5 h-3.5" />,
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    hint: 'With hashtags & fashion tone',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: <span className="text-[13px]">👍</span>,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    hint: 'Engagement-focused community post',
  },
  {
    key: 'website',
    label: 'Website SEO',
    icon: <Globe className="w-3.5 h-3.5" />,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    hint: 'SEO product description',
  },
];

interface Props {
  orderId: string;
  productName: string;
  stockCode?: string | null;
  description?: string | null;
  swatchAnalysis?: Record<string, string> | null;
  price?: number | null;
  existingCaptions?: Record<string, string> | null;
  onCaptionsSaved?: (captions: Record<string, string>) => void;
}

export function ProductCaptionGenerator({
  orderId,
  productName,
  stockCode,
  description,
  swatchAnalysis,
  price,
  existingCaptions,
  onCaptionsSaved,
}: Props) {
  const [activePlatform, setActivePlatform] = useState('whatsapp');
  const [captions, setCaptions] = useState<Record<string, string>>(existingCaptions || {});
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activePlatformConfig = PLATFORMS.find((p) => p.key === activePlatform)!;
  const hasAnyCaptions = Object.values(captions).some(Boolean);

  const handleGenerateAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          productName,
          stockCode,
          description,
          swatchAnalysis,
          price,
          platforms: ['whatsapp', 'instagram', 'facebook', 'website'],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json();
      setCaptions(data.captions || {});
      if (onCaptionsSaved) onCaptionsSaved(data.captions || {});
    } catch (err: any) {
      setError(err.message || 'Failed to generate captions');
    } finally {
      setLoading(false);
    }
  };

  const handleRegeneratePlatform = async (platform: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          productName,
          stockCode,
          description,
          swatchAnalysis,
          price,
          platforms: [platform],
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const updated = { ...captions, ...data.captions };
      setCaptions(updated);
      if (onCaptionsSaved) onCaptionsSaved(updated);
    } catch {
      setError('Failed to regenerate. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTextChange = (platform: string, text: string) => {
    const updated = { ...captions, [platform]: text };
    setCaptions(updated);
    if (onCaptionsSaved) onCaptionsSaved(updated);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-bold text-slate-900">Platform Captions & Marketing Copy</span>
            </div>
            <p className="text-xs text-slate-500">
              AI-generated captions for WhatsApp, Instagram, Facebook & Website — tailored to your product.
            </p>
          </div>

          <button
            onClick={handleGenerateAll}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-60 shrink-0"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{hasAnyCaptions ? 'Regenerate All' : 'Generate All Captions'}</span>
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Platform Tabs */}
      <div className="flex border-b border-slate-100 overflow-x-auto">
        {PLATFORMS.map((platform) => {
          const hasContent = !!captions[platform.key];
          return (
            <button
              key={platform.key}
              onClick={() => setActivePlatform(platform.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border-b-2 ${
                activePlatform === platform.key
                  ? `${platform.color} border-current ${platform.bgColor}`
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {platform.icon}
              <span>{platform.label}</span>
              {hasContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Caption Body */}
      <div className="p-5">
        {!hasAnyCaptions && !loading ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No captions yet</p>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Click "Generate All Captions" to create AI-powered marketing copy for all platforms at once.
            </p>
          </div>
        ) : loading ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 mb-1">Generating captions...</p>
            <p className="text-xs text-slate-500">Using AI to craft platform-specific marketing copy</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {activePlatformConfig.hint}
              </p>
              <div className="flex items-center gap-2">
                {/* Regenerate this platform */}
                <button
                  onClick={() => handleRegeneratePlatform(activePlatform)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Redo</span>
                </button>

                {/* Share on WhatsApp if applicable */}
                {activePlatform === 'whatsapp' && captions.whatsapp && activePlatformConfig.shareUrl && (
                  <button
                    onClick={() => window.open(activePlatformConfig.shareUrl!(captions.whatsapp), '_blank')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Send className="w-3 h-3" />
                    <span>Open WhatsApp</span>
                  </button>
                )}

                {/* Copy */}
                <button
                  onClick={() => handleCopy(activePlatform, captions[activePlatform] || '')}
                  disabled={!captions[activePlatform]}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {copiedKey === activePlatform ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editable textarea */}
            <div className={`rounded-xl border ${activePlatformConfig.borderColor} ${activePlatformConfig.bgColor} overflow-hidden`}>
              <textarea
                rows={8}
                value={captions[activePlatform] || ''}
                onChange={(e) => handleTextChange(activePlatform, e.target.value)}
                placeholder={`${activePlatformConfig.label} caption will appear here after generation...`}
                className="w-full p-4 bg-transparent text-slate-800 text-xs leading-relaxed focus:outline-none resize-y font-mono"
              />
            </div>

            {/* Character count */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{captions[activePlatform]?.length || 0} characters</span>
              {activePlatform === 'whatsapp' && (
                <span className={captions.whatsapp?.length > 500 ? 'text-amber-500' : ''}>
                  {captions.whatsapp?.length > 500 ? '⚠ Long for broadcast' : '✓ Good length'}
                </span>
              )}
              {activePlatform === 'instagram' && (
                <span className={captions.instagram?.length > 2200 ? 'text-red-500' : 'text-emerald-600'}>
                  {captions.instagram?.length > 2200 ? '✕ Over 2200 char limit' : '✓ Within limit'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
