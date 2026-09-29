'use client';

import React from 'react';
import { ModelProfile } from '../types';
import { 
  MODEL_ETHNICITIES, 
  MODEL_HAIRSTYLES, 
  MODEL_MAKEUP_STYLES, 
  MODEL_JEWELRY_STYLES 
} from '../utils/constants';
import { User, Sparkles, Heart, Crown, Gem, Smile } from 'lucide-react';

interface ModelStudioCustomizerProps {
  model: ModelProfile;
  onChange: (model: ModelProfile) => void;
}

export const ModelStudioCustomizer: React.FC<ModelStudioCustomizerProps> = ({
  model,
  onChange,
}) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              3. AI Human Model & Persona
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Configure real human anatomy, skin realism, hair styling, bridal makeup, and jewelry
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Ethnicity & Look */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            Model Ethnicity & Origin
          </label>
          <select
            value={model.ethnicity}
            onChange={(e) => onChange({ ...model, ethnicity: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {MODEL_ETHNICITIES.map((eth) => (
              <option key={eth.id} value={eth.name}>
                {eth.name} ({eth.desc.slice(0, 45)}...)
              </option>
            ))}
          </select>
        </div>

        {/* Age & Skin Tone */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            Age & Complexion / Skin Tone
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={model.ageRange}
              onChange={(e) => onChange({ ...model, ageRange: e.target.value })}
              placeholder="e.g. 24 years old"
              className="text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <input
              type="text"
              value={model.skinTone}
              onChange={(e) => onChange({ ...model, skinTone: e.target.value })}
              placeholder="e.g. Warm golden honey"
              className="text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Hairstyle */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            Hairstyle & Floral Adornments
          </label>
          <select
            value={model.hairStyle}
            onChange={(e) => onChange({ ...model, hairStyle: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {MODEL_HAIRSTYLES.map((hair) => (
              <option key={hair} value={hair}>{hair}</option>
            ))}
          </select>
        </div>

        {/* Makeup Style */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            Makeup Aesthetic
          </label>
          <select
            value={model.makeupStyle}
            onChange={(e) => onChange({ ...model, makeupStyle: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {MODEL_MAKEUP_STYLES.map((makeup) => (
              <option key={makeup} value={makeup}>{makeup}</option>
            ))}
          </select>
        </div>

        {/* Jewelry Styling */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Gem className="w-3.5 h-3.5 text-amber-500" />
            Jewelry & Accessories
          </label>
          <select
            value={model.jewelryStyle}
            onChange={(e) => onChange({ ...model, jewelryStyle: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {MODEL_JEWELRY_STYLES.map((jewel) => (
              <option key={jewel} value={jewel}>{jewel}</option>
            ))}
          </select>
        </div>

        {/* Expression */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Smile className="w-3.5 h-3.5 text-emerald-500" />
            Facial Mood & Expression
          </label>
          <input
            type="text"
            value={model.expression}
            onChange={(e) => onChange({ ...model, expression: e.target.value })}
            placeholder="e.g. Serene, subtle regal smile, eyes focused on camera"
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
