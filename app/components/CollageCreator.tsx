'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Download, LayoutGrid, Layers, Sparkles, Share2, Copy, Check,
  Image as ImageIcon, Palette, Type, Globe, Smartphone, QrCode,
  Tag, RefreshCw, Eye, CheckCircle2, ChevronDown, Sliders,
  ArrowUp, ArrowDown, ArrowUpDown, Shuffle, RotateCcw,
  Maximize2, Minimize2, ChevronLeft, ChevronRight, Square,
  ZoomIn, ZoomOut, Upload, Trash2, ExternalLink, FileUp
} from 'lucide-react';
import { DEFAULT_BRAND_STRATEGY } from '@/app/utils/brandStrategist';

export interface CollageInputImage {
  id: string;
  url: string;
  poseName?: string;
  label?: string;
}

export interface CollageLayoutConfig {
  id: string;
  name: string;
  imagesCount: number;
  description: string;
  icon: string;
  aspectRatio: number; // width / height
  slots: {
    xRatio: number;
    yRatio: number;
    wRatio: number;
    hRatio: number;
    defaultTag?: string;
    positionLabel?: string;
  }[];
}

export const COLLAGE_LAYOUTS: CollageLayoutConfig[] = [
  // ── 3 IMAGES: EXACT USER REFERENCE LAYOUT ──
  {
    id: 'wholesale_hero_3',
    name: 'Wholesale Hero Trio (Reference Layout)',
    imagesCount: 3,
    description: '1 Large Full-Height Feature on Left + 2 Stacked Photos on Right with SKU Tags',
    icon: '🔲 ▮\n🔲 ▮',
    aspectRatio: 4 / 5, // 0.8 portrait
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.61, hRatio: 1, defaultTag: '298C', positionLabel: 'Hero Left (Full Length)' },
      { xRatio: 0.63, yRatio: 0, wRatio: 0.37, hRatio: 0.49, defaultTag: '298A', positionLabel: 'Top Right (Face / Detail)' },
      { xRatio: 0.63, yRatio: 0.51, wRatio: 0.37, hRatio: 0.49, defaultTag: '298B', positionLabel: 'Bottom Right (Pallu / Swatch)' },
    ],
  },
  // ── 3 IMAGES: MULTI-CARD NESTED (EXACT REFERENCE IMAGE COMPOSITE) ──
  {
    id: 'wholesale_multicard_3',
    name: 'Multi-Card Wholesale Trio (Nested Cards)',
    imagesCount: 3,
    description: 'Exact reference style: 3 individual framed mini catalogue cards (1 Large Left + 2 Stacked Right)',
    icon: '🔲 ▫\n🔲 ▫',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.60, hRatio: 1, defaultTag: '298C', positionLabel: 'Hero Card Left (Full Drape)' },
      { xRatio: 0.62, yRatio: 0, wRatio: 0.38, hRatio: 0.49, defaultTag: '298A', positionLabel: 'Top Right Card' },
      { xRatio: 0.62, yRatio: 0.51, wRatio: 0.38, hRatio: 0.49, defaultTag: '298B', positionLabel: 'Bottom Right Card' },
    ],
  },
  // ── 1 IMAGE: SOLO HERO CATALOGUE COVER ──
  {
    id: 'solo_hero_1',
    name: 'Solo Hero Catalogue Drop (1 Photo)',
    imagesCount: 1,
    description: '1 High-impact full page poster with brand crest, collection badge & wholesale footer',
    icon: '🔲',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 1, hRatio: 1, defaultTag: 'HERO', positionLabel: 'Full Page Featured Drape' },
    ],
  },
  // ── 3 IMAGES: REVERSED HERO TRIO ──
  {
    id: 'wholesale_hero_reversed_3',
    name: 'Reversed Hero Trio (Hero on Right)',
    imagesCount: 3,
    description: '2 Stacked Detail Photos on Left + 1 Large Full-Height Hero Feature on Right',
    icon: '▮ 🔲\n▮ 🔲',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.37, hRatio: 0.49, defaultTag: '298A', positionLabel: 'Top Left Detail' },
      { xRatio: 0.51, yRatio: 0, wRatio: 0.37, hRatio: 0.49, defaultTag: '298B', positionLabel: 'Bottom Left Detail' },
      { xRatio: 0.39, yRatio: 0, wRatio: 0.61, hRatio: 1, defaultTag: '298C', positionLabel: 'Hero Right (Full Length)' },
    ],
  },
  // ── 3 IMAGES: 9:16 WHATSAPP STATUS & STORY TRIO ──
  {
    id: 'story_vertical_trio_3',
    name: 'WhatsApp Status & Story Trio (9:16 Fullscreen)',
    imagesCount: 3,
    description: 'Full vertical phone format: 1 Large Hero on top + 2 detail insets on bottom',
    icon: '  🔲  \n▫   ▫',
    aspectRatio: 9 / 16, // 0.5625
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 1, hRatio: 0.58, defaultTag: 'LOOK', positionLabel: 'Top Featured Drape' },
      { xRatio: 0, yRatio: 0.60, wRatio: 0.49, hRatio: 0.40, defaultTag: 'PALLU', positionLabel: 'Bottom Left (Pallu)' },
      { xRatio: 0.51, yRatio: 0.60, wRatio: 0.49, hRatio: 0.40, defaultTag: 'BLOUSE', positionLabel: 'Bottom Right (Blouse)' },
    ],
  },
  // ── 2 IMAGES: DUO SPLIT ──
  {
    id: 'duo_split_2',
    name: 'Duo Split 50/50',
    imagesCount: 2,
    description: '2 Side-by-side tall vertical panels for Front vs. Back or Mirror view',
    icon: '▮ ▮',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.49, hRatio: 1, defaultTag: 'FRONT', positionLabel: 'Left Panel (Front Look)' },
      { xRatio: 0.51, yRatio: 0, wRatio: 0.49, hRatio: 1, defaultTag: 'BACK', positionLabel: 'Right Panel (Back / Mirror)' },
    ],
  },
  // ── 2 IMAGES: HERO + DETAIL ──
  {
    id: 'duo_hero_detail_2',
    name: 'Hero + Fabric Swatch',
    imagesCount: 2,
    description: '70% Model Drape + 30% Fabric/Pallu close-up strip',
    icon: '🔲 ▯',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.68, hRatio: 1, defaultTag: 'LOOK', positionLabel: 'Main Drape Feature (70%)' },
      { xRatio: 0.70, yRatio: 0, wRatio: 0.30, hRatio: 1, defaultTag: 'SWATCH', positionLabel: 'Fabric Close-up Strip (30%)' },
    ],
  },
  // ── 3 IMAGES: TRIO VERTICAL SLICES ──
  {
    id: 'trio_story_3',
    name: 'Trio Story Slices',
    imagesCount: 3,
    description: '3 Equal vertical panels (Full look, Pallu, Blouse embroidery)',
    icon: '▮ ▮ ▮',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.32, hRatio: 1, defaultTag: 'LOOK', positionLabel: 'Left Panel (Overall Look)' },
      { xRatio: 0.34, yRatio: 0, wRatio: 0.32, hRatio: 1, defaultTag: 'PALLU', positionLabel: 'Center Panel (Pallu Drape)' },
      { xRatio: 0.68, yRatio: 0, wRatio: 0.32, hRatio: 1, defaultTag: 'BLOUSE', positionLabel: 'Right Panel (Blouse / Border)' },
    ],
  },
  // ── 4 IMAGES: ROYAL QUAD 2x2 ──
  {
    id: 'quad_grid_4',
    name: 'Royal Quad 2×2',
    imagesCount: 4,
    description: '4 Balanced quadrants for 4 colorways or 4 standard studio angles',
    icon: '▪ ▪\n▪ ▪',
    aspectRatio: 1, // Square
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.49, hRatio: 0.49, defaultTag: 'POSE 1', positionLabel: 'Top Left Angle' },
      { xRatio: 0.51, yRatio: 0, wRatio: 0.49, hRatio: 0.49, defaultTag: 'POSE 2', positionLabel: 'Top Right Angle' },
      { xRatio: 0, yRatio: 0.51, wRatio: 0.49, hRatio: 0.49, defaultTag: 'POSE 3', positionLabel: 'Bottom Left Angle' },
      { xRatio: 0.51, yRatio: 0.51, wRatio: 0.49, hRatio: 0.49, defaultTag: 'POSE 4', positionLabel: 'Bottom Right Angle' },
    ],
  },
  // ── 4 IMAGES: CATALOGUE 1+3 QUAD ──
  {
    id: 'quad_hero_stack_4',
    name: 'Catalogue 1+3 Quad',
    imagesCount: 4,
    description: '1 Large hero portrait + 3 stacked detail shots on right',
    icon: '🔲 ▪\n🔲 ▪\n🔲 ▪',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.62, hRatio: 1, defaultTag: 'MAIN', positionLabel: 'Hero Feature (Left Full Height)' },
      { xRatio: 0.64, yRatio: 0, wRatio: 0.36, hRatio: 0.32, defaultTag: 'ANGLE', positionLabel: 'Top Right Inset' },
      { xRatio: 0.64, yRatio: 0.34, wRatio: 0.36, hRatio: 0.32, defaultTag: 'BORDER', positionLabel: 'Middle Right Inset' },
      { xRatio: 0.64, yRatio: 0.68, wRatio: 0.36, hRatio: 0.32, defaultTag: 'BLOUSE', positionLabel: 'Bottom Right Inset' },
    ],
  },
  // ── 4 IMAGES: HERO + BOTTOM STRIP ──
  {
    id: 'hero_bottom_strip_4',
    name: 'Hero + 3 Bottom Thumbnails',
    imagesCount: 4,
    description: '1 Wide featured hero photo on top + 3 thumbnails on bottom',
    icon: '  🔲  \n▪ ▪ ▪',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 1, hRatio: 0.65, defaultTag: 'HERO', positionLabel: 'Top Hero Banner' },
      { xRatio: 0, yRatio: 0.67, wRatio: 0.32, hRatio: 0.33, defaultTag: 'SHOT 1', positionLabel: 'Bottom Thumbnail 1' },
      { xRatio: 0.34, yRatio: 0.67, wRatio: 0.32, hRatio: 0.33, defaultTag: 'SHOT 2', positionLabel: 'Bottom Thumbnail 2' },
      { xRatio: 0.68, yRatio: 0.67, wRatio: 0.32, hRatio: 0.33, defaultTag: 'SHOT 3', positionLabel: 'Bottom Thumbnail 3' },
    ],
  },
  // ── 5 IMAGES: EDITORIAL MOSAIC 5 ──
  {
    id: 'editorial_mosaic_5',
    name: 'Editorial Mosaic 5',
    imagesCount: 5,
    description: '1 Hero model portrait on left + 4 detailed insets (2×2) on right',
    icon: '🔲 ▪▪\n🔲 ▪▪',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.55, hRatio: 1, defaultTag: 'HERO', positionLabel: 'Hero Portrait (Left)' },
      { xRatio: 0.57, yRatio: 0, wRatio: 0.205, hRatio: 0.49, defaultTag: '01', positionLabel: 'Top Center-Right 1' },
      { xRatio: 0.795, yRatio: 0, wRatio: 0.205, hRatio: 0.49, defaultTag: '02', positionLabel: 'Top Far-Right 2' },
      { xRatio: 0.57, yRatio: 0.51, wRatio: 0.205, hRatio: 0.49, defaultTag: '03', positionLabel: 'Bottom Center-Right 3' },
      { xRatio: 0.795, yRatio: 0.51, wRatio: 0.205, hRatio: 0.49, defaultTag: '04', positionLabel: 'Bottom Far-Right 4' },
    ],
  },
  // ── 6 IMAGES: WHOLESALE 6-PACK GRID ──
  {
    id: 'wholesale_six_pack_6',
    name: 'Wholesale 6-Pack Grid (Set of 6)',
    imagesCount: 6,
    description: '3 Columns × 2 Rows: Standard catalog wholesale booking sheet for 6 designs/colors',
    icon: '▪ ▪ ▪\n▪ ▪ ▪',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 01', positionLabel: 'Top Left (01)' },
      { xRatio: 0.34, yRatio: 0, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 02', positionLabel: 'Top Center (02)' },
      { xRatio: 0.68, yRatio: 0.32, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 03', positionLabel: 'Top Right (03)' },
      { xRatio: 0, yRatio: 0.51, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 04', positionLabel: 'Bottom Left (04)' },
      { xRatio: 0.34, yRatio: 0.51, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 05', positionLabel: 'Bottom Center (05)' },
      { xRatio: 0.68, yRatio: 0.51, wRatio: 0.32, hRatio: 0.49, defaultTag: 'SET 06', positionLabel: 'Bottom Right (06)' },
    ],
  },
  // ── 6 IMAGES: DELUXE SHOWCASE 6 ──
  {
    id: 'deluxe_showcase_6',
    name: 'Deluxe Showcase 6',
    imagesCount: 6,
    description: '2 Featured full-length poses on top + 4 detail thumbnails across bottom',
    icon: '🔲 🔲\n▪ ▪ ▪ ▪',
    aspectRatio: 4 / 5,
    slots: [
      { xRatio: 0, yRatio: 0, wRatio: 0.49, hRatio: 0.62, defaultTag: 'FEATURE 1', positionLabel: 'Top Feature Left' },
      { xRatio: 0.51, yRatio: 0, wRatio: 0.49, hRatio: 0.62, defaultTag: 'FEATURE 2', positionLabel: 'Top Feature Right' },
      { xRatio: 0, yRatio: 0.64, wRatio: 0.235, hRatio: 0.36, defaultTag: 'A', positionLabel: 'Bottom Thumbnail A' },
      { xRatio: 0.255, yRatio: 0.64, wRatio: 0.235, hRatio: 0.36, defaultTag: 'B', positionLabel: 'Bottom Thumbnail B' },
      { xRatio: 0.51, yRatio: 0.64, wRatio: 0.235, hRatio: 0.36, defaultTag: 'C', positionLabel: 'Bottom Thumbnail C' },
      { xRatio: 0.765, yRatio: 0.64, wRatio: 0.235, hRatio: 0.36, defaultTag: 'D', positionLabel: 'Bottom Thumbnail D' },
    ],
  },
];

export const COLOR_THEMES = [
  {
    id: 'boutique_cream',
    name: 'Wholesale Linen (Reference Style)',
    bgColor: '#f4f1ea',
    cardBorderColor: '#c9baa9',
    frameBorderColor: '#bfae9b',
    textColor: '#1a1918',
    subTextColor: '#57524c',
    badgeBg: '#ffffff',
    badgeText: '#1a1918',
    brandBadgeBg: '#ffffff',
    brandBadgeText: '#1a1918',
    accentColor: '#8a2b2b',
  },
  {
    id: 'royal_obsidian',
    name: 'Royal Obsidian & Gold',
    bgColor: '#0c0c0e',
    cardBorderColor: '#d4af37',
    frameBorderColor: '#3a3424',
    textColor: '#f5f5f5',
    subTextColor: '#a09985',
    badgeBg: '#1c1b1f',
    badgeText: '#d4af37',
    brandBadgeBg: '#d4af37',
    brandBadgeText: '#0c0c0e',
    accentColor: '#d4af37',
  },
  {
    id: 'ivory_bridal',
    name: 'Ivory Champagne & Rose',
    bgColor: '#faf7f2',
    cardBorderColor: '#c99a6b',
    frameBorderColor: '#e0d5c3',
    textColor: '#2d251e',
    subTextColor: '#7a6a5d',
    badgeBg: '#ffffff',
    badgeText: '#2d251e',
    brandBadgeBg: '#2d251e',
    brandBadgeText: '#faf7f2',
    accentColor: '#963d3d',
  },
  {
    id: 'studio_clean',
    name: 'Minimalist Clean White',
    bgColor: '#ffffff',
    cardBorderColor: '#e2e8f0',
    frameBorderColor: '#cbd5e1',
    textColor: '#0f172a',
    subTextColor: '#64748b',
    badgeBg: '#f8fafc',
    badgeText: '#0f172a',
    brandBadgeBg: '#0f172a',
    brandBadgeText: '#ffffff',
    accentColor: '#ee5a29',
  },
];

interface Props {
  images: CollageInputImage[];
  productName?: string;
  stockCode?: string;
  designNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CollageCreator({
  images,
  productName = 'Luxury Indian Handloom Garment',
  stockCode = '',
  designNumber = '',
  isOpen,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-select template matching initial images count if possible
  const initialLayout = useMemo(() => {
    return COLLAGE_LAYOUTS.find((l) => l.imagesCount === images.length) || COLLAGE_LAYOUTS[0];
  }, [images.length]);

  // Layout & Theme State
  const [selectedLayout, setSelectedLayout] = useState<CollageLayoutConfig>(initialLayout);
  const [selectedTheme, setSelectedTheme] = useState(COLOR_THEMES[0]);
  const [assignedImages, setAssignedImages] = useState<(CollageInputImage | null)[]>([]);
  const [slotTags, setSlotTags] = useState<string[]>([]);

  // Format & Layout Options
  const [aspectRatioFormat, setAspectRatioFormat] = useState<'default' | '4:5' | '9:16' | '1:1'>('default');
  const [cardFrameStyle, setCardFrameStyle] = useState<'classic' | 'multicard' | 'minimal'>('classic');
  const [imageFitMode, setImageFitMode] = useState<'cover' | 'fit'>('cover');

  // Full View State (Collapse sidebar / Fullscreen modal / Zoom)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState<number>(1);

  // Brand / Marketing Elements State (Pre-populated from files & product)
  const defaultCollectionTitle = (designNumber || stockCode || productName).toUpperCase();
  const [brandName, setBrandName] = useState(DEFAULT_BRAND_STRATEGY.brandName);
  const [tagline, setTagline] = useState('THE SIMPLE THINGS TO LUXURY COUTURE');
  const [collectionTitle, setCollectionTitle] = useState(defaultCollectionTitle);
  const [sideText, setSideText] = useState('Premium handloom silks');
  const [websiteUrl, setWebsiteUrl] = useState('www.rgjdass.com');
  const [instagramHandle, setInstagramHandle] = useState('@rgjdasscouture');
  const [trustSealText, setTrustSealText] = useState('Silk Mark Certified • Pure Handloom');

  // Brand Logo & Cloudflare Storage
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>('');
  const [useCustomLogo, setUseCustomLogo] = useState<boolean>(true);
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [skuPrefixInput, setSkuPrefixInput] = useState<string>('');
  const [slotTagsCache, setSlotTagsCache] = useState<string[]>([]);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Decorative Toggles
  const [showTagline, setShowTagline] = useState(true);
  const [showBrandCrest, setShowBrandCrest] = useState(true);
  const [showCollectionPill, setShowCollectionPill] = useState(true);
  const [showSkuTags, setShowSkuTags] = useState(true);
  const [showFooterBar, setShowFooterBar] = useState(true);
  const [showSideText, setShowSideText] = useState(true);
  const [showCornerFrame, setShowCornerFrame] = useState(true);

  // Export resolution
  const [exportResolution, setExportResolution] = useState<'standard' | 'high' | 'ultra'>('high');

  // UI state
  const [isRendering, setIsRendering] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'images' | 'text'>('templates');

  // Load persistent brand settings & customized tags on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedRaw = localStorage.getItem('couture_collage_brand_settings');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved.brandName !== undefined) setBrandName(saved.brandName);
        if (saved.brandLogoUrl !== undefined) setBrandLogoUrl(saved.brandLogoUrl);
        if (saved.useCustomLogo !== undefined) setUseCustomLogo(saved.useCustomLogo);
        if (saved.tagline !== undefined) setTagline(saved.tagline);
        if (saved.collectionTitle) setCollectionTitle(saved.collectionTitle);
        if (saved.sideText !== undefined) setSideText(saved.sideText);
        if (saved.websiteUrl !== undefined) setWebsiteUrl(saved.websiteUrl);
        if (saved.instagramHandle !== undefined) setInstagramHandle(saved.instagramHandle);
        if (saved.trustSealText !== undefined) setTrustSealText(saved.trustSealText);
        if (saved.showTagline !== undefined) setShowTagline(saved.showTagline);
        if (saved.showBrandCrest !== undefined) setShowBrandCrest(saved.showBrandCrest);
        if (saved.showCollectionPill !== undefined) setShowCollectionPill(saved.showCollectionPill);
        if (saved.showSkuTags !== undefined) setShowSkuTags(saved.showSkuTags);
        if (saved.showFooterBar !== undefined) setShowFooterBar(saved.showFooterBar);
        if (saved.showSideText !== undefined) setShowSideText(saved.showSideText);
        if (saved.showCornerFrame !== undefined) setShowCornerFrame(saved.showCornerFrame);
      }

      const savedTagsRaw = localStorage.getItem('couture_collage_slot_tags');
      if (savedTagsRaw) {
        const parsedTags = JSON.parse(savedTagsRaw);
        if (Array.isArray(parsedTags) && parsedTags.length > 0) {
          setSlotTagsCache(parsedTags);
        }
      }
    } catch (e) {
      console.warn('Failed to load collage brand settings:', e);
    }
  }, []);

  // Save brand settings to localStorage whenever any brand attribute changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const settingsToSave = {
      brandName,
      brandLogoUrl,
      useCustomLogo,
      tagline,
      collectionTitle,
      sideText,
      websiteUrl,
      instagramHandle,
      trustSealText,
      showTagline,
      showBrandCrest,
      showCollectionPill,
      showSkuTags,
      showFooterBar,
      showSideText,
      showCornerFrame,
    };
    try {
      localStorage.setItem('couture_collage_brand_settings', JSON.stringify(settingsToSave));
    } catch (e) {
      console.warn('Failed to save collage brand settings:', e);
    }
  }, [
    brandName,
    brandLogoUrl,
    useCustomLogo,
    tagline,
    collectionTitle,
    sideText,
    websiteUrl,
    instagramHandle,
    trustSealText,
    showTagline,
    showBrandCrest,
    showCollectionPill,
    showSkuTags,
    showFooterBar,
    showSideText,
    showCornerFrame,
  ]);

  // Upload logo to Cloudflare R2
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Logo file size exceeds 15MB. Please choose a smaller image.');
      return;
    }

    setUploadingLogo(true);
    setLogoUploadError(null);

    try {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64Data,
          customFolder: 'coutureai/brand/logos',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error('Upload succeeded but no image URL was returned.');
      }

      setBrandLogoUrl(data.url);
      setUseCustomLogo(true);
      setShowBrandCrest(true);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setLogoUploadError(err.message || 'Failed to upload logo to Cloudflare.');
    } finally {
      setUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveLogo = () => {
    setBrandLogoUrl('');
    setUseCustomLogo(false);
  };

  const handleUpdateSlotTag = (idx: number, newTag: string) => {
    setSlotTags((prev) => {
      const updated = [...prev];
      updated[idx] = newTag;
      return updated;
    });
    setSlotTagsCache((prev) => {
      const updated = [...prev];
      updated[idx] = newTag;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('couture_collage_slot_tags', JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  };

  const handleApplySkuPrefix = (prefix: string) => {
    if (!prefix.trim()) return;
    const cleanPrefix = prefix.trim();
    const updatedTags = selectedLayout.slots.map((_, i) => `${cleanPrefix}${String.fromCharCode(65 + i)}`);
    setSlotTags(updatedTags);
    setSlotTagsCache((prev) => {
      const merged = [...prev];
      updatedTags.forEach((tag, i) => {
        merged[i] = tag;
      });
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('couture_collage_slot_tags', JSON.stringify(merged));
        } catch {}
      }
      return merged;
    });
  };

  const handleResetBrandDefaults = () => {
    if (confirm('Reset all brand identity settings, logo and tags back to factory defaults?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('couture_collage_brand_settings');
        localStorage.removeItem('couture_collage_slot_tags');
      }
      setBrandName(DEFAULT_BRAND_STRATEGY.brandName);
      setBrandLogoUrl('');
      setUseCustomLogo(false);
      setTagline('THE SIMPLE THINGS TO LUXURY COUTURE');
      setCollectionTitle(defaultCollectionTitle);
      setSideText('Premium handloom silks');
      setWebsiteUrl('www.rgjdass.com');
      setInstagramHandle('@rgjdasscouture');
      setTrustSealText('Silk Mark Certified • Pure Handloom');
      setShowTagline(true);
      setShowBrandCrest(true);
      setShowCollectionPill(true);
      setShowSkuTags(true);
      setShowFooterBar(true);
      setShowSideText(true);
      setShowCornerFrame(true);
      setSlotTagsCache([]);
      setSlotTags(selectedLayout.slots.map((s, i) => s.defaultTag || `${stockCode || 'SKU'}-${String.fromCharCode(65 + i)}`));
    }
  };

  // Effective Aspect Ratio
  const activeAspectRatio = useMemo(() => {
    if (aspectRatioFormat === '4:5') return 4 / 5;
    if (aspectRatioFormat === '9:16') return 9 / 16;
    if (aspectRatioFormat === '1:1') return 1;
    return selectedLayout.aspectRatio;
  }, [aspectRatioFormat, selectedLayout.aspectRatio]);

  // Auto-initialize assigned images & SKU tags whenever layout or source images change
  useEffect(() => {
    const slotsCount = selectedLayout.slots.length;
    setAssignedImages((prev) => {
      const next: (CollageInputImage | null)[] = [];
      for (let i = 0; i < slotsCount; i++) {
        next.push(prev[i] !== undefined ? prev[i] : (images[i] || null));
      }
      return next;
    });

    setSlotTags((prev) => {
      const nextTags: string[] = [];
      for (let i = 0; i < slotsCount; i++) {
        if (prev[i]) {
          nextTags.push(prev[i]);
        } else if (slotTagsCache[i]) {
          nextTags.push(slotTagsCache[i]);
        } else {
          const defaultTag = selectedLayout.slots[i].defaultTag || `${stockCode || 'SKU'}-${String.fromCharCode(65 + i)}`;
          nextTags.push(defaultTag);
        }
      }
      return nextTags;
    });
  }, [selectedLayout, images, stockCode, slotTagsCache]);

  // Robust cross-origin image loader that routes through local /api/proxy-image on any error
  const loadSafeImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('Empty URL'));
      const img = new Image();
      img.crossOrigin = 'anonymous';

      let triedProxy = false;

      img.onload = () => resolve(img);
      img.onerror = () => {
        if (!triedProxy && !url.startsWith('data:') && !url.startsWith('/')) {
          triedProxy = true;
          // Fallback through proxy
          img.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        } else {
          reject(new Error(`Failed to load image: ${url}`));
        }
      };

      img.src = url;
    });
  }, []);

  // ── CORE CANVAS ENGINE ──
  const drawCollageToCanvas = useCallback(async (
    targetCanvas: HTMLCanvasElement,
    canvasW: number,
    canvasH: number
  ) => {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    targetCanvas.width = canvasW;
    targetCanvas.height = canvasH;

    const theme = selectedTheme;
    const layout = selectedLayout;

    // 1. Draw Master Background
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Generous breathing margins so nothing is ever clipped
    const marginX = canvasW * 0.055;
    const marginTop = showTagline ? canvasH * 0.08 : canvasH * 0.05;
    const marginBottom = showFooterBar ? canvasH * 0.09 : canvasH * 0.05;

    const contentW = canvasW - (marginX * 2);
    const contentH = canvasH - marginTop - marginBottom;

    // Preload Images
    const loadedImages: (HTMLImageElement | null)[] = await Promise.all(
      assignedImages.map(async (slot) => {
        if (!slot?.url) return null;
        try {
          return await loadSafeImage(slot.url);
        } catch {
          return null;
        }
      })
    );

    // Preload Custom Brand Logo if enabled
    let loadedLogo: HTMLImageElement | null = null;
    if (useCustomLogo && brandLogoUrl) {
      try {
        loadedLogo = await loadSafeImage(brandLogoUrl);
      } catch (err) {
        console.warn('Failed to load custom brand logo:', err);
      }
    }

    // ── SPECIAL RENDERING: MULTI-CARD NESTED COMPOSITE (EXACT USER REFERENCE IMAGE) ──
    const isMultiCardMode = layout.id === 'wholesale_multicard_3' || cardFrameStyle === 'multicard';
    if (isMultiCardMode) {
      for (let i = 0; i < layout.slots.length; i++) {
        const slot = layout.slots[i];
        const img = loadedImages[i];

        const cardX = marginX + (slot.xRatio * contentW);
        const cardY = marginTop + (slot.yRatio * contentH);
        const cardW = slot.wRatio * contentW;
        const cardH = slot.hRatio * contentH;

        ctx.save();
        // 1. Card Background
        ctx.fillStyle = theme.badgeBg;
        ctx.strokeStyle = theme.cardBorderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, Math.round(canvasW * 0.018));
        ctx.fill();
        ctx.stroke();

        // 2. Card Content Padding
        const cPadX = cardW * 0.045;
        const cTopY = cardH * 0.08;
        const cBotY = cardH * 0.085;
        const photoX = cardX + cPadX;
        const photoY = cardY + cTopY;
        const photoW = cardW - (cPadX * 2);
        const photoH = cardH - cTopY - cBotY;

        // 3. Mini Top tagline rule inside card
        if (showTagline && tagline) {
          const mTopY = cardY + (cTopY * 0.45);
          ctx.font = `600 ${Math.round(cardW * 0.026)}px "Montserrat", sans-serif`;
          ctx.fillStyle = theme.subTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagline.toUpperCase(), cardX + cardW / 2, mTopY);
        }

        // 4. Photo inside card
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoW, photoH, Math.round(cardW * 0.022));
        ctx.clip();

        if (img) {
          const imgRatio = img.width / img.height;
          const slotRatio = photoW / photoH;

          if (imageFitMode === 'fit') {
            // Fit uncropped photo
            let dw = photoW, dh = photoH, dx = photoX, dy = photoY;
            if (imgRatio > slotRatio) {
              dh = photoW / imgRatio;
              dy = photoY + (photoH - dh) / 2;
            } else {
              dw = photoH * imgRatio;
              dx = photoX + (photoW - dw) / 2;
            }
            ctx.fillStyle = theme.badgeBg;
            ctx.fillRect(photoX, photoY, photoW, photoH);
            ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
          } else {
            // Fill slot
            let sx = 0, sy = 0, sw = img.width, sh = img.height;
            if (imgRatio > slotRatio) {
              sw = img.height * slotRatio;
              sx = (img.width - sw) / 2;
            } else {
              sh = img.width / slotRatio;
              sy = (img.height - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
          }
        } else {
          ctx.fillStyle = theme.frameBorderColor + '40';
          ctx.fillRect(photoX, photoY, photoW, photoH);
        }
        ctx.restore();

        // 5. Card Brand Logo / Oval Crest (top right of photo)
        if (showBrandCrest) {
          if (useCustomLogo && loadedLogo) {
            const maxW = Math.round(cardW * 0.28);
            const maxH = Math.round(cardH * 0.065);
            const logoAspect = loadedLogo.width / loadedLogo.height;
            let drawW = maxW;
            let drawH = drawW / logoAspect;
            if (drawH > maxH) {
              drawH = maxH;
              drawW = drawH * logoAspect;
            }
            const padX = Math.round(drawW * 0.08);
            const padY = Math.round(drawH * 0.08);
            const lX = photoX + photoW - drawW - (cardW * 0.02);
            const lY = photoY + (cardH * 0.015);

            ctx.save();
            ctx.fillStyle = theme.badgeBg + 'f0';
            ctx.strokeStyle = theme.cardBorderColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(lX - padX, lY - padY, drawW + (padX * 2), drawH + (padY * 2), Math.round((drawH + padY * 2) * 0.25));
            ctx.fill();
            ctx.stroke();

            ctx.drawImage(loadedLogo, lX, lY, drawW, drawH);
            ctx.restore();
          } else if (brandName) {
            const cX = photoX + photoW - (cardW * 0.16);
            const cY = photoY + (cardH * 0.05);
            const rX = Math.round(cardW * 0.11);
            const rY = Math.round(cardH * 0.028);

            ctx.save();
            ctx.fillStyle = theme.brandBadgeBg;
            ctx.strokeStyle = theme.cardBorderColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(cX, cY, rX, rY, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.font = `bold ${Math.round(cardW * 0.03)}px "Montserrat", serif`;
            ctx.fillStyle = theme.brandBadgeText;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(brandName.split(' ')[0].toLowerCase(), cX, cY);
            ctx.restore();
          }
        }

        // 6. Card Left Cursive Script
        if (showSideText && sideText) {
          ctx.save();
          ctx.translate(cardX + (cPadX * 0.5), photoY + (photoH * 0.5));
          ctx.rotate(-Math.PI / 2);
          ctx.font = `italic 500 ${Math.round(cardW * 0.032)}px "Playfair Display", serif`;
          ctx.fillStyle = theme.subTextColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sideText, 0, 0);
          ctx.restore();
        }

        // 7. SKU Badge (bottom right corner of photo)
        if (showSkuTags && slotTags[i]) {
          const badgeText = slotTags[i];
          const bSize = Math.round(cardW * 0.036);
          ctx.font = `bold ${bSize}px "Montserrat", monospace`;
          const bMet = ctx.measureText(badgeText);
          const bW = bMet.width + (bSize * 1.2);
          const bH = bSize * 1.8;
          const bx = photoX + photoW - bW - (cardW * 0.02);
          const by = photoY + photoH - bH - (cardH * 0.015);

          ctx.save();
          ctx.fillStyle = theme.badgeBg;
          ctx.strokeStyle = theme.cardBorderColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, bW, bH, Math.round(bH * 0.25));
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = theme.badgeText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + bW / 2, by + bH / 2);
          ctx.restore();
        }

        // 8. Card Collection Pill (bottom right below photo)
        if (showCollectionPill && collectionTitle) {
          const pillW = Math.round(cardW * 0.35);
          const pillH = Math.round(cBotY * 0.65);
          const pillX = cardX + cardW - cPadX - pillW;
          const pillY = cardY + cardH - cBotY + (cBotY - pillH) / 2;

          ctx.save();
          ctx.fillStyle = theme.badgeBg;
          ctx.strokeStyle = theme.cardBorderColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillW, pillH, Math.round(pillH * 0.3));
          ctx.fill();
          ctx.stroke();

          ctx.font = `bold ${Math.round(pillH * 0.45)}px "Montserrat", sans-serif`;
          ctx.fillStyle = theme.textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(collectionTitle.toUpperCase(), pillX + pillW / 2, pillY + pillH / 2);
          ctx.restore();
        }

        // 9. Card Mini Website Footer
        if (showFooterBar && websiteUrl) {
          const footY = cardY + cardH - (cBotY * 0.48);
          ctx.font = `500 ${Math.round(cardW * 0.026)}px "Montserrat", sans-serif`;
          ctx.fillStyle = theme.subTextColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`🌐 ${websiteUrl}`, photoX, footY);
        }
      }
      return;
    }

    // ── STANDARD MASTER SHEET RENDERING ──

    // Decorative Outer Border
    if (showCornerFrame && cardFrameStyle !== 'minimal') {
      ctx.strokeStyle = theme.frameBorderColor;
      ctx.lineWidth = Math.max(1, Math.round(canvasW * 0.0012));
      const fPad = marginX * 0.4;
      ctx.strokeRect(fPad, fPad, canvasW - (fPad * 2), canvasH - (fPad * 2));
    }

    // Top Tagline & Divider Line
    if (showTagline && tagline) {
      const topY = marginTop * 0.52;
      ctx.font = `600 ${Math.round(canvasW * 0.016)}px "Montserrat", -apple-system, sans-serif`;
      ctx.fillStyle = theme.subTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const tagText = tagline.toUpperCase();
      const textMetrics = ctx.measureText(tagText);
      const textHalfW = textMetrics.width / 2 + (canvasW * 0.02);

      ctx.strokeStyle = theme.frameBorderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX, topY);
      ctx.lineTo(canvasW / 2 - textHalfW, topY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(canvasW / 2 + textHalfW, topY);
      ctx.lineTo(canvasW - marginX, topY);
      ctx.stroke();

      ctx.fillText(tagText, canvasW / 2, topY);
    }

    // Draw Slot Images
    const cornerRadius = cardFrameStyle === 'minimal' ? 0 : Math.round(canvasW * 0.022);

    for (let i = 0; i < layout.slots.length; i++) {
      const slot = layout.slots[i];
      const img = loadedImages[i];

      const x = marginX + (slot.xRatio * contentW);
      const y = marginTop + (slot.yRatio * contentH);
      const w = slot.wRatio * contentW;
      const h = slot.hRatio * contentH;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, cornerRadius);
      ctx.clip();

      if (img) {
        const imgRatio = img.width / img.height;
        const slotRatio = w / h;

        if (imageFitMode === 'fit') {
          // Fit: Entire uncropped photo is shown without chopping head, saree, or feet!
          let dw = w, dh = h, dx = x, dy = y;
          if (imgRatio > slotRatio) {
            dh = w / imgRatio;
            dy = y + (h - dh) / 2;
          } else {
            dw = h * imgRatio;
            dx = x + (w - dw) / 2;
          }
          ctx.fillStyle = theme.bgColor;
          ctx.fillRect(x, y, w, h);
          ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);
        } else {
          // Cover: Fill slot completely
          let sx = 0, sy = 0, sw = img.width, sh = img.height;
          if (imgRatio > slotRatio) {
            sw = img.height * slotRatio;
            sx = (img.width - sw) / 2;
          } else {
            sh = img.width / slotRatio;
            sy = (img.height - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }
      } else {
        ctx.fillStyle = theme.frameBorderColor + '40';
        ctx.fillRect(x, y, w, h);
        ctx.font = `500 ${Math.round(w * 0.08)}px "Montserrat", sans-serif`;
        ctx.fillStyle = theme.subTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Slot ${i + 1}`, x + w / 2, y + h / 2);
      }

      ctx.restore();

      // Border around photo
      if (cardFrameStyle !== 'minimal') {
        ctx.save();
        ctx.strokeStyle = theme.cardBorderColor;
        ctx.lineWidth = Math.max(1, Math.round(canvasW * 0.0018));
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, cornerRadius);
        ctx.stroke();
        ctx.restore();
      }

      // SKU Tag Badge
      if (showSkuTags && slotTags[i]) {
        const badgeText = slotTags[i];
        const badgeFontSize = Math.round(canvasW * 0.016);
        ctx.font = `bold ${badgeFontSize}px "Montserrat", -apple-system, monospace`;

        const bMetrics = ctx.measureText(badgeText);
        const bPadX = badgeFontSize * 0.8;
        const bPadY = badgeFontSize * 0.5;
        const bW = bMetrics.width + (bPadX * 2);
        const bH = badgeFontSize + (bPadY * 2);

        const bMargin = Math.round(canvasW * 0.012);
        const bx = x + w - bW - bMargin;
        const by = y + h - bH - bMargin;

        ctx.save();
        ctx.fillStyle = theme.badgeBg;
        ctx.strokeStyle = theme.cardBorderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bW, bH, Math.round(bH * 0.2));
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = theme.badgeText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + bW / 2, by + bH / 2);
        ctx.restore();
      }
    }

    // Oval Brand Crest or Custom Logo
    if (showBrandCrest) {
      if (useCustomLogo && loadedLogo) {
        const firstSlot = layout.slots[0];
        const slotRight = marginX + (firstSlot.xRatio * contentW) + (firstSlot.wRatio * contentW);
        const slotTop = marginTop + (firstSlot.yRatio * contentH);

        const maxW = Math.round(canvasW * 0.18);
        const maxH = Math.round(canvasH * 0.06);
        const logoAspect = loadedLogo.width / loadedLogo.height;
        let drawW = maxW;
        let drawH = drawW / logoAspect;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * logoAspect;
        }

        const padX = Math.round(drawW * 0.08);
        const padY = Math.round(drawH * 0.08);
        let lX = slotRight - drawW - (canvasW * 0.025);
        let lY = slotTop + (canvasH * 0.02);

        // Boundary containment
        if (lX + drawW > canvasW - marginX) {
          lX = canvasW - marginX - drawW;
        }
        if (lX < marginX) {
          lX = marginX;
        }

        ctx.save();
        ctx.fillStyle = theme.badgeBg + 'f0';
        ctx.strokeStyle = theme.cardBorderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(lX - padX, lY - padY, drawW + (padX * 2), drawH + (padY * 2), Math.round((drawH + padY * 2) * 0.25));
        ctx.fill();
        ctx.stroke();

        ctx.drawImage(loadedLogo, lX, lY, drawW, drawH);
        ctx.restore();
      } else if (brandName) {
        const firstSlot = layout.slots[0];
        const crestX = marginX + (firstSlot.xRatio * contentW) + (firstSlot.wRatio * contentW) - (canvasW * 0.08);
        const crestY = marginTop + (firstSlot.yRatio * contentH) + (canvasH * 0.045);

        const crestRadiusX = Math.round(canvasW * 0.052);
        const crestRadiusY = Math.round(canvasH * 0.022);

        ctx.save();
        ctx.fillStyle = theme.brandBadgeBg;
        ctx.strokeStyle = theme.cardBorderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(crestX, crestY, crestRadiusX, crestRadiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        const crestFontSize = Math.round(canvasW * 0.015);
        ctx.font = `bold ${crestFontSize}px "Montserrat", serif`;
        ctx.fillStyle = theme.brandBadgeText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const crestDisplay = brandName.split(' ')[0].toLowerCase();
        ctx.fillText(crestDisplay, crestX, crestY);
        ctx.restore();
      }
    }

    // Left Vertical Cursive Script
    if (showSideText && sideText) {
      ctx.save();
      const sX = marginX * 0.65;
      const sY = marginTop + (contentH * 0.55);
      ctx.translate(sX, sY);
      ctx.rotate(-Math.PI / 2);

      ctx.font = `italic 500 ${Math.round(canvasW * 0.014)}px "Playfair Display", Georgia, serif`;
      ctx.fillStyle = theme.subTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sideText, 0, 0);
      ctx.restore();
    }

    // Collection Title Pill (positioned in lower footer margin without overlapping photo)
    if (showCollectionPill && collectionTitle) {
      const pillW = Math.round(canvasW * 0.15);
      const pillH = Math.round(canvasH * 0.038);
      const pillX = canvasW - marginX - pillW;
      const pillY = canvasH - marginBottom + Math.round((marginBottom - pillH) * 0.25);

      ctx.save();
      ctx.fillStyle = theme.badgeBg;
      ctx.strokeStyle = theme.cardBorderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, Math.round(pillH * 0.3));
      ctx.fill();
      ctx.stroke();

      ctx.font = `bold ${Math.round(canvasW * 0.02)}px "Montserrat", -apple-system, sans-serif`;
      ctx.fillStyle = theme.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(collectionTitle.toUpperCase(), pillX + pillW / 2, pillY + pillH / 2);
      ctx.restore();
    }

    // Bottom Wholesale Contact Footer Bar
    if (showFooterBar) {
      const footY = canvasH - (marginBottom * 0.45);
      const footFontSize = Math.round(canvasW * 0.013);
      ctx.font = `500 ${footFontSize}px "Montserrat", -apple-system, sans-serif`;
      ctx.fillStyle = theme.subTextColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      let items: string[] = [];
      if (websiteUrl) items.push(`🌐 ${websiteUrl}`);
      if (instagramHandle) items.push(`📸 ${instagramHandle}`);
      if (trustSealText) items.push(`✓ ${trustSealText}`);

      const footerCombined = items.join('    •    ');
      ctx.fillText(footerCombined, marginX, footY);
    }
  }, [
    selectedLayout,
    selectedTheme,
    assignedImages,
    slotTags,
    brandName,
    tagline,
    collectionTitle,
    sideText,
    websiteUrl,
    instagramHandle,
    trustSealText,
    showTagline,
    showBrandCrest,
    showCollectionPill,
    showSkuTags,
    showFooterBar,
    showSideText,
    showCornerFrame,
    cardFrameStyle,
    imageFitMode,
    loadSafeImage,
    brandLogoUrl,
    useCustomLogo,
  ]);

  // Dimensions based on resolution & format
  const exportDimensions = useMemo(() => {
    let baseW = 1200;
    if (exportResolution === 'standard') baseW = 1080;
    if (exportResolution === 'high') baseW = 1500;
    if (exportResolution === 'ultra') baseW = 2400;

    const baseH = Math.round(baseW / activeAspectRatio);
    return { w: baseW, h: baseH };
  }, [exportResolution, activeAspectRatio]);

  // Redraw preview whenever any visual state changes
  useEffect(() => {
    if (!previewCanvasRef.current || !isOpen) return;

    let isMounted = true;
    const previewW = activeAspectRatio < 0.6 ? 720 : 900;
    const previewH = Math.round(previewW / activeAspectRatio);

    drawCollageToCanvas(previewCanvasRef.current, previewW, previewH).catch((err) => {
      if (isMounted) console.error('Preview render error:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [drawCollageToCanvas, isOpen, activeAspectRatio]);

  // Redraw Fullscreen Lightbox Canvas when open
  useEffect(() => {
    if (!fullscreenCanvasRef.current || !isFullscreenModalOpen) return;
    const fullW = exportDimensions.w;
    const fullH = exportDimensions.h;
    drawCollageToCanvas(fullscreenCanvasRef.current, fullW, fullH).catch(console.error);
  }, [isFullscreenModalOpen, drawCollageToCanvas, exportDimensions]);

  // ── EXPORT ACTIONS ──

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setIsRendering(true);
    try {
      await drawCollageToCanvas(canvasRef.current, exportDimensions.w, exportDimensions.h);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);

      const link = document.createElement('a');
      const safeTitle = (collectionTitle || stockCode || 'catalogue').toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `${safeTitle}_wholesale_sheet_${exportDimensions.w}p.jpg`;
      link.href = dataUrl;
      link.click();

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Download export failed:', err);
      alert('Failed to generate collage download. Please try standard resolution.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!canvasRef.current) return;
    setIsRendering(true);
    try {
      await drawCollageToCanvas(canvasRef.current, 1200, Math.round(1200 / activeAspectRatio));

      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        } catch {
          alert('Direct copy not supported in this browser. Please use "Download HD Catalogue Sheet".');
        } finally {
          setIsRendering(false);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setIsRendering(false);
    }
  };

  // ── INTERACTIVE POSITION AND SLOT HANDLERS ──

  const handleAssignSlot = (slotIdx: number, img: CollageInputImage | null) => {
    setAssignedImages((prev) => {
      const updated = [...prev];
      updated[slotIdx] = img;
      return updated;
    });
  };

  const handleClearSlot = (slotIdx: number) => {
    handleAssignSlot(slotIdx, null);
  };

  const handleSwapSlots = (idxA: number, idxB: number) => {
    setAssignedImages((prev) => {
      const updated = [...prev];
      const temp = updated[idxA];
      updated[idxA] = updated[idxB];
      updated[idxB] = temp;
      return updated;
    });
  };

  const handleMoveSlot = (slotIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? slotIdx - 1 : slotIdx + 1;
    if (targetIdx >= 0 && targetIdx < selectedLayout.slots.length) {
      handleSwapSlots(slotIdx, targetIdx);
    }
  };

  const handleResetToImageOrder = () => {
    const next: (CollageInputImage | null)[] = [];
    for (let i = 0; i < selectedLayout.slots.length; i++) {
      next.push(images[i] || null);
    }
    setAssignedImages(next);
  };

  const handleReversePositions = () => {
    setAssignedImages((prev) => [...prev].reverse());
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] bg-charcoal/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-in font-sans">
        <div className="bg-[#faf7f3] border border-cream-border rounded-3xl w-full max-w-7xl max-h-[96vh] flex flex-col overflow-hidden shadow-2xl text-charcoal">

          {/* ── HEADER BAR ── */}
          <div className="flex items-center justify-between p-4 px-6 border-b border-cream-border shrink-0 bg-white/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-base text-charcoal">Wholesale & Catalogue Collage Studio</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-accent-bg text-accent border border-accent-border">
                    WhatsApp & Print Ready
                  </span>
                </div>
                <p className="text-xs text-charcoal-muted">
                  Create high-conversion wholesale sheets, boutique story collages, and branded catalogue drops
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Full View Button in Header */}
              <button
                type="button"
                onClick={() => {
                  setFullscreenZoom(1);
                  setIsFullscreenModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-cream-border bg-white hover:bg-cream-light text-charcoal font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="View template in full screen"
              >
                <Maximize2 className="w-3.5 h-3.5 text-accent" />
                <span>View Full Screen</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-charcoal-muted hover:text-charcoal hover:bg-cream-dark/40 transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── MAIN WORKSPACE ── */}
          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden relative">

            {/* LEFT COLUMN: CONTROLS & SETTINGS (Can be collapsed for Full View) */}
            <div
              className={`border-b lg:border-b-0 lg:border-r border-cream-border flex flex-col shrink-0 bg-white transition-all duration-300 ${
                isSidebarCollapsed ? 'w-0 lg:w-0 overflow-hidden opacity-0 pointer-events-none' : 'w-full lg:w-[440px] opacity-100'
              }`}
            >
              
              {/* Segmented Tabs Bar */}
              <div className="flex border-b border-cream-border p-2 gap-1.5 shrink-0 bg-cream-light/70">
                <button
                  type="button"
                  onClick={() => setActiveTab('templates')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'templates'
                      ? 'bg-white text-charcoal shadow-xs border border-cream-border/80'
                      : 'text-charcoal-muted hover:text-charcoal hover:bg-white/50'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-accent" />
                  <span>Templates ({COLLAGE_LAYOUTS.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('images')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'images'
                      ? 'bg-white text-charcoal shadow-xs border border-cream-border/80'
                      : 'text-charcoal-muted hover:text-charcoal hover:bg-white/50'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-accent" />
                  <span>Photos ({assignedImages.filter(Boolean).length}/{selectedLayout.slots.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('text')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'text'
                      ? 'bg-white text-charcoal shadow-xs border border-cream-border/80'
                      : 'text-charcoal-muted hover:text-charcoal hover:bg-white/50'
                  }`}
                >
                  <Type className="w-3.5 h-3.5 text-accent" />
                  <span>Brand & Tags</span>
                </button>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#faf7f3]/50">

                {/* ── TAB 1: TEMPLATES & OPTIONS ── */}
                {activeTab === 'templates' && (
                  <>
                    {/* View in Full Action Banner right inside Templates tab */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-3 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
                      <div>
                        <p className="text-xs font-bold text-amber-950">Inspect Layout in Full</p>
                        <p className="text-[10px] text-amber-800">Preview sheet in 100% full scale & high resolution</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFullscreenZoom(1);
                          setIsFullscreenModalOpen(true);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View in Full</span>
                      </button>
                    </div>

                    {/* Template Options: Format & Aspect Ratio Selector */}
                    <div className="bg-white p-3.5 rounded-2xl border border-cream-border space-y-2.5">
                      <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Square className="w-3.5 h-3.5 text-accent" /> Format & Orientation
                        </span>
                        <span className="text-[10px] text-accent font-semibold">Change Canvas Size</span>
                      </h3>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAspectRatioFormat('4:5')}
                          className={`py-2 px-1.5 rounded-xl text-center border text-[11px] font-bold cursor-pointer transition-all ${
                            aspectRatioFormat === '4:5' || (aspectRatioFormat === 'default' && selectedLayout.aspectRatio === 0.8)
                              ? 'bg-accent text-white border-accent shadow-xs'
                              : 'bg-cream-light border-cream-border text-charcoal hover:border-accent/40'
                          }`}
                        >
                          4:5 Sheet
                          <span className="block text-[9px] font-normal opacity-80">WhatsApp HD</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAspectRatioFormat('9:16')}
                          className={`py-2 px-1.5 rounded-xl text-center border text-[11px] font-bold cursor-pointer transition-all ${
                            aspectRatioFormat === '9:16'
                              ? 'bg-accent text-white border-accent shadow-xs'
                              : 'bg-cream-light border-cream-border text-charcoal hover:border-accent/40'
                          }`}
                        >
                          9:16 Story
                          <span className="block text-[9px] font-normal opacity-80">Status / Reels</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAspectRatioFormat('1:1')}
                          className={`py-2 px-1.5 rounded-xl text-center border text-[11px] font-bold cursor-pointer transition-all ${
                            aspectRatioFormat === '1:1'
                              ? 'bg-accent text-white border-accent shadow-xs'
                              : 'bg-cream-light border-cream-border text-charcoal hover:border-accent/40'
                          }`}
                        >
                          1:1 Square
                          <span className="block text-[9px] font-normal opacity-80">Feed / Grid</span>
                        </button>
                      </div>
                    </div>

                    {/* Template Options: Frame & Card Presentation */}
                    <div className="bg-white p-3.5 rounded-2xl border border-cream-border space-y-2">
                      <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-accent" /> Card Presentation Style
                        </span>
                      </h3>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCardFrameStyle('classic')}
                          className={`py-1.5 px-2 rounded-xl text-center border text-[10px] font-bold cursor-pointer transition-all ${
                            cardFrameStyle === 'classic'
                              ? 'bg-accent-bg border-accent text-accent ring-1 ring-accent'
                              : 'bg-cream-light border-cream-border text-charcoal-muted hover:text-charcoal'
                          }`}
                        >
                          Classic Framed
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardFrameStyle('multicard')}
                          className={`py-1.5 px-2 rounded-xl text-center border text-[10px] font-bold cursor-pointer transition-all ${
                            cardFrameStyle === 'multicard'
                              ? 'bg-accent-bg border-accent text-accent ring-1 ring-accent'
                              : 'bg-cream-light border-cream-border text-charcoal-muted hover:text-charcoal'
                          }`}
                        >
                          Multi-Card
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardFrameStyle('minimal')}
                          className={`py-1.5 px-2 rounded-xl text-center border text-[10px] font-bold cursor-pointer transition-all ${
                            cardFrameStyle === 'minimal'
                              ? 'bg-accent-bg border-accent text-accent ring-1 ring-accent'
                              : 'bg-cream-light border-cream-border text-charcoal-muted hover:text-charcoal'
                          }`}
                        >
                          Borderless
                        </button>
                      </div>
                    </div>

                    {/* Color Aesthetics for Canvas Sheet */}
                    <div>
                      <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-accent" /> Sheet Color Aesthetics
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {COLOR_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setSelectedTheme(theme)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                              selectedTheme.id === theme.id
                                ? 'bg-accent-bg border-accent text-charcoal ring-2 ring-accent/30 font-bold'
                                : 'bg-white border-cream-border text-charcoal-muted hover:border-accent/40 hover:bg-cream-light/40'
                            }`}
                          >
                            <div
                              className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-xs"
                              style={{ backgroundColor: theme.bgColor }}
                            />
                            <span className="text-[11px] truncate">{theme.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Template Picker */}
                    <div>
                      <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <LayoutGrid className="w-3.5 h-3.5 text-accent" /> Choose Collage Template
                        </span>
                        <span className="text-[10px] text-charcoal-muted lowercase font-normal">{COLLAGE_LAYOUTS.length} layouts</span>
                      </h3>
                      <div className="space-y-2">
                        {COLLAGE_LAYOUTS.map((layout) => {
                          const isSelected = selectedLayout.id === layout.id;
                          return (
                            <div
                              key={layout.id}
                              className={`w-full p-3 rounded-2xl border transition-all ${
                                isSelected
                                  ? 'bg-accent-bg/70 border-accent text-charcoal ring-2 ring-accent/30 shadow-xs'
                                  : 'bg-white border-cream-border text-charcoal hover:border-accent/40 hover:bg-cream-light/40'
                              }`}
                            >
                              <div
                                onClick={() => setSelectedLayout(layout)}
                                className="cursor-pointer flex items-start gap-3"
                              >
                                <div className="w-10 h-10 rounded-xl bg-cream border border-cream-border flex items-center justify-center font-mono font-bold text-xs text-charcoal shrink-0">
                                  {layout.imagesCount}P
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-charcoal truncate">{layout.name}</p>
                                    <span className="text-[10px] font-semibold text-accent px-1.5 py-0.2 rounded bg-accent-bg border border-accent-border">
                                      {layout.imagesCount} Photos
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-charcoal-muted line-clamp-1 mt-0.5">
                                    {layout.description}
                                  </p>
                                </div>
                              </div>

                              {/* Selected Template Action Row */}
                              {isSelected && (
                                <div className="mt-2.5 pt-2 border-t border-accent/20 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-accent">Active Template</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFullscreenZoom(1);
                                      setIsFullscreenModalOpen(true);
                                    }}
                                    className="text-[10px] font-bold text-white bg-accent hover:bg-accent-hover px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>View in Full</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* ── TAB 2: PHOTO POSITIONS & IMAGE SELECTION ── */}
                {activeTab === 'images' && (
                  <div className="space-y-4">
                    {/* Top Bar with Quick Position Actions */}
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-charcoal uppercase tracking-wider">
                        Assigned Positions ({assignedImages.filter(Boolean).length}/{selectedLayout.slots.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleResetToImageOrder}
                          className="text-[11px] font-semibold text-charcoal-muted hover:text-charcoal px-2 py-1 rounded-lg hover:bg-cream-light transition-colors cursor-pointer border border-cream-border bg-white"
                          title="Fill slots in default 1, 2, 3... order"
                        >
                          ↺ Reset
                        </button>
                        <button
                          type="button"
                          onClick={handleReversePositions}
                          className="text-[11px] font-semibold text-charcoal-muted hover:text-charcoal px-2 py-1 rounded-lg hover:bg-cream-light transition-colors cursor-pointer border border-cream-border bg-white"
                          title="Reverse image positions"
                        >
                          ⇄ Reverse
                        </button>
                      </div>
                    </div>

                    {/* Position Slot Cards */}
                    <div className="space-y-2.5">
                      {selectedLayout.slots.map((slot, slotIdx) => {
                        const assigned = assignedImages[slotIdx];
                        const posLabel = slot.positionLabel || `Position ${slotIdx + 1}`;
                        return (
                          <div
                            key={slotIdx}
                            className={`p-3 rounded-2xl border transition-all ${
                              assigned
                                ? 'bg-white border-cream-border shadow-xs'
                                : 'bg-white/60 border-dashed border-cream-border'
                            }`}
                          >
                            {/* Slot Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-md bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                                  {slotIdx + 1}
                                </span>
                                <span className="text-xs font-bold text-charcoal">
                                  {posLabel}
                                </span>
                              </div>

                              {/* SKU Tag Input */}
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-charcoal-muted font-bold">Tag:</span>
                                <input
                                  type="text"
                                  value={slotTags[slotIdx] || ''}
                                  onChange={(e) => {
                                    const updated = [...slotTags];
                                    updated[slotIdx] = e.target.value;
                                    setSlotTags(updated);
                                  }}
                                  className="w-16 px-1.5 py-0.5 rounded bg-cream-light border border-cream-border text-[11px] font-mono font-bold text-charcoal text-center focus:outline-none focus:border-accent"
                                  placeholder="SKU"
                                />
                              </div>
                            </div>

                            {/* Slot Body: Thumbnail + Dropdown + Controls */}
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-14 rounded-xl overflow-hidden bg-cream-light border border-cream-border shrink-0 flex items-center justify-center relative group">
                                {assigned?.url ? (
                                  <>
                                    <img src={assigned.url} alt="" className="w-full h-full object-cover" />
                                    <div className="absolute top-1 left-1 bg-charcoal/80 text-white text-[9px] font-bold px-1 rounded">
                                      #{images.findIndex(img => img.id === assigned.id) + 1}
                                    </div>
                                  </>
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-charcoal-muted opacity-40" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0 space-y-1.5">
                                {/* Photo Dropdown Picker */}
                                <select
                                  value={assigned?.id || ''}
                                  onChange={(e) => {
                                    const chosenId = e.target.value;
                                    const found = images.find(img => img.id === chosenId) || null;
                                    handleAssignSlot(slotIdx, found);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal font-semibold cursor-pointer focus:border-accent focus:outline-none"
                                >
                                  <option value="">(Select Photo for this Position)</option>
                                  {images.map((img, iIdx) => (
                                    <option key={img.id || iIdx} value={img.id}>
                                      Photo #{iIdx + 1} {img.poseName ? `— ${img.poseName}` : ''}
                                    </option>
                                  ))}
                                </select>

                                {/* Position Move & Clear Controls */}
                                <div className="flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSlot(slotIdx, 'up')}
                                      disabled={slotIdx === 0}
                                      className="px-2 py-0.5 rounded bg-cream border border-cream-border text-charcoal hover:bg-cream-dark disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                      title="Move to earlier position"
                                    >
                                      <ArrowUp className="w-3 h-3" /> Earlier
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSlot(slotIdx, 'down')}
                                      disabled={slotIdx === selectedLayout.slots.length - 1}
                                      className="px-2 py-0.5 rounded bg-cream border border-cream-border text-charcoal hover:bg-cream-dark disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                      title="Move to later position"
                                    >
                                      <ArrowDown className="w-3 h-3" /> Later
                                    </button>
                                  </div>

                                  {assigned && (
                                    <button
                                      type="button"
                                      onClick={() => handleClearSlot(slotIdx)}
                                      className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                                    >
                                      Remove Photo
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Available Photos Gallery */}
                    <div className="pt-2 border-t border-cream-border space-y-2">
                      <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center justify-between">
                        <span>Available Photos ({images.length})</span>
                        <span className="text-[10px] text-charcoal-muted font-normal lowercase">click to position</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {images.map((img, idx) => {
                          const placedIndex = assignedImages.findIndex((a) => a?.id === img.id);
                          const isPlaced = placedIndex !== -1;
                          return (
                            <div
                              key={img.id || idx}
                              className={`p-2 rounded-xl border transition-all ${
                                isPlaced
                                  ? 'bg-cream-light/60 border-cream-border'
                                  : 'bg-white border-cream-border hover:border-accent/40 shadow-xs'
                              }`}
                            >
                              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-cream-dark relative mb-1.5">
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                <div className="absolute top-1 left-1 bg-charcoal/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  #{idx + 1}
                                </div>
                                {isPlaced && (
                                  <div className="absolute bottom-1 right-1 bg-accent text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs">
                                    In Slot {placedIndex + 1}
                                  </div>
                                )}
                              </div>

                              {/* Placement Buttons */}
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-charcoal truncate">
                                  Photo #{idx + 1}
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedLayout.slots.map((_, sI) => (
                                    <button
                                      key={sI}
                                      type="button"
                                      onClick={() => handleAssignSlot(sI, img)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                        placedIndex === sI
                                          ? 'bg-accent text-white shadow-xs'
                                          : 'bg-white border border-cream-border hover:border-accent text-charcoal'
                                      }`}
                                      title={`Put Photo #${idx + 1} in Position ${sI + 1}`}
                                    >
                                      ➔ Pos {sI + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 3: BRAND & TEXT LABELS ── */}
                {activeTab === 'text' && (
                  <div className="space-y-4">

                    {/* Auto-Sync Indicator & Reset Header */}
                    <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-800 leading-tight">
                          Brand & Tags Auto-Saved & Active in all 15 Templates
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetBrandDefaults}
                        className="text-[9px] font-bold text-emerald-800/80 hover:text-red-600 hover:bg-emerald-100/60 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Reset brand identity to factory defaults"
                      >
                        Reset Defaults
                      </button>
                    </div>

                    {/* 1. CLOUDFLARE BRAND LOGO UPLOADER */}
                    <div className="p-3 rounded-2xl bg-white border border-cream-border space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-accent" />
                          <label className="text-[11px] font-bold text-charcoal">
                            Brand Logo (Cloudflare R2)
                          </label>
                        </div>
                        {brandLogoUrl && (
                          <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Cloudflare Synced
                          </span>
                        )}
                      </div>

                      {/* Hidden File Input for Cloudflare Logo Upload */}
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleUploadLogo}
                        className="hidden"
                      />

                      {brandLogoUrl ? (
                        <div className="space-y-2.5">
                          {/* Logo Preview Container */}
                          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-cream-light border border-cream-border">
                            <div className="w-16 h-12 bg-white rounded-lg border border-cream-border p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                              <img
                                src={brandLogoUrl}
                                alt="Brand Logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-charcoal truncate">
                                Custom Logo Stored
                              </p>
                              <a
                                href={brandLogoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-accent hover:underline flex items-center gap-1 mt-0.5 truncate"
                                title="Open Cloudflare R2 file"
                              >
                                <span>View R2 File</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => logoFileInputRef.current?.click()}
                                disabled={uploadingLogo}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-white border border-cream-border hover:border-accent text-charcoal transition-all cursor-pointer"
                                title="Upload a different logo"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="p-1 text-charcoal-muted hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                title="Remove logo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Toggle to Use Logo in Collage */}
                          <label className="flex items-center justify-between p-2 rounded-xl bg-cream-light/60 border border-cream-border/80 cursor-pointer hover:bg-cream-light transition-colors">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={useCustomLogo}
                                onChange={(e) => setUseCustomLogo(e.target.checked)}
                                className="rounded text-accent focus:ring-accent cursor-pointer"
                              />
                              <span className="text-[11px] font-bold text-charcoal">
                                Display Logo in Collage Templates
                              </span>
                            </div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${useCustomLogo ? 'bg-accent text-white' : 'bg-charcoal/10 text-charcoal-muted'}`}>
                              {useCustomLogo ? 'Active' : 'Off'}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div>
                          {/* Dropzone Upload Button */}
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="w-full py-4 px-3 rounded-xl border-2 border-dashed border-cream-border hover:border-accent bg-cream-light/40 hover:bg-cream-light flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
                          >
                            {uploadingLogo ? (
                              <>
                                <RefreshCw className="w-5 h-5 text-accent animate-spin" />
                                <span className="text-xs font-bold text-charcoal">
                                  Uploading to Cloudflare R2...
                                </span>
                              </>
                            ) : (
                              <>
                                <div className="w-8 h-8 rounded-full bg-white border border-cream-border flex items-center justify-center text-charcoal-muted group-hover:text-accent group-hover:border-accent transition-colors shadow-xs">
                                  <Upload className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-charcoal group-hover:text-accent">
                                  Click to Upload Brand Logo
                                </span>
                                <span className="text-[10px] text-charcoal-muted text-center max-w-[240px]">
                                  Saves directly to Cloudflare R2 & applies across all templates (PNG transparent recommended)
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {logoUploadError && (
                        <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[10px] font-semibold">
                          {logoUploadError}
                        </div>
                      )}
                    </div>

                    {/* 2. BRAND NAME & TEXT CREST */}
                    <div className="p-3 rounded-2xl bg-white border border-cream-border space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-charcoal">
                          Brand Name (Text Fallback)
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowBrandCrest(!showBrandCrest)}
                          className={`text-[10px] font-bold ${showBrandCrest ? 'text-accent' : 'text-charcoal-muted'}`}
                        >
                          {showBrandCrest ? 'Badge Visible' : 'Badge Hidden'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                        placeholder="e.g. rgjdass Heritage & Couture"
                      />
                      {useCustomLogo && brandLogoUrl && showBrandCrest && (
                        <p className="text-[9px] text-accent font-medium">
                          ★ Uploaded Cloudflare logo is active and displayed on cards & sheets.
                        </p>
                      )}
                    </div>

                    {/* 3. COLLECTION & TAGLINES */}
                    <div className="p-3 rounded-2xl bg-white border border-cream-border space-y-3 shadow-xs">
                      {/* Collection Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-charcoal">
                            Collection / Design Title (Badge Pill)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowCollectionPill(!showCollectionPill)}
                            className={`text-[10px] font-bold ${showCollectionPill ? 'text-accent' : 'text-charcoal-muted'}`}
                          >
                            {showCollectionPill ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={collectionTitle}
                          onChange={(e) => setCollectionTitle(e.target.value)}
                          disabled={!showCollectionPill}
                          className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal font-bold tracking-wider disabled:opacity-40 focus:outline-none focus:border-accent"
                          placeholder="e.g. ALFINE or CRIMSON SQUARE"
                        />
                      </div>

                      {/* Tagline */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-charcoal">Header Tagline</label>
                          <button
                            type="button"
                            onClick={() => setShowTagline(!showTagline)}
                            className={`text-[10px] font-bold ${showTagline ? 'text-accent' : 'text-charcoal-muted'}`}
                          >
                            {showTagline ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={tagline}
                          onChange={(e) => setTagline(e.target.value)}
                          disabled={!showTagline}
                          className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal disabled:opacity-40 focus:outline-none focus:border-accent"
                          placeholder="e.g. THE SIMPLE THINGS TO LUXURY COUTURE"
                        />
                      </div>

                      {/* Side Cursive Text */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-charcoal">Left Margin Script</label>
                          <button
                            type="button"
                            onClick={() => setShowSideText(!showSideText)}
                            className={`text-[10px] font-bold ${showSideText ? 'text-accent' : 'text-charcoal-muted'}`}
                          >
                            {showSideText ? 'Visible' : 'Hidden'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={sideText}
                          onChange={(e) => setSideText(e.target.value)}
                          disabled={!showSideText}
                          className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal disabled:opacity-40 focus:outline-none focus:border-accent"
                          placeholder="e.g. Premium handloom silks"
                        />
                      </div>
                    </div>

                    {/* 4. FOOTER & SOCIALS */}
                    <div className="p-3 rounded-2xl bg-white border border-cream-border space-y-2 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-charcoal">Footer Bar Details</label>
                        <button
                          type="button"
                          onClick={() => setShowFooterBar(!showFooterBar)}
                          className={`text-[10px] font-bold ${showFooterBar ? 'text-accent' : 'text-charcoal-muted'}`}
                        >
                          {showFooterBar ? 'Visible' : 'Hidden'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        disabled={!showFooterBar}
                        className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal disabled:opacity-40 focus:outline-none focus:border-accent"
                        placeholder="Website URL (e.g. www.rgjdass.com)"
                      />
                      <input
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value)}
                        disabled={!showFooterBar}
                        className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal disabled:opacity-40 focus:outline-none focus:border-accent"
                        placeholder="Instagram Handle (e.g. @rgjdasscouture)"
                      />
                      <input
                        type="text"
                        value={trustSealText}
                        onChange={(e) => setTrustSealText(e.target.value)}
                        disabled={!showFooterBar}
                        className="w-full px-3 py-2 rounded-xl bg-cream-light border border-cream-border text-xs text-charcoal disabled:opacity-40 focus:outline-none focus:border-accent"
                        placeholder="Trust Seal (e.g. Silk Mark Certified • Pure Handloom)"
                      />
                    </div>

                    {/* 5. PHOTO SKU CODE BADGES WITH QUICK-FILL */}
                    <div className="p-3 rounded-2xl bg-white border border-cream-border space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-charcoal">
                          Photo SKU / Color Badges
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowSkuTags(!showSkuTags)}
                          className={`text-[10px] font-bold ${showSkuTags ? 'text-accent' : 'text-charcoal-muted'}`}
                        >
                          {showSkuTags ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      {/* Quick Auto-Number Prefix Generator */}
                      {showSkuTags && (
                        <div className="p-2 rounded-xl bg-cream-light border border-cream-border space-y-1.5">
                          <label className="text-[10px] font-bold text-charcoal block">
                            Quick Auto-Number Prefix:
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={skuPrefixInput}
                              onChange={(e) => setSkuPrefixInput(e.target.value)}
                              placeholder="e.g. 298 or RGJ-50"
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-white border border-cream-border text-charcoal font-mono focus:outline-none focus:border-accent"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplySkuPrefix(skuPrefixInput)}
                              disabled={!skuPrefixInput.trim()}
                              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                            >
                              Apply A,B,C...
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Slot by Slot inputs */}
                      <div className="space-y-1.5">
                        {slotTags.map((tagVal, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-charcoal-muted w-14 shrink-0">
                              Position {sIdx + 1}:
                            </span>
                            <input
                              type="text"
                              value={tagVal}
                              onChange={(e) => handleUpdateSlotTag(sIdx, e.target.value)}
                              disabled={!showSkuTags}
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-cream-light border border-cream-border text-xs text-charcoal font-mono disabled:opacity-40 focus:outline-none focus:border-accent"
                              placeholder={`Code ${sIdx + 1}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

            {/* RIGHT COLUMN: PREVIEW CANVAS & EXPORT BAR */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 sm:p-5 bg-[#ede4dc]/80 gap-3">

              {/* Quick Export Bar + Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 bg-white/80 backdrop-blur-sm p-2 px-3.5 rounded-2xl border border-cream-border">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Toggle Sidebar Collapse (Full View on Canvas) */}
                  <button
                    type="button"
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-cream-light border border-cream-border text-charcoal hover:border-accent flex items-center gap-1 shadow-xs cursor-pointer"
                    title={isSidebarCollapsed ? "Show Options Sidebar" : "Expand Canvas to Full Width"}
                  >
                    {isSidebarCollapsed ? (
                      <>
                        <ChevronRight className="w-3.5 h-3.5 text-accent" />
                        <span>Show Options</span>
                      </>
                    ) : (
                      <>
                        <ChevronLeft className="w-3.5 h-3.5 text-accent" />
                        <span>Full View Canvas</span>
                      </>
                    )}
                  </button>

                  {/* Photo Fit Mode (Cover vs Show Full Photo) */}
                  <div className="flex items-center gap-1 bg-cream-light p-0.5 rounded-xl border border-cream-border text-xs">
                    <span className="text-[10px] font-bold text-charcoal-muted px-1.5">Photo Fit:</span>
                    <button
                      type="button"
                      onClick={() => setImageFitMode('cover')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        imageFitMode === 'cover'
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-charcoal-muted hover:text-charcoal'
                      }`}
                      title="Crop photo to fill slot"
                    >
                      Fill Slot
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageFitMode('fit')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        imageFitMode === 'fit'
                          ? 'bg-accent text-white shadow-xs'
                          : 'text-charcoal-muted hover:text-charcoal'
                      }`}
                      title="Show 100% full uncropped photo without chopping head or feet"
                    >
                      Full Photo (No Crop)
                    </button>
                  </div>

                  <span className="text-xs font-bold text-charcoal uppercase tracking-wider hidden md:inline ml-1">Export:</span>
                  {(['standard', 'high', 'ultra'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setExportResolution(res)}
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                        exportResolution === res
                          ? 'bg-accent text-white border-accent shadow-xs'
                          : 'bg-white border-cream-border text-charcoal-muted hover:text-charcoal'
                      }`}
                    >
                      {res === 'standard' ? '1080p' : res === 'high' ? 'HD (1500p)' : 'Ultra (2400p)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-charcoal-muted">
                  <span className="font-mono text-charcoal">{exportDimensions.w} × {exportDimensions.h} px</span>
                  <span>•</span>
                  <span>{activeAspectRatio === 1 ? '1:1 Square' : activeAspectRatio < 0.6 ? '9:16 Story' : '4:5 Portrait'}</span>

                  {/* Direct Fullscreen Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setFullscreenZoom(1);
                      setIsFullscreenModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg bg-cream border border-cream-border hover:border-accent text-charcoal hover:text-accent cursor-pointer transition-colors"
                    title="Open Fullscreen Lightbox View"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Interactive Slot Position Bar */}
              <div className="shrink-0 bg-white/90 backdrop-blur-sm p-2 px-3 rounded-2xl border border-cream-border shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-charcoal flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-accent" />
                    Arrange Slot Positions ({assignedImages.filter(Boolean).length}/{selectedLayout.slots.length} placed)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleResetToImageOrder}
                      className="text-[10px] font-semibold text-charcoal-muted hover:text-charcoal px-2 py-0.5 rounded-lg hover:bg-cream-light transition-colors cursor-pointer"
                      title="Reset to default photoshoot order"
                    >
                      ↺ Reset
                    </button>
                    <button
                      type="button"
                      onClick={handleReversePositions}
                      className="text-[10px] font-semibold text-charcoal-muted hover:text-charcoal px-2 py-0.5 rounded-lg hover:bg-cream-light transition-colors cursor-pointer"
                      title="Reverse all image positions"
                    >
                      ⇄ Reverse
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSidebarCollapsed(false);
                        setActiveTab('images');
                      }}
                      className="text-[10px] font-bold text-accent hover:underline px-1.5 py-0.5 cursor-pointer"
                    >
                      Detailed Editor →
                    </button>
                  </div>
                </div>

                {/* Slot Position Pills Strip */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {selectedLayout.slots.map((slot, sIdx) => {
                    const assigned = assignedImages[sIdx];
                    const label = slot.positionLabel || `Position ${sIdx + 1}`;
                    return (
                      <div
                        key={sIdx}
                        className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border shrink-0 text-xs transition-all ${
                          assigned
                            ? 'bg-cream-light border-cream-border text-charcoal'
                            : 'bg-white border-dashed border-cream-border text-charcoal-muted'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-md bg-white border border-cream-border overflow-hidden shrink-0 flex items-center justify-center font-bold text-[9px] text-charcoal">
                          {assigned?.url ? (
                            <img src={assigned.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{sIdx + 1}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-charcoal truncate max-w-[100px]">
                            #{sIdx + 1}: {label}
                          </p>
                        </div>
                        {/* Photo Selector Dropdown */}
                        <select
                          value={assigned?.id || ''}
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            const found = images.find(img => img.id === chosenId) || null;
                            handleAssignSlot(sIdx, found);
                          }}
                          className="text-[10px] font-semibold bg-white border border-cream-border rounded-lg px-1 py-0.5 text-charcoal cursor-pointer focus:outline-none focus:border-accent"
                        >
                          <option value="">(Empty Slot)</option>
                          {images.map((img, iIdx) => (
                            <option key={img.id || iIdx} value={img.id}>
                              Photo #{iIdx + 1} {img.poseName ? `(${img.poseName})` : ''}
                            </option>
                          ))}
                        </select>
                        {/* Quick Swap Arrow Buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveSlot(sIdx, 'up')}
                            disabled={sIdx === 0}
                            className="p-1 rounded text-charcoal-muted hover:text-charcoal hover:bg-white disabled:opacity-20 cursor-pointer"
                            title="Move earlier"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSlot(sIdx, 'down')}
                            disabled={sIdx === selectedLayout.slots.length - 1}
                            className="p-1 rounded text-charcoal-muted hover:text-charcoal hover:bg-white disabled:opacity-20 cursor-pointer"
                            title="Move later"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Canvas Preview Container with Click-to-Zoom */}
              <div
                onClick={() => {
                  setFullscreenZoom(1);
                  setIsFullscreenModalOpen(true);
                }}
                className="flex-1 min-h-0 min-w-0 flex items-center justify-center bg-white/70 rounded-3xl border border-cream-border overflow-hidden p-2 sm:p-3 relative shadow-inner cursor-zoom-in group"
                title="Click to view template in full screen"
              >
                <canvas
                  ref={previewCanvasRef}
                  className="w-auto h-auto max-w-full max-h-full object-contain rounded-2xl shadow-xl border border-cream-border/60 transition-transform duration-200 group-hover:scale-[1.01]"
                  style={{
                    maxHeight: 'calc(100% - 10px)',
                    maxWidth: 'calc(100% - 10px)',
                    imageRendering: 'auto'
                  }}
                />

                {/* Floating Full View Prompt on Hover */}
                <div className="absolute top-3 right-3 bg-charcoal/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-md pointer-events-none">
                  <Maximize2 className="w-3 h-3 text-accent" />
                  <span>Click for Full View</span>
                </div>
              </div>

              {/* Hidden Offscreen Canvas for High-Resolution Export */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Bottom Actions Bar */}
              <div className="shrink-0 flex flex-wrap items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isRendering || assignedImages.filter(Boolean).length === 0}
                  className="flex-1 py-2.5 px-6 rounded-2xl font-bold text-sm bg-accent hover:bg-accent-hover text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isRendering ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Rendering HD Collage...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Collage Downloaded!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download HD Catalogue Sheet</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  disabled={isRendering || assignedImages.filter(Boolean).length === 0}
                  className="py-2.5 px-5 rounded-2xl font-bold text-xs bg-white hover:bg-cream-light border border-cream-border text-charcoal transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                  title="Copy collage image to clipboard for instant pasting into WhatsApp Web"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-charcoal-muted" />
                      <span>Copy Image (Paste in WhatsApp)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFullscreenZoom(1);
                    setIsFullscreenModalOpen(true);
                  }}
                  className="py-2.5 px-4 rounded-2xl font-bold text-xs bg-cream-light hover:bg-cream border border-cream-border text-charcoal transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Open full view modal"
                >
                  <Eye className="w-3.5 h-3.5 text-accent" />
                  <span>Full View</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-5 rounded-2xl font-bold text-xs bg-cream-dark/60 hover:bg-cream-dark text-charcoal transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ── FULLSCREEN LIGHTBOX MODAL (100% UNCLIPPED FULL VIEW) ── */}
      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-[250] bg-charcoal/95 backdrop-blur-xl flex flex-col p-2 sm:p-4 animate-fade-in text-white font-sans">
          {/* Fullscreen Header */}
          <div className="flex flex-wrap items-center justify-between p-2.5 px-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 mb-2 shrink-0 gap-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <div>
                <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <span>{selectedLayout.name}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-cream-dark border border-white/20">
                    {exportDimensions.w} × {exportDimensions.h} px
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-xl border border-white/15 text-xs">
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)))}
                  className="p-1 hover:text-accent cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono font-bold px-1 min-w-[38px] text-center">
                  {Math.round(fullscreenZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(prev => Math.min(2.5, +(prev + 0.25).toFixed(2)))}
                  className="p-1 hover:text-accent cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(1)}
                  className="ml-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-bold cursor-pointer"
                >
                  Fit 100%
                </button>
              </div>

              {/* Photo Fit Mode (Cover vs Show Full Photo) */}
              <button
                type="button"
                onClick={() => setImageFitMode(prev => prev === 'cover' ? 'fit' : 'cover')}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Toggle between Fill Slot and Show Full Uncropped Photo"
              >
                <span>{imageFitMode === 'fit' ? '✓ Full Uncropped Photo' : 'Crop: Fill Slot'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="py-1.5 px-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download HD</span>
              </button>

              <button
                type="button"
                onClick={handleCopyToClipboard}
                className="py-1.5 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy for WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreenModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-300 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                title="Exit Full View"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Fullscreen Canvas Container - Fits 100% of the image on screen without any cutoffs */}
          <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center p-2 rounded-2xl bg-black/60 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="w-full h-full flex items-center justify-center overflow-auto p-1 scrollbar-thin">
              <canvas
                ref={fullscreenCanvasRef}
                className="w-auto h-auto max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-white/20 transition-transform duration-200"
                style={{
                  maxHeight: fullscreenZoom === 1 ? 'calc(100vh - 140px)' : 'none',
                  maxWidth: fullscreenZoom === 1 ? 'calc(100vw - 36px)' : 'none',
                  transform: fullscreenZoom !== 1 ? `scale(${fullscreenZoom})` : 'none',
                  transformOrigin: 'center center',
                  imageRendering: 'auto'
                }}
              />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="shrink-0 flex items-center justify-between pt-2 px-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span>Layout: <strong className="text-white">{selectedLayout.name}</strong></span>
              <span>•</span>
              <span>Theme: <strong className="text-white">{selectedTheme.name}</strong></span>
              <span>•</span>
              <span>Photo Fit: <strong className="text-white">{imageFitMode === 'fit' ? 'Full Photo (No Crop)' : 'Fill Slot'}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenModalOpen(false)}
              className="py-0.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
            >
              Exit Full View (Esc)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
