'use client';

import React, { useState } from 'react';
import { UserCheck, ShieldCheck, Eye, Sparkles, CheckCircle2, X } from 'lucide-react';
import { ModelPersona } from '@/app/types/stock';
import { CONSISTENT_MODELS } from '@/app/utils/modelsAndPoses';

interface Props {
  selectedModelId: string;
  onSelectModel: (model: ModelPersona) => void;
}

export function ModelPersonaSelector({ selectedModelId, onSelectModel }: Props) {
  const [zoomModel, setZoomModel] = useState<ModelPersona | null>(null);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Select AI Model Persona (3 Consistent Indian Models)
            </h2>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
              Consistent Identity Locked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            The selected model will maintain identical facial geometry, skin complexion, and graceful demeanor across all 4 poses.
          </p>
        </div>

        <span className="text-xs text-slate-600">
          Selected: <strong className="text-emerald-700 font-bold">{CONSISTENT_MODELS.find(m => m.id === selectedModelId)?.name || 'Ananya'}</strong>
        </span>
      </div>

      {/* Model Cards Grid with 3 Curated Models + 1 Custom Upload Model */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CONSISTENT_MODELS.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <div
              key={model.id}
              onClick={() => onSelectModel(model)}
              className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer group ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/50 shadow-md'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50 hover:shadow-xs'
              }`}
            >
              {/* Full Image Container */}
              <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                <img
                  src={model.avatarUrl}
                  alt={model.name}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />

                {/* Top Overlay Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[11px] font-bold text-slate-900 border border-slate-200 shadow-xs">
                    {model.name}
                  </span>

                  {isSelected ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ACTIVE
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomModel(model);
                      }}
                      className="pointer-events-auto p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs transition-colors"
                      title="View Full High-Res Photo"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bottom Overlay Info on Image */}
                <div className="absolute bottom-3 left-3 right-3 space-y-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/90 backdrop-blur text-emerald-800 font-bold border border-emerald-100 shadow-2xs inline-block">
                    {model.skinTone}
                  </span>
                  <h3 className="text-xs font-bold text-white leading-tight drop-shadow-sm">
                    {model.tagline}
                  </h3>
                </div>
              </div>

              {/* Card Details Body */}
              <div className="p-3.5 space-y-2.5 bg-white flex-1 flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                    Facial Likeness Profile:
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                    {model.features}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectModel(model);
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        <span>Selected Face</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Use {model.name}&apos;s Face</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* 4th Card: Upload Custom Face / Brand Ambassador */}
        <div
          onClick={() => {
            const input = document.getElementById('custom-model-upload') as HTMLInputElement;
            if (input) input.click();
          }}
          className={`rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer ${
            selectedModelId === 'custom_model'
              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/40 shadow-sm'
              : 'border-slate-300 bg-slate-50/50 hover:border-emerald-500 hover:bg-white'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-700 flex items-center justify-center shadow-xs">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Upload Custom Model Photo
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Upload a real portrait of your boutique model to lock her exact face & likeness
            </p>
          </div>

          <button
            type="button"
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-2xs cursor-pointer"
          >
            + Browse Face Photo
          </button>

          <input
            id="custom-model-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_DIM = 1024;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_DIM || height > MAX_DIM) {
                      if (width > height) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                      } else {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                      }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);

                    const customPersona: ModelPersona = {
                      id: 'custom_model',
                      name: 'Custom Face Reference',
                      tagline: 'Your Uploaded Model',
                      avatarUrl: optimizedBase64,
                      skinTone: 'Exact Photo Likeness',
                      features: 'Exact facial geometry, eyes, nose, and complexion from your uploaded model portrait photo.',
                      promptAnchor: 'Consistent identity: The exact Indian female model shown in the custom face reference portrait, preserving her precise facial structure, almond eyes, and natural skin complexion',
                    };
                    onSelectModel(customPersona);
                  };
                  img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      </div>

      {/* High-Resolution Zoom Modal */}
      {zoomModel && (
        <div 
          onClick={() => setZoomModel(null)}
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-2xl space-y-3 p-5 animate-in zoom-in-95 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{zoomModel.name} &bull; Full Portrait Reference</h3>
                <p className="text-xs text-emerald-700 font-medium">{zoomModel.skinTone} &bull; {zoomModel.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomModel(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img
                src={zoomModel.avatarUrl}
                alt={zoomModel.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="p-2 space-y-1 text-xs text-slate-600 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-900 block">Facial Anchors & Features:</span>
              <p className="text-xs text-slate-600 leading-relaxed">{zoomModel.features}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectModel(zoomModel);
                setZoomModel(null);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm"
            >
              Confirm & Choose {zoomModel.name} for Studio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

