'use client';

import React from 'react';
import { PoseSetting, BackgroundSetting, GenerationSettings } from '../types';
import { POSE_PRESETS, BACKGROUND_SETTINGS } from '../utils/constants';
import { Camera, Sun, Sparkles, Check, Ratio } from 'lucide-react';

interface PoseAndEnvironmentSelectorProps {
  selectedPose: PoseSetting;
  onSelectPose: (pose: PoseSetting) => void;
  selectedBackground: BackgroundSetting;
  onSelectBackground: (bg: BackgroundSetting) => void;
  settings: GenerationSettings;
  onUpdateSettings: (settings: GenerationSettings) => void;
}

export const PoseAndEnvironmentSelector: React.FC<PoseAndEnvironmentSelectorProps> = ({
  selectedPose,
  onSelectPose,
  selectedBackground,
  onSelectBackground,
  settings,
  onUpdateSettings,
}) => {
  const aspectRatios: { id: GenerationSettings['aspectRatio']; label: string; ratio: string }[] = [
    { id: '3:4', label: 'Catalog Standard', ratio: '3:4' },
    { id: '9:16', label: 'Story / Reel', ratio: '9:16' },
    { id: '1:1', label: 'E-com Square', ratio: '1:1' },
    { id: '16:9', label: 'Hero Banner', ratio: '16:9' },
  ];

  return (
    <div className="space-y-4">
      {/* 4. Pose Selection */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                4. Model Pose & Camera Angle
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose how the model showcases the garment drape, border, and fit
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {POSE_PRESETS.map((pose) => {
            const isSelected = selectedPose.id === pose.id;
            return (
              <button
                key={pose.id}
                type="button"
                onClick={() => onSelectPose(pose)}
                className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-600 bg-amber-50/40 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/60 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {pose.name}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {pose.description}
                  </p>
                </div>
                <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-400 font-mono font-medium">
                  {pose.cameraAngle.split(',')[0]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Background & Lighting Setup */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                5. Background Environment & Cinematic Lighting
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Pick an authentic atmosphere (Royal Haveli, Luxury Studio, Sunlit Garden, E-com)
              </p>
            </div>
          </div>

          {/* Aspect Ratio Picker */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <span className="text-[10px] font-semibold text-zinc-500 px-1.5 flex items-center gap-1">
              <Ratio className="w-3 h-3" /> Ratio:
            </span>
            {aspectRatios.map((ar) => (
              <button
                key={ar.id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, aspectRatio: ar.id })}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition-all ${
                  settings.aspectRatio === ar.id
                    ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {ar.ratio}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BACKGROUND_SETTINGS.map((bg) => {
            const isSelected = selectedBackground.id === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => onSelectBackground(bg)}
                className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/60 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {bg.name}
                    </span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {bg.description}
                  </p>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400 dark:text-zinc-500 truncate max-w-[170px]">
                    {bg.lightingType}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold uppercase text-[9px]">
                    {bg.type}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
