'use client';

import React, { useState } from 'react';
import { GeneratedPromptBundle } from '../utils/promptGenerator';
import { GenerationSettings } from '../types';
import { 
  Copy, 
  Check, 
  Sparkles, 
  Code2, 
  Sliders, 
  Wand2, 
  Cpu, 
  Eye, 
  Download,
  Flame
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PromptEngineeringPanelProps {
  promptBundle: GeneratedPromptBundle;
  settings: GenerationSettings;
  onUpdateSettings: (settings: GenerationSettings) => void;
  onGenerateImage: () => void;
  isGenerating: boolean;
}

export const PromptEngineeringPanel: React.FC<PromptEngineeringPanelProps> = ({
  promptBundle,
  settings,
  onUpdateSettings,
  onGenerateImage,
  isGenerating,
}) => {
  const [activeTab, setActiveTab] = useState<'midjourney' | 'flux' | 'sdxl' | 'master' | 'json'>('midjourney');
  const [copied, setCopied] = useState(false);

  const getActivePromptText = () => {
    switch (activeTab) {
      case 'midjourney':
        return promptBundle.midjourneyPrompt;
      case 'flux':
        return promptBundle.fluxPrompt;
      case 'sdxl':
        return `[POSITIVE PROMPT]:\n${promptBundle.sdxlPositivePrompt}\n\n[NEGATIVE PROMPT]:\n${promptBundle.sdxlNegativePrompt}`;
      case 'master':
        return promptBundle.masterPrompt;
      case 'json':
        return JSON.stringify(promptBundle.apiPayloadPreview, null, 2);
      default:
        return promptBundle.masterPrompt;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActivePromptText());
    setCopied(true);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.85 },
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 text-white rounded-2xl border border-zinc-800 p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Panel Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1 border border-amber-500/30">
              <Flame className="w-3 h-3 text-amber-400" />
              6. Master 4K Prompt Studio
            </span>
            <span className="text-xs text-zinc-400">
              Real-time multi-reference prompt compiler
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-zinc-100 mt-1">
            Engineered High-Fidelity Prompt for Garments Shop
          </h2>
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerateImage}
          disabled={isGenerating}
          className="relative group overflow-hidden px-5 py-3 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 via-rose-500 to-violet-600 text-white shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
          <Wand2 className={`w-4 h-4 ${isGenerating ? 'animate-spin' : 'animate-bounce'}`} />
          <span>
            {isGenerating ? 'Synthesizing 4K Real Human Model...' : 'Generate 4K AI Model Photoshoot'}
          </span>
        </button>
      </div>

      {/* References Summary Chips */}
      {promptBundle.referenceSummary.length > 0 && (
        <div className="relative z-10 mb-4 p-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-semibold text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Included References:
          </span>
          {promptBundle.referenceSummary.map((item, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-700/70 text-zinc-200 border border-zinc-600/50"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Target Engine Tabs */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1 bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/60 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('midjourney')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'midjourney'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Midjourney v6.1</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-black/20 font-mono">--ar {settings.aspectRatio}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('flux')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'flux'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Flux 1.0 Pro</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sdxl')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'sdxl'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>SDXL / ControlNet</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
              activeTab === 'master'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Master Prompt
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
              activeTab === 'json'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            <span>API JSON</span>
          </button>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Copy Prompt</span>
            </>
          )}
        </button>
      </div>

      {/* Code / Prompt Text Box */}
      <div className="relative z-10">
        <pre className="w-full max-h-56 overflow-y-auto p-4 rounded-xl bg-zinc-950/90 border border-zinc-800 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap selection:bg-amber-500 selection:text-black">
          {getActivePromptText()}
        </pre>
      </div>

      {/* Quality Toggles & Fine Tuning */}
      <div className="relative z-10 mt-4 pt-3 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.enhanceSkinTexture}
            onChange={(e) => onUpdateSettings({ ...settings, enhanceSkinTexture: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
          />
          <span className="text-xs text-zinc-300">
            Real Human Skin Micro-Pores (Zero plastic look)
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.enhanceFabricWeave}
            onChange={(e) => onUpdateSettings({ ...settings, enhanceFabricWeave: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500 bg-zinc-800"
          />
          <span className="text-xs text-zinc-300">
            Zari / Embroidery Light Reflection Physics
          </span>
        </label>

        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Stylize Adherence:</span>
          <input
            type="range"
            min="100"
            max="600"
            step="50"
            value={settings.stylizeLevel}
            onChange={(e) => onUpdateSettings({ ...settings, stylizeLevel: Number(e.target.value) })}
            className="w-24 accent-amber-500"
          />
          <span className="font-mono text-amber-300">{settings.stylizeLevel}</span>
        </div>
      </div>
    </div>
  );
};
