'use client';

import React, { useState, useEffect } from 'react';
import { GeneratedShowcase, UploadedReference, GarmentCategory } from '../types';
import { 
  X, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  ZoomIn, 
  Layers, 
  Camera, 
  ExternalLink,
  Copy,
  Flame,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeneratedShowcase | null;
  isGenerating: boolean;
  onSelectResult: (res: GeneratedShowcase) => void;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({
  isOpen,
  onClose,
  result,
  isGenerating,
}) => {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'final' | 'split'>('final');

  const generationSteps = [
    'Analyzing fabric weave, color hex & motif attachments...',
    'Mapping tailored neckline cut and drapery physics...',
    'Synthesizing authentic 4K human skin pores and facial features...',
    'Applying Hasselblad medium format optics & lighting...',
    'Finalizing 4K UHD hyper-realistic render...',
  ];

  useEffect(() => {
    if (isGenerating) {
      setStep(0);
      const interval = setInterval(() => {
        setStep((prev) => (prev < generationSteps.length - 1 ? prev + 1 : prev));
      }, 700);
      return () => clearInterval(interval);
    } else if (result) {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [isGenerating, result]);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    if (result) {
      navigator.clipboard.writeText(result.masterPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (result) {
      const link = document.createElement('a');
      link.href = result.imageUrl;
      link.download = `couture-ai-${result.garmentCategory}-${Date.now()}.jpg`;
      link.target = '_blank';
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl text-white">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-md">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-zinc-100">
                  {isGenerating ? 'AI Model Photoshoot in Progress' : result?.title || 'Generated 4K AI Model Photoshoot'}
                </h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> 4K Ultra Real
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {isGenerating ? 'Synthesizing tailored garment references onto real human model' : result?.fabricSummary}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isGenerating ? (
            /* Loading State */
            <div className="py-16 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="relative mb-8">
                <div className="w-24 h-24 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin flex items-center justify-center" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
                </div>
              </div>

              <h4 className="text-lg font-bold text-zinc-100 mb-2">
                Generating 4K Human Model Photoshoot
              </h4>
              <p className="text-xs text-amber-400 font-mono mb-6 animate-pulse">
                {generationSteps[step]}
              </p>

              {/* Progress Steps Indicator */}
              <div className="w-full space-y-2 text-left bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                {generationSteps.map((st, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 text-xs transition-opacity ${
                      idx <= step ? 'text-zinc-200 opacity-100' : 'text-zinc-600 opacity-40'
                    }`}
                  >
                    {idx < step ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : idx === step ? (
                      <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                    )}
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : result ? (
            /* Result Ready State */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Image Canvas & Switcher (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] border border-zinc-700/80 shadow-2xl flex items-center justify-center group">
                  <img
                    src={result.imageUrl}
                    alt={result.title}
                    className="w-full h-full object-cover"
                  />

                  {/* Top Badge overlay */}
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-white/10 text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Real Human 4K Render</span>
                  </div>

                  {/* Bottom Control Bar overlay */}
                  <div className="absolute bottom-3 inset-x-3 p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-between">
                    <div className="text-[11px] text-zinc-300 font-mono truncate px-2">
                      85mm f/1.4 • Hasselblad H6D • 4K UHD
                    </div>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download 4K</span>
                    </button>
                  </div>
                </div>

                {/* Reference Swatches Used */}
                {result.referenceImages && result.referenceImages.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                      Matched Reference Inputs:
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {result.referenceImages.map((ref, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 p-1 flex items-center gap-2"
                        >
                          <img
                            src={ref.url}
                            alt={ref.slotName}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <span className="text-[11px] font-medium text-zinc-300 truncate">
                            {ref.slotName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Model Specs, Prompt & Actions (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  {/* Model Specs Card */}
                  <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 space-y-2.5">
                    <h5 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> Model & Studio Configuration
                    </h5>
                    <div className="text-xs space-y-1.5 text-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Model:</span>
                        <span className="font-medium text-zinc-200">{result.modelConfig.ethnicity} ({result.modelConfig.ageRange})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Skin Tone:</span>
                        <span className="font-medium text-zinc-200">{result.modelConfig.skinTone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Hair & Style:</span>
                        <span className="font-medium text-zinc-200">{result.modelConfig.hairStyle.slice(0, 32)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Pose:</span>
                        <span className="font-medium text-zinc-200">{result.pose.slice(0, 32)}...</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Location:</span>
                        <span className="font-medium text-zinc-200">{result.background.slice(0, 32)}...</span>
                      </div>
                    </div>
                  </div>

                  {/* Generated Prompt Box */}
                  <div className="bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">
                        Exact Executed Master Prompt:
                      </span>
                      <button
                        onClick={handleCopyPrompt}
                        className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                      >
                        {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="max-h-36 overflow-y-auto text-[11px] font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap bg-black/40 p-2.5 rounded-xl border border-zinc-900">
                      {result.masterPrompt}
                    </pre>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-zinc-800 flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex-1 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download 4K Catalog Image</span>
                  </button>
{/* */}
                  <button
                    onClick={onClose}
                    className="px-4 py-3 rounded-xl font-medium text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  >
                    Done
                  </button>
                </div>

              </div>

            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
};
