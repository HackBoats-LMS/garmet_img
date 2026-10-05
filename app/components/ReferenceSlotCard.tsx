'use client';

import React, { useRef } from 'react';
import { ReferenceSlot, UploadedReference } from '../types';
import { FABRIC_PRESETS, COLOR_PALETTES } from '../utils/constants';
import { Upload, X, Sparkles, Sliders, Palette, Layers, HelpCircle, Check, Cloud } from 'lucide-react';
import { useGooglePicker } from '../hooks/useGooglePicker';

interface ReferenceSlotCardProps {
  slot: ReferenceSlot;
  referenceData?: UploadedReference;
  onChange: (slotId: string, data: UploadedReference) => void;
  index: number;
}

export const ReferenceSlotCard: React.FC<ReferenceSlotCardProps> = ({
  slot,
  referenceData,
  onChange,
  index,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentRef: UploadedReference = referenceData || {
    slotId: slot.id,
    previewUrl: '',
    fabricType: '',
    colorHex: '#0a5c36',
    colorName: '',
    customNotes: '',
    aspectImportance: 'strict',
  };

  const onFileSelectFromDrive = (file: File, previewUrl: string) => {
    onChange(slot.id, {
      ...currentRef,
      file,
      previewUrl,
    });
  };

  const { openPicker } = useGooglePicker(onFileSelectFromDrive);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(slot.id, {
          ...currentRef,
          file,
          previewUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onChange(slot.id, {
      ...currentRef,
      file: undefined,
      previewUrl: '',
    });
  };

  const handleColorSelect = (palette: { name: string; hex: string }) => {
    onChange(slot.id, {
      ...currentRef,
      colorHex: palette.hex,
      colorName: palette.name,
    });
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative group">
      {/* Header of the Reference Slot */}
      <div className="flex items-start justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center justify-center">
              {index + 1}
            </span>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {slot.name}
            </h3>
            {slot.required ? (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                Key Reference
              </span>
            ) : (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {slot.description}
          </p>
        </div>
      </div>

      {/* Grid: Left Column for Image Upload / Preview, Right Column for Specifics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Upload Box / Image Preview (5 columns) */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          {currentRef.previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950 aspect-[4/3] flex items-center justify-center group/preview">
              <img
                src={currentRef.previewUrl}
                alt={slot.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/90 hover:bg-white text-zinc-900 rounded-md backdrop-blur-sm transition-all"
                >
                  Change Photo
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1 text-rose-300 hover:text-white bg-rose-900/80 hover:bg-rose-700 rounded-md backdrop-blur-sm transition-all"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-semibold flex items-center gap-1 shadow">
                <Check className="w-3 h-3" /> Attached
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-400 bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 rounded-xl p-4 aspect-[4/3] flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-2 shadow-inner">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Click or Drop {slot.shortLabel} Photo
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  PNG, JPG, WebP up to 10MB
                </p>
              </div>
              <button
                type="button"
                onClick={openPicker}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors shadow-sm"
              >
                <Cloud className="w-4 h-4 text-blue-500" />
                Select from Google Drive
              </button>
            </div>
          )}

          {/* Adherence Weight */}
          <div className="mt-3 flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800/60 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-amber-500" />
              AI Precision:
            </span>
            <div className="flex gap-1">
              {(['strict', 'high', 'medium'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChange(slot.id, { ...currentRef, aspectImportance: mode })}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium transition-all ${
                    currentRef.aspectImportance === mode
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  {mode === 'strict' ? '100% Clone' : mode === 'high' ? 'High Fidelity' : 'Creative'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Fabric, Color & Design Prompting (7 columns) */}
        <div className="md:col-span-7 flex flex-col gap-3">
          {/* Fabric Type Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-500" />
              Fabric Material & Weave
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={currentRef.fabricType}
                onChange={(e) => onChange(slot.id, { ...currentRef, fabricType: e.target.value })}
                placeholder="e.g. Pure Kanchipuram Silk / Velvet / Organza"
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onChange(slot.id, { ...currentRef, fabricType: e.target.value });
                  }
                }}
                defaultValue=""
                className="text-xs px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 focus:outline-none"
              >
                <option value="" disabled>Presets ▾</option>
                {FABRIC_PRESETS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Selection & Swatches */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <Palette className="w-3 h-3 text-rose-500" />
                Base Color & Shade
              </label>
              {currentRef.colorName && (
                <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {currentRef.colorName}
                </span>
              )}
            </div>
            
            {/* Quick Palette Chips */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {COLOR_PALETTES.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`w-5 h-5 rounded-full border transition-all ${
                    currentRef.colorHex === color.hex
                      ? 'scale-125 ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-zinc-900 border-white'
                      : 'border-black/20 hover:scale-110 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
              ))}
              {/* Custom color input */}
              <input
                type="color"
                value={currentRef.colorHex || '#0a5c36'}
                onChange={(e) => onChange(slot.id, { ...currentRef, colorHex: e.target.value })}
                className="w-5 h-5 rounded-full cursor-pointer bg-transparent border-0"
                title="Pick custom hex color"
              />
            </div>

            <input
              type="text"
              value={currentRef.colorName}
              onChange={(e) => onChange(slot.id, { ...currentRef, colorName: e.target.value })}
              placeholder="e.g. Royal Emerald Green with Antique Gold Zari"
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Exact Design Details / Notes Textarea */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Specific Cut, Pattern & Embroidery Notes
              </label>
            </div>
            <textarea
              rows={2}
              value={currentRef.customNotes}
              onChange={(e) => onChange(slot.id, { ...currentRef, customNotes: e.target.value })}
              placeholder={slot.placeholder}
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
