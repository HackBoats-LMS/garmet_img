export type GarmentCategory = 
  | 'saree'
  | 'kurti'
  | 'lehenga'
  | 'salwar_suit'
  | 'western_dress'
  | 'coord_set';

export interface ReferenceSlot {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  required?: boolean;
}

export interface GarmentConfig {
  id: GarmentCategory;
  name: string;
  subtitle: string;
  icon: string;
  description: string;
  defaultFabric: string;
  slots: ReferenceSlot[];
}

export interface UploadedReference {
  slotId: string;
  file?: File;
  previewUrl: string;
  fabricType: string;
  colorHex: string;
  colorName: string;
  customNotes: string;
  aspectImportance: 'high' | 'medium' | 'strict';
}

export interface ModelProfile {
  ethnicity: string;
  ageRange: string;
  skinTone: string;
  hairStyle: string;
  makeupStyle: string;
  jewelryStyle: string;
  expression: string;
}

export interface PoseSetting {
  id: string;
  name: string;
  description: string;
  cameraAngle: string;
  shotType: 'full_body' | 'three_quarter' | 'close_up' | 'dynamic';
}

export interface BackgroundSetting {
  id: string;
  name: string;
  type: 'studio' | 'heritage' | 'nature' | 'modern' | 'minimal' | 'festive';
  description: string;
  lightingType: string;
  ambiance: string;
  previewBg: string;
}

export interface GenerationSettings {
  aspectRatio: '9:16' | '3:4' | '1:1' | '16:9';
  aiEngine: 'midjourney' | 'flux_pro' | 'sdxl' | 'imagen_3';
  stylizeLevel: number; // 0 - 1000
  qualityMode: '4K_UHD' | '8K_Hyperreal' | 'Cinematic_Fashion';
  enhanceSkinTexture: boolean;
  enhanceFabricWeave: boolean;
  depthOfField: 'soft_bokeh' | 'crisp_studio' | 'cinematic';
  promptWeightGarment: number; // 1 - 2
}

export interface GeneratedShowcase {
  id: string;
  timestamp: number;
  garmentCategory: GarmentCategory;
  title: string;
  imageUrl: string;
  masterPrompt: string;
  negativePrompt: string;
  modelConfig: ModelProfile;
  pose: string;
  background: string;
  fabricSummary: string;
  referenceImages: { slotName: string; url: string }[];
}
