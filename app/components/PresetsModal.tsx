'use client';

import React from 'react';
import { GarmentCategory, UploadedReference, ModelProfile, PoseSetting, BackgroundSetting } from '../types';
import { POSE_PRESETS, BACKGROUND_SETTINGS } from '../utils/constants';
import { X, Sparkles, ArrowRight } from 'lucide-react';

export interface PresetItem {
  id: string;
  title: string;
  category: GarmentCategory;
  tag: string;
  image: string;
  description: string;
  data: {
    category: GarmentCategory;
    references: Record<string, UploadedReference>;
    model: ModelProfile;
    pose: PoseSetting;
    background: BackgroundSetting;
  };
}

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset: (preset: {
    category: GarmentCategory;
    references: Record<string, UploadedReference>;
    model: ModelProfile;
    pose: PoseSetting;
    background: BackgroundSetting;
  }) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset,
}) => {
  if (!isOpen) return null;

  const presets: PresetItem[] = [
    {
      id: 'saree_kanchi',
      title: 'South Indian Kanchipuram Bridal Saree',
      category: 'saree',
      tag: 'Most Popular for Silk Shops',
      image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
      description: 'Emerald green pure silk body with heavy contrast maroon velvet blouse, broad zari pallu border, and temple jewellery.',
      data: {
        category: 'saree',
        references: {
          main_body: {
            slotId: 'main_body',
            previewUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Pure Kanchipuram Silk with Zari',
            colorHex: '#0a5c36',
            colorName: 'Royal Emerald Green',
            customNotes: 'Heavy golden floral butti woven across the body',
            aspectImportance: 'strict',
          },
          pallu_design: {
            slotId: 'pallu_design',
            previewUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Pure Gold Zari Brocade',
            colorHex: '#e1a100',
            colorName: 'Antique Golden Zari',
            customNotes: 'Heavy peacock and floral motifs with broad 8-inch kaddi border',
            aspectImportance: 'strict',
          },
          blouse_design: {
            slotId: 'blouse_design',
            previewUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Rich Velvet with Zardozi Work',
            colorHex: '#780016',
            colorName: 'Deep Crimson Maroon',
            customNotes: 'Elbow-length sleeve with ornate maggam zardozi embroidery and sweetheart neckline',
            aspectImportance: 'strict',
          },
        },
        model: {
          ethnicity: 'South Indian Model',
          ageRange: '24 years old',
          skinTone: 'Warm golden honey tone',
          hairStyle: 'Sleek Low Bun adorned with Fresh Jasmine Gajra & Gold Hairpin',
          makeupStyle: 'Royal Wedding Glam (Defined Kohl eyeliner, warm bronze shimmer, terracotta-rose matte lips)',
          jewelryStyle: 'Antique Temple Gold Necklace with matching Jhumkas & Maang Tikka',
          expression: 'Serene, elegant gentle smile',
        },
        pose: POSE_PRESETS[1], // Pallu showcase
        background: BACKGROUND_SETTINGS[1], // Heritage Haveli
      },
    },
    {
      id: 'kurti_anarkali',
      title: 'Lucknowi Chikankari Anarkali Kurti',
      category: 'kurti',
      tag: 'Trending Designer Kurti',
      image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
      description: 'Pastel powder blue Chanderi silk Anarkali with intricate white threadwork yoke and flowy sheer organza dupatta.',
      data: {
        category: 'kurti',
        references: {
          main_body: {
            slotId: 'main_body',
            previewUrl: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Chanderi Silk / Georgette',
            colorHex: '#e8a598',
            colorName: 'Powder Blush & Sky Blue',
            customNotes: 'Flared floor-length kalidar silhouette with subtle silver foil accents',
            aspectImportance: 'strict',
          },
          yoke_neckline: {
            slotId: 'yoke_neckline',
            previewUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Mulmul Cotton with Chikankari',
            colorHex: '#ebd5b3',
            colorName: 'Ivory White Threadwork',
            customNotes: 'Intricate floral jaal hand embroidery with delicate mirror work on neckline',
            aspectImportance: 'strict',
          },
          dupatta_scarf: {
            slotId: 'dupatta_scarf',
            previewUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Organza with Hand-painted Florals',
            colorHex: '#87a987',
            colorName: 'Pastel Sage Green',
            customNotes: 'Scalloped edges with lightweight flow over model arm',
            aspectImportance: 'high',
          },
        },
        model: {
          ethnicity: 'North Indian / Punjabi Model',
          ageRange: '23 years old',
          skinTone: 'Radiant wheatish complexion',
          hairStyle: 'Voluminous Soft Cascading Waves parted in center',
          makeupStyle: 'Minimal Dewy "Clean Girl" Aesthetic (Glass skin finish, glossy peach lips)',
          jewelryStyle: 'Subtle Luxury Pearl Haar (Basra Pearls) & Delicate Bangles',
          expression: 'Confident, radiant smile',
        },
        pose: POSE_PRESETS[5], // Walking runway
        background: BACKGROUND_SETTINGS[0], // Luxury Studio
      },
    },
    {
      id: 'lehenga_royal',
      title: 'Imperial Crimson Velvet Bridal Lehenga',
      category: 'lehenga',
      tag: 'Grand Bridal Ensemble',
      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
      description: 'Deep crimson velvet lehenga with 16-panel gold zardozi kalis, sweetheart choli, and royal Polki kundan jewellery.',
      data: {
        category: 'lehenga',
        references: {
          main_body: {
            slotId: 'main_body',
            previewUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Rich Velvet with Zardozi Work',
            colorHex: '#780016',
            colorName: 'Deep Crimson Maroon',
            customNotes: 'Heavy antique gold zardozi and kundan work across all 16 kalis',
            aspectImportance: 'strict',
          },
          choli_blouse: {
            slotId: 'choli_blouse',
            previewUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Rich Velvet with Zardozi Work',
            colorHex: '#780016',
            colorName: 'Deep Crimson Maroon',
            customNotes: 'Sweetheart neckline with dense crystal beadwork and elbow sleeves',
            aspectImportance: 'strict',
          },
          dupatta_drape: {
            slotId: 'dupatta_drape',
            previewUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=400&q=80',
            fabricType: 'Sheer French Net with Sequin Glass',
            colorHex: '#ebd5b3',
            colorName: 'Champagne Gold Net',
            customNotes: 'Draped over shoulder with heavy scalloped embroidered border',
            aspectImportance: 'strict',
          },
        },
        model: {
          ethnicity: 'North Indian / Punjabi Model',
          ageRange: '26 years old',
          skinTone: 'Warm golden glowing complexion',
          hairStyle: 'Traditional Long Braid (Jada) with Temple Gold Ornaments',
          makeupStyle: 'Traditional Bridal Perfection (Red bindi, winged eyeliner, golden lid highlighter)',
          jewelryStyle: 'Royal Polki Kundan Choker with Emerald Drop Beads & Matha Patti',
          expression: 'Regal, aristocratic poise',
        },
        pose: POSE_PRESETS[0], // Full body
        background: BACKGROUND_SETTINGS[4], // Festive diwali lights
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-slate-900">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Sample Boutique Garment Presets
              </h3>
              <p className="text-xs text-slate-500">
                Load ready-made garment reference setups with pre-configured fabric swatches and descriptions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-slate-50/70 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-4 sm:p-5 transition-all flex flex-col md:flex-row items-center justify-between gap-4 group shadow-2xs"
            >
              <div className="flex items-center gap-4 w-full md:w-auto">
                <img
                  src={preset.image}
                  alt={preset.title}
                  className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      {preset.tag}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 capitalize">
                      {preset.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-900 mb-1">
                    {preset.title}
                  </h4>
                  <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  onApplyPreset(preset.data);
                  onClose();
                }}
                className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <span>Load This Setup</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
