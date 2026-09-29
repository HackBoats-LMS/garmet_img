export type StockStatus = 'ACTIVE' | 'BILLED' | 'ARCHIVED';

export interface ReferenceSlotData {
  slotId: string;
  label: string;
  url: string;
  notes: string;
}

export interface StockPoseData {
  id?: string;
  poseNumber: number;
  poseName: string;
  imageUrl: string;
  prompt: string;
  createdAt?: string;
}

export interface ModelPersona {
  id: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  skinTone: string;
  features: string;
  promptAnchor: string;
}

export interface PoseDefinition {
  id: string;
  number: number;
  name: string;
  category: 'standing' | 'drape' | 'seated' | 'detail';
  description: string;
  promptSnippet: string;
  defaultSample: string;
}

export interface StockItemData {
  id?: string;
  stockCode: string;
  title: string;
  category: string;
  modelId?: string;
  price?: number;
  mrp?: number;
  rawDescription: string;
  status: StockStatus;
  referenceImages: ReferenceSlotData[];
  poses: StockPoseData[];
  whatsappCopy?: string;
  instagramCopy?: string;
  websiteCopy?: string;
  billedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type WhatsAppTemplateId = 
  | 'luxury_inset'     // 1 Big Hero + 2 Detail Inset Circles + Luxury Footer
  | 'quad_grid'        // 2x2 Quad Grid + Bottom Price/Stock ID Banner
  | 'story_strip'      // 3 Vertical Slices (Full body, Pallu, Blouse) + Gold Brand Footer
  | 'minimalist_card'; // Single Studio Portrait in Elegant Frame with Stock Info

export interface WhatsAppTemplateConfig {
  templateId: WhatsAppTemplateId;
  title: string;
  stockCode: string;
  priceText: string;
  description: string;
  brandName: string;
  accentColor: string;
  assignedSlots: {
    hero?: string;
    slot1?: string;
    slot2?: string;
    slot3?: string;
    slot4?: string;
  };
}

export interface BrandStrategyRules {
  brandName: string;
  tagline: string;
  tone: string;
  keyPhrases: string[];
  fabricQualityClaims: string[];
  whatsappSignature: string;
  instagramHashtags: string[];
}
