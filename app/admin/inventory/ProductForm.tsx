'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useDrivePicker from 'react-google-drive-picker';
import {
  Save, Package, Tag, ArrowLeft, Sparkles, Image as ImageIcon,
  Plus, Minus, X, Info, RefreshCw, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Trash2, Settings2, MessageSquare,
  ShoppingBag, Share2, ThumbsUp, Globe, Smartphone, Upload, Loader2,
  Copy, Check, Star, Eye, Maximize2, ChevronLeft, ChevronRight, Download, ExternalLink, ZoomIn, Key
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';
import { Textarea } from '@/app/components/ui/Input';
import { useGooglePhotosPicker } from '@/app/hooks/useGooglePhotosPicker';
import { CollageCreator, CollageInputImage } from '@/app/components/CollageCreator';
import { normalizeSizeInventory, SizeInventoryItem, sumSizeInventory } from '@/lib/size-inventory';

// ─── CONSTANTS ───

const CLOTH_TYPES = [
  'Silk', 'Cotton', 'Linen', 'Tussar', 'Georgette', 'Chiffon', 'Crepe',
  'Ajrakh', 'Bandhani', 'Kanjivaram', 'Banarasi', 'Chanderi', 'Net',
  'Organza', 'Velvet', 'Satin', 'Modal', 'Rayon', 'Polyester', 'Blended'
];

const COLORS = [
  'Red', 'Deep Red', 'Maroon', 'Pink', 'Rose', 'Coral', 'Orange',
  'Yellow', 'Gold', 'Mustard', 'Green', 'Teal', 'Emerald', 'Blue',
  'Navy', 'Sky Blue', 'Purple', 'Violet', 'Lavender', 'Magenta',
  'Black', 'White', 'Off-White', 'Cream', 'Beige', 'Brown', 'Copper',
  'Grey', 'Silver', 'Multi-colour'
];

const EMBROIDERY_TYPES = ['None', 'Zari', 'Thread', 'Mirror', 'Sequin', 'Resham', 'Cutwork', 'Printed', 'Block Print', 'Digital Print', 'Mixed'];
const CUT_STYLES = ['Straight', 'A-Line', 'Anarkali', 'Asymmetric', 'Flared', 'Fitted', 'Box-Pleat', 'Panelled'];
const KURTA_LENGTHS = ['Short (till hip)', 'Mid (thigh)', 'Long (knee)', 'Extra Long (calf)', 'Floor Length'];
const PANT_STYLES = ['Palazzo', 'Straight', 'Churidar', 'Patiala', 'Dhoti', 'Sharara', 'Cigarette', 'Culottes'];
const OCCASION_TYPES = ['Casual', 'Festive', 'Formal', 'Party', 'Bridal', 'Religious', 'Office', 'Travel'];

// ─── TYPES ───

interface Category {
  id: string;
  name: string;
  slug: string;
  subCategories: { id: string; name: string; slug: string }[];
}

interface CustomField {
  key: string;
  label: string;
  value: string;
  type: 'text' | 'number' | 'textarea';
}

interface ProductFormData {
  // ── Core Fields ──
  stockCode: string;
  friendlyCode: string;
  title: string;
  description: string;
  color: string;
  clothType: string;
  tags: string[];
  categoryId: string;
  subCategoryId: string;
  price: string;
  mrp: string;
  wholesalePrice: string;
  quantity: string;
  status: string;
  coverImageUrl: string;
  websiteCopy: string;
  websiteProductId: string;

  // ── XLSX-Mapped Fields ──
  designNumber: string;
  size: string;
  location: string;
  embroideryType: string;
  cutStyle: string;
  border: string;
  kurtaLength: string;
  pantStyle: string;

  // ── Platform Captions ──
  whatsappRetail: string;
  whatsappWholesale: string;
  instagramCaption: string;
  facebookCaption: string;
  shopifyTitle: string;
  whatsappCatalogueTitle: string;
}

interface DesignGroupEntry {
  id: string;
  stockCode: string;
  friendlyCode?: string | null;
  quantity: number;
  status: string;
  location?: string | null;
}

interface DesignGroup {
  id: string;
  designNumber: string;
  title: string;
  stockEntries: DesignGroupEntry[];
}

interface Props {
  productId?: string;
}

// ─── HELPER ───

const emptyForm = (): ProductFormData => ({
  stockCode: '', friendlyCode: '', title: '', description: '',
  color: '', clothType: '', tags: [],
  categoryId: '', subCategoryId: '',
  price: '', mrp: '', wholesalePrice: '',
  quantity: '0', status: 'ACTIVE',
  coverImageUrl: '', websiteCopy: '', websiteProductId: '',
  designNumber: '', size: '', location: '',
  embroideryType: '', cutStyle: '', border: '', kurtaLength: '', pantStyle: '',
  whatsappRetail: '', whatsappWholesale: '',
  instagramCaption: '', facebookCaption: '',
  shopifyTitle: '', whatsappCatalogueTitle: '',
});

// ─── COMPONENT ───

export function ProductForm({ productId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [openPicker, authResponse] = useDrivePicker();
  const isEdit = !!productId;

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Section collapse
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    core: true, garment: true, pricing: true, stock: true, captions: false,
    website: false, images: true, custom: false,
  });
  const toggleSection = (k: string) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  // Design group lookup
  const [designGroup, setDesignGroup] = useState<DesignGroup | null>(null);
  const [designGroupLoading, setDesignGroupLoading] = useState(false);
  const [designGroupLinked, setDesignGroupLinked] = useState(false); // is this product already linked?
  const [linkingGroup, setLinkingGroup] = useState(false);
  const designLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupDesignGroup = useCallback(async (dn: string) => {
    if (!dn.trim()) { setDesignGroup(null); return; }
    setDesignGroupLoading(true);
    try {
      const res = await fetch(`/api/admin/design-groups?designNumber=${encodeURIComponent(dn.trim())}`);
      const data = await res.json();
      setDesignGroup(data.group || null);
    } catch { setDesignGroup(null); }
    finally { setDesignGroupLoading(false); }
  }, []);

  const handleLinkToGroup = async () => {
    if (!designGroup || !productId) return;
    setLinkingGroup(true);
    try {
      await fetch(`/api/admin/design-groups/${designGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkProductId: productId }),
      });
      setDesignGroupLinked(true);
      // Refresh group
      lookupDesignGroup(form.designNumber);
    } finally { setLinkingGroup(false); }
  };

  const handleUnlinkFromGroup = async () => {
    if (!designGroup || !productId) return;
    setLinkingGroup(true);
    try {
      await fetch(`/api/admin/design-groups/${designGroup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlinkProductId: productId }),
      });
      setDesignGroupLinked(false);
      lookupDesignGroup(form.designNumber);
    } finally { setLinkingGroup(false); }
  };

  const handleCreateAndLinkGroup = async () => {
    if (!form.designNumber.trim() || !form.title) return;
    setLinkingGroup(true);
    try {
      const res = await fetch('/api/admin/design-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designNumber: form.designNumber,
          title: form.title,
          description: form.description,
          color: form.color,
          clothType: form.clothType,
          productIds: productId ? [productId] : [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDesignGroup(data.group);
        setDesignGroupLinked(true);
      }
    } finally { setLinkingGroup(false); }
  };


  // Custom columns
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newColLabel, setNewColLabel] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);

  // Generated images
  const [generatedImages, setGeneratedImages] = useState<Record<string, { imageUrl: string; prompt?: string; order?: number }> | null>(null);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);
  const [showCollageModal, setShowCollageModal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // AI Generation State
  const [generatingName, setGeneratingName] = useState(false);
  const [nameSuggestions, setNameSuggestions] = useState<{ productName: string; catalogueTitle: string } | null>(null);
  const [nameSavedNotice, setNameSavedNotice] = useState<string | null>(null);

  const [aiKeywords, setAiKeywords] = useState(''); // Custom keywords e.g. "chikankari, pure organza, handloom"

  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string> | null>(null);
  const [captionsAppliedNotice, setCaptionsAppliedNotice] = useState(false);

  const [generatingSingleCaption, setGeneratingSingleCaption] = useState<string | null>(null);
  const [singleCaptionDraft, setSingleCaptionDraft] = useState<{ key: string; value: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [form, setForm] = useState<ProductFormData>(emptyForm());
  const [sizeInventory, setSizeInventory] = useState<Record<string, SizeInventoryItem>>({});
  const [newSizeKey, setNewSizeKey] = useState('');
  const [newSizeQty, setNewSizeQty] = useState('1');
  const [newSizeStockCode, setNewSizeStockCode] = useState('');

  const cataloguePhotosList = useMemo(() => {
    if (!generatedImages) return [];
    const seenUrls = new Set<string>();
    const deduplicatedEntries: [string, any][] = [];

    const sorted = Object.entries(generatedImages).sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0));
    for (const [poseId, img] of sorted) {
      if (!img?.imageUrl) continue;
      const u = img.imageUrl.trim();
      if (!seenUrls.has(u)) {
        seenUrls.add(u);
        deduplicatedEntries.push([poseId, img]);
      }
    }

    return deduplicatedEntries.map(([poseId, img], idx) => ({
      poseId,
      imageUrl: img.imageUrl,
      order: idx,
      isCover: form.coverImageUrl === img.imageUrl,
    }));
  }, [generatedImages, form.coverImageUrl]);

  const collageImagesList: CollageInputImage[] = useMemo(() => {
    return cataloguePhotosList.map(item => ({
      id: item.poseId,
      url: item.imageUrl,
      poseName: generatedImages?.[item.poseId]?.prompt || item.poseId,
    }));
  }, [cataloguePhotosList, generatedImages]);

  // Keyboard navigation for full-screen photo viewer lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex(prev => (prev !== null && prev < cataloguePhotosList.length - 1 ? prev + 1 : prev));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, cataloguePhotosList.length]);

  // Load categories
  useEffect(() => {
    fetch('/api/admin/categories').then(async r => { if (!r.ok) return { categories: [] }; const text = await r.text(); return text ? JSON.parse(text) : { categories: [] }; }).then(d => setCategories(d.categories || [])).catch(console.error);
  }, []);

  // Load product for edit
  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    fetch(`/api/admin/products/${productId}`)
      .then(async r => { if (!r.ok) return {}; const text = await r.text(); return text ? JSON.parse(text) : {}; })
      .then(d => {
        const p = d.product;
        if (p) {
          const code1 = p.code1 || p.friendlyCode || '';
          let loadedColor = p.color || '';
          if (!loadedColor && code1) {
            const parts = code1.split('-');
            if (parts.length > 2) {
              loadedColor = parts.slice(2).join(' ');
            } else if (parts.length === 2) {
              loadedColor = parts[1];
            }
          }

          // Detect catalogue images and auto-default cover image
          const genImgs = (p.generatedImages as Record<string, any>) || null;
          let loadedCover = p.coverImageUrl || '';

          if (genImgs && typeof genImgs === 'object' && Object.keys(genImgs).length > 0) {
            const sortedEntries = Object.entries(genImgs).sort(([, a]: any, [, b]: any) => {
              if (typeof a.order === 'number' && typeof b.order === 'number') {
                return a.order - b.order;
              }
              return 0;
            });
            const firstImg = sortedEntries[0]?.[1]?.imageUrl;
            const coverIsInCatalogue = sortedEntries.some(([, img]: any) => img.imageUrl === loadedCover);

            // Auto-default: If cover image is empty, tempfile URL, or not in catalogue photos
            if ((!loadedCover || loadedCover.includes('tempfile') || !coverIsInCatalogue) && firstImg) {
              loadedCover = firstImg;
              // Auto-persist fix to DB if stale tempfile or missing
              if (productId && (p.coverImageUrl?.includes('tempfile') || !p.coverImageUrl)) {
                fetch(`/api/admin/products/${productId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ coverImageUrl: firstImg }),
                }).catch(err => console.warn('Auto-default cover image save failed:', err));
              }
            }
          }

          setForm({
            stockCode: p.stockCode || '',
            friendlyCode: code1,
            title: p.productName || p.title || '',
            description: p.productDescription || p.description || '',
            color: loadedColor,
            clothType: p.clothType || '',
            tags: p.tags || [],
            categoryId: p.categoryId || '',
            subCategoryId: p.subCategoryId || '',
            price: p.unitPrice != null ? String(p.unitPrice) : (p.price != null ? String(p.price) : ''),
            mrp: p.retailPrice != null ? String(p.retailPrice) : (p.mrp != null ? String(p.mrp) : ''),
            wholesalePrice: p.dealerPrice != null ? String(p.dealerPrice) : (p.wholesalePrice != null ? String(p.wholesalePrice) : ''),
            quantity: String(p.quantity ?? 0),
            status: p.status || 'ACTIVE',
            coverImageUrl: loadedCover,
            websiteCopy: p.websiteCopy || '',
            websiteProductId: p.websiteProductId || '',
            designNumber: p.productCode || p.designNumber || '',
            size: p.length_Size || p.size || '',
            location: p.location || '',
            embroideryType: p.embroideryType || '',
            cutStyle: p.cutStyle || '',
            border: p.border || '',
            kurtaLength: p.kurtaLength || '',
            pantStyle: p.pantStyle || '',
            whatsappRetail: p.whatsappRetail || '',
            whatsappWholesale: p.whatsappWholesale || '',
            instagramCaption: p.instagramCaption || '',
            facebookCaption: p.facebookCaption || '',
            shopifyTitle: p.shopifyTitle || '',
            whatsappCatalogueTitle: p.whatsappCatalogueTitle || '',
          });
          let dedupedGenImgs: Record<string, any> | null = null;
          if (genImgs && typeof genImgs === 'object') {
            const seen = new Set<string>();
            dedupedGenImgs = {};
            for (const [k, v] of Object.entries(genImgs)) {
              const u = v?.imageUrl ? String(v.imageUrl).trim() : null;
              if (u && !seen.has(u)) {
                seen.add(u);
                dedupedGenImgs[k] = v;
              } else if (!u && !dedupedGenImgs[k]) {
                dedupedGenImgs[k] = v;
              }
            }
          }
          setGeneratedImages(dedupedGenImgs);
          setLinkedOrderId(p.linkedOrderId || null);
          if (p.sizeInventory) {
            setSizeInventory(normalizeSizeInventory(p.sizeInventory));
          }
          // Load custom fields
          if (p.customFields && typeof p.customFields === 'object') {
            const cf: CustomField[] = Object.entries(p.customFields as Record<string, any>).map(([key, val]: any) => ({
              key,
              label: val.label || key,
              value: val.value || '',
              type: val.type || 'text',
            }));
            setCustomFields(cf);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const selectedCategory = categories.find(c => c.id === form.categoryId);
  const subCategories = selectedCategory?.subCategories || [];

  // Debounced design number lookup
  useEffect(() => {
    if (designLookupTimer.current) clearTimeout(designLookupTimer.current);
    designLookupTimer.current = setTimeout(() => lookupDesignGroup(form.designNumber), 600);
    return () => { if (designLookupTimer.current) clearTimeout(designLookupTimer.current); };
  }, [form.designNumber, lookupDesignGroup]);

  // Check if this product is already in the group
  useEffect(() => {
    if (designGroup && productId) {
      setDesignGroupLinked(designGroup.stockEntries.some(e => e.id === productId));
    } else {
      setDesignGroupLinked(false);
    }
  }, [designGroup, productId]);




  const set = (field: keyof ProductFormData, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  };


  const addCustomColumn = () => {
    if (!newColLabel.trim()) return;
    const key = newColLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (customFields.find(f => f.key === key)) return;
    setCustomFields(prev => [...prev, { key, label: newColLabel.trim(), value: '', type: 'text' }]);
    setNewColLabel('');
    setShowAddCol(false);
  };

  const updateCustomField = (key: string, value: string) => {
    setCustomFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
  };

  const removeCustomField = (key: string) => {
    setCustomFields(prev => prev.filter(f => f.key !== key));
  };

  const moveImage = (poseId: string, direction: 'up' | 'down') => {
    if (!generatedImages) return;
    const entries = Object.entries(generatedImages).sort(([, a]: any, [, b]: any) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      return 0;
    });
    const index = entries.findIndex(([id]) => id === poseId);
    if (index < 0) return;
    if (direction === 'up' && index > 0) {
      const temp = entries[index];
      entries[index] = entries[index - 1];
      entries[index - 1] = temp;
    } else if (direction === 'down' && index < entries.length - 1) {
      const temp = entries[index];
      entries[index] = entries[index + 1];
      entries[index + 1] = temp;
    } else {
      return;
    }
    const updatedEntries = entries.map(([id, val]: any, idx) => [
      id,
      { ...val, order: idx }
    ]);
    const newObj = Object.fromEntries(updatedEntries);
    setGeneratedImages(newObj);
    if (productId) {
      fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedImages: newObj }),
      }).catch(err => console.warn('Auto-save reorder failed:', err));
    }
  };

  // Picky Assist Sync inside ProductForm
  const [syncingPicky, setSyncingPicky] = useState(false);
  const [autoSyncOnSave, setAutoSyncOnSave] = useState(true);
  const [pickySyncResult, setPickySyncResult] = useState<{
    success: boolean;
    message: string;
    diff?: any;
    actionTaken?: 'added' | 'updated' | 'no_change';
  } | null>(null);

  const handleSyncToPickyAssist = async (targetId?: string) => {
    const idToSync = targetId || productId;
    if (!idToSync) return;
    setSyncingPicky(true);
    setPickySyncResult(null);
    try {
      const res = await fetch('/api/admin/picky-assist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: idToSync, action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setPickySyncResult({
        success: data.success,
        message: data.message || 'Synced successfully with Picky Assist',
        diff: data.diff,
        actionTaken: data.actionTaken,
      });
    } catch (err: any) {
      console.error('Picky sync failed:', err);
      setPickySyncResult({
        success: false,
        message: err.message || 'Failed to sync with Picky Assist',
      });
    } finally {
      setSyncingPicky(false);
      setTimeout(() => {
        setPickySyncResult(null);
      }, 8000);
    }
  };

  const deleteImage = (poseId: string) => {
    if (!generatedImages) return;
    const deletedUrl = generatedImages[poseId]?.imageUrl;
    const newObj = { ...generatedImages };
    delete newObj[poseId];
    
    // Re-index remaining images
    const entries = Object.entries(newObj).sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0));
    const reindexed = Object.fromEntries(entries.map(([id, val]: any, idx) => [id, { ...val, order: idx }]));
    setGeneratedImages(reindexed);

    // If deleted image was the cover image, automatically switch to first available photo
    let updatedCover = form.coverImageUrl;
    if (form.coverImageUrl === deletedUrl) {
      updatedCover = entries[0]?.[1]?.imageUrl || '';
      set('coverImageUrl', updatedCover);
    }

    if (productId) {
      const patchData: any = { generatedImages: reindexed };
      if (form.coverImageUrl === deletedUrl) {
        patchData.coverImageUrl = updatedCover;
      }
      fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      }).catch(err => console.warn('Auto-save delete failed:', err));
    }

    // Delete image from Cloudflare R2
    if (deletedUrl && (deletedUrl.startsWith('http://') || deletedUrl.startsWith('https://') || deletedUrl.startsWith('/api/images/'))) {
      fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: deletedUrl }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.warn('[R2 Delete Warning]:', errData?.error || res.statusText);
          } else {
            console.log('[R2 Delete Success] Image permanently deleted from Cloudflare R2');
          }
        })
        .catch(err => console.warn('[R2 Delete Network Error]:', err));
    }
  };

  const setCoverImage = (imageUrl: string) => {
    set('coverImageUrl', imageUrl);
    if (productId) {
      fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImageUrl: imageUrl }),
      }).catch(err => console.warn('Auto-save cover image failed:', err));
    }
  };

  // ─── AI Generation Handlers ───
  const activeProductImage = form.coverImageUrl || (generatedImages && Object.values(generatedImages)[0]?.imageUrl) || null;
  const hasProductImages = Boolean(activeProductImage);

  const handleGenerateName = async () => {
    setGeneratingName(true);
    setError(null);
    setNameSavedNotice(null);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || 'Saree';
      const res = await fetch('/api/admin/products/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'name',
          imageUrl: activeProductImage,
          color: form.color,
          clothType: form.clothType,
          category: catName,
          embroideryType: form.embroideryType,
          cutStyle: form.cutStyle,
          border: form.border,
          description: form.description,
          keywords: aiKeywords,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate product name');
      if (data.data?.productName) {
        // Do NOT automatically mutate form.title — save for user review & explicit 'Save to Use'
        setNameSuggestions({
          productName: data.data.productName,
          catalogueTitle: data.data.catalogueTitle || `${data.data.productName} — ${form.color || ''} ${catName}`,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Error generating product name');
    } finally {
      setGeneratingName(false);
    }
  };

  const handleApplyName = (chosenName: string) => {
    set('title', chosenName);
    setNameSavedNotice(`Applied "${chosenName}" to product name!`);
    setTimeout(() => setNameSavedNotice(null), 3000);
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    setError(null);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || 'Saree';
      const res = await fetch('/api/admin/products/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'captions',
          imageUrl: activeProductImage,
          productName: form.title,
          color: form.color,
          clothType: form.clothType,
          category: catName,
          embroideryType: form.embroideryType,
          cutStyle: form.cutStyle,
          border: form.border,
          kurtaLength: form.kurtaLength,
          pantStyle: form.pantStyle,
          stockCode: form.stockCode,
          designNumber: form.designNumber,
          price: form.mrp || form.price,
          retailPrice: form.mrp,
          unitPrice: form.price,
          wholesalePrice: form.wholesalePrice,
          description: form.description,
          keywords: aiKeywords,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate description');
      const d = json.data || {};
      if (d.productDescription) {
        set('description', d.productDescription);
      }
    } catch (err: any) {
      setError(err.message || 'Error generating description');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleGenerateAllCaptions = async () => {
    setGeneratingCaptions(true);
    setError(null);
    setCaptionsAppliedNotice(false);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || 'Saree';
      const res = await fetch('/api/admin/products/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'captions',
          imageUrl: activeProductImage,
          productName: form.title,
          color: form.color,
          clothType: form.clothType,
          category: catName,
          embroideryType: form.embroideryType,
          cutStyle: form.cutStyle,
          border: form.border,
          kurtaLength: form.kurtaLength,
          pantStyle: form.pantStyle,
          stockCode: form.stockCode,
          designNumber: form.designNumber,
          price: form.mrp || form.price,
          retailPrice: form.mrp,
          unitPrice: form.price,
          wholesalePrice: form.wholesalePrice,
          description: form.description,
          keywords: aiKeywords,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate captions');
      const d = json.data || {};
      // Do NOT automatically mutate form fields — put into draft for user review!
      setDraftCaptions(d);
      setOpenSections(s => ({ ...s, captions: true }));
    } catch (err: any) {
      setError(err.message || 'Error generating captions');
    } finally {
      setGeneratingCaptions(false);
    }
  };

  const handleApplyAllDraftCaptions = () => {
    if (!draftCaptions) return;
    if (draftCaptions.whatsappRetail) set('whatsappRetail', draftCaptions.whatsappRetail);
    if (draftCaptions.whatsappWholesale) set('whatsappWholesale', draftCaptions.whatsappWholesale);
    if (draftCaptions.whatsappCatalogueTitle) set('whatsappCatalogueTitle', draftCaptions.whatsappCatalogueTitle);
    if (draftCaptions.instagramCaption) set('instagramCaption', draftCaptions.instagramCaption);
    if (draftCaptions.facebookCaption) set('facebookCaption', draftCaptions.facebookCaption);
    if (draftCaptions.shopifyTitle) set('shopifyTitle', draftCaptions.shopifyTitle);
    if (draftCaptions.productDescription && !form.description) {
      set('description', draftCaptions.productDescription);
    }
    setDraftCaptions(null);
    setCaptionsAppliedNotice(true);
    setTimeout(() => setCaptionsAppliedNotice(false), 4000);
  };

  const handleApplySingleDraftCaption = (key: keyof ProductFormData, text: string) => {
    set(key, text);
    if (draftCaptions) {
      const updated = { ...draftCaptions };
      delete updated[key as string];
      if (Object.keys(updated).length === 0) {
        setDraftCaptions(null);
      } else {
        setDraftCaptions(updated);
      }
    }
  };

  const handleRegenerateSingleCaption = async (platformKey: string) => {
    setGeneratingSingleCaption(platformKey);
    try {
      const catName = categories.find(c => c.id === form.categoryId)?.name || 'Saree';
      const res = await fetch('/api/admin/products/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'captions',
          targetPlatform: platformKey,
          imageUrl: activeProductImage,
          productName: form.title,
          color: form.color,
          clothType: form.clothType,
          category: catName,
          embroideryType: form.embroideryType,
          cutStyle: form.cutStyle,
          border: form.border,
          kurtaLength: form.kurtaLength,
          pantStyle: form.pantStyle,
          stockCode: form.stockCode,
          designNumber: form.designNumber,
          price: form.mrp || form.price,
          retailPrice: form.mrp,
          unitPrice: form.price,
          wholesalePrice: form.wholesalePrice,
          description: form.description,
          keywords: aiKeywords,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to regenerate caption');
      const val = json.data?.[platformKey];
      if (val) {
        // Do NOT automatically overwrite — save to draft for user review!
        setSingleCaptionDraft({ key: platformKey, value: val });
      }
    } catch (err: any) {
      setError(`Failed to regenerate ${platformKey}: ${err.message}`);
    } finally {
      setGeneratingSingleCaption(null);
    }
  };

  const handleApplySingleRedo = () => {
    if (!singleCaptionDraft) return;
    set(singleCaptionDraft.key as keyof ProductFormData, singleCaptionDraft.value);
    setSingleCaptionDraft(null);
  };

  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [uploadingCover, setUploadingCover] = useState(false);

  const compressImageFile = (file: File, maxDim = 2048, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = (err) => reject(err);
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return reject(new Error('Failed to read file'));
        if (file.type === 'image/svg+xml' || file.size < 400 * 1024) {
          return resolve(dataUrl);
        }
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleUploadCoverImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const base64 = await compressImageFile(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: base64, type: 'default' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `Upload failed with status ${res.status}`);
      }
      if (data.url) {
        set('coverImageUrl', data.url);
        if (productId) {
          fetch(`/api/admin/products/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coverImageUrl: data.url }),
          }).catch(err => console.warn('Auto-save cover image failed:', err));
        }
      }
    } catch (err: any) {
      console.error('Failed to upload cover image:', err);
      alert(`Cover image upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setUploadingCover(false);
      if (e.target) e.target.value = '';
    }
  };

  const [uploadingCatalogue, setUploadingCatalogue] = useState(false);
  const [catalogueUploadStatus, setCatalogueUploadStatus] = useState<string | null>(null);

  const uploadCatalogueFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setUploadingCatalogue(true);
    const total = files.length;
    setCatalogueUploadStatus(`0/${total}`);

    const newEntries: Record<string, { imageUrl: string; prompt: string; order?: number }> = {};

    try {
      for (let i = 0; i < total; i++) {
        const file = files[i];
        setCatalogueUploadStatus(`${i + 1}/${total}`);
        try {
          const base64 = await compressImageFile(file);
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64,
              type: 'generated',
              orderId: productId || 'manual',
              poseId: `upload_${Date.now()}_${i}`,
            }),
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || `Upload status ${res.status}`);
          }
          if (data.url) {
            const newPoseId = `uploaded_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const currentTotal = (generatedImages ? Object.keys(generatedImages).length : 0) + Object.keys(newEntries).length;
            newEntries[newPoseId] = {
              imageUrl: data.url,
              prompt: file.name ? file.name.replace(/\.[^/.]+$/, '') : 'Manually uploaded',
              order: currentTotal,
            };
          }
        } catch (fileErr: any) {
          console.error(`Failed to upload ${file.name}:`, fileErr);
          alert(`Failed to upload photo "${file.name}": ${fileErr?.message || 'Server error'}`);
        }
      }

      if (Object.keys(newEntries).length > 0) {
        const firstUploadedUrl = Object.values(newEntries)[0]?.imageUrl;
        const needsCoverUpdate = !form.coverImageUrl || form.coverImageUrl.includes('tempfile');

        setGeneratedImages(prev => {
          const updated = {
            ...(prev || {}),
            ...newEntries,
          };
          const patchBody: any = { generatedImages: updated };
          if (needsCoverUpdate && firstUploadedUrl) {
            patchBody.coverImageUrl = firstUploadedUrl;
            set('coverImageUrl', firstUploadedUrl);
          }
          if (productId) {
            fetch(`/api/admin/products/${productId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patchBody),
            }).catch(err => console.warn('Auto-save catalogue upload failed:', err));
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to upload catalogue photos', err);
    } finally {
      setUploadingCatalogue(false);
      setCatalogueUploadStatus(null);
    }
  };

  const handleUploadCataloguePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      const files = Array.from(fileList);
      await uploadCatalogueFiles(files);
      e.target.value = '';
    }
  };

  const handleOpenGooglePicker = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const fallbackAppId = clientId.split('-')[0];
    const token = (session?.user as any)?.accessToken || '';

    openPicker({
      token: token,
      clientId: clientId,
      developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
      appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID || fallbackAppId,
      viewId: "DOCS_IMAGES",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      callbackFunction: async (data: any) => {
        if (data.action === 'picked' && Array.isArray(data.docs) && data.docs.length > 0) {
          const token = (authResponse as any)?.access_token || data.oauthToken;
          setUploadingCatalogue(true);
          setCatalogueUploadStatus(`Drive 0/${data.docs.length}`);

          const downloadedFiles: File[] = [];
          for (let i = 0; i < data.docs.length; i++) {
            const doc = data.docs[i];
            setCatalogueUploadStatus(`Drive ${i + 1}/${data.docs.length}`);
            if (doc.id) {
              try {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                  const blob = await res.blob();
                  downloadedFiles.push(new File([blob], doc.name || `drive_photo_${i + 1}.jpg`, { type: blob.type }));
                }
              } catch (err) {
                console.warn(`Drive v3 download failed for ${doc.name}`, err);
              }
            }
          }

          if (downloadedFiles.length > 0) {
            await uploadCatalogueFiles(downloadedFiles);
          } else {
            setUploadingCatalogue(false);
            setCatalogueUploadStatus(null);
          }
        }
      }
    });
  };

  const {
    openPhotosPicker,
    openAuthorizedPhotosWindow,
    needsClickToOpen: photosNeedsClickToOpen,
    isPicking: isPickingPhotos,
    pickingStatus: photosPickingStatus,
    cancelPicking: cancelPhotosPicking,
  } = useGooglePhotosPicker({
    onPhotosSelected: async (photos) => {
      if (!photos || photos.length === 0) return;
      const files: File[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i] as any;
        try {
          let b64 = p?.base64;
          // Fallback download if base64 is missing but baseUrl is present
          if (!b64 && p?.baseUrl) {
            try {
              const cachedToken = typeof window !== 'undefined' ? sessionStorage.getItem('gphotos_token') : null;
              const token = (session?.user as any)?.accessToken || cachedToken;
              const dlRes = await fetch('/api/google/photos/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  baseUrl: p.baseUrl,
                  token,
                  filename: p.filename,
                  mimeType: p.mimeType,
                  maxDimension: 2048,
                }),
              });
              if (dlRes.ok) {
                const dlData = await dlRes.json();
                b64 = dlData?.base64;
              }
            } catch (dlErr) {
              console.warn(`[Photos Picker] Fallback download failed for photo ${i + 1}:`, dlErr);
            }
          }

          if (!b64 || typeof b64 !== 'string') {
            console.warn(`[Photos Picker] Skipping photo ${i + 1}: No valid base64 or baseUrl available`);
            continue;
          }

          const arr = b64.split(',');
          const mime = p.mimeType || arr[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1] || arr[0]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          files.push(new File([u8arr], p.filename || `google_photo_${i + 1}.jpg`, { type: mime }));
        } catch (convErr) {
          console.warn('Failed to convert photo base64 to file', convErr);
        }
      }
      if (files.length > 0) {
        await uploadCatalogueFiles(files);
      }
    },
    onError: (err) => {
      alert(err);
    },
  });

  const [exportingGooglePhotos, setExportingGooglePhotos] = useState(false);
  const [googlePhotosSuccess, setGooglePhotosSuccess] = useState<{ albumTitle: string; albumUrl?: string; photosUploaded: number } | null>(null);

  const handleExportAlbumToGooglePhotos = async () => {
    if (!generatedImages || Object.keys(generatedImages).length === 0) {
      alert('No catalogue photos available to export.');
      return;
    }

    const albumTitle = form.friendlyCode || form.stockCode || form.title || 'Product';
    const seenExportUrls = new Set<string>();
    const imagesToExport = Object.entries(generatedImages)
      .filter(([, v]) => {
        if (!v?.imageUrl) return false;
        const u = v.imageUrl.trim();
        if (seenExportUrls.has(u)) return false;
        seenExportUrls.add(u);
        return true;
      })
      .map(([poseId, v], idx) => ({
        imageUrl: v.imageUrl,
        filename: `${(form.friendlyCode || form.stockCode || 'photo').toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}_${idx + 1}.jpg`,
        description: `${form.title || 'Product'} (${form.friendlyCode || form.stockCode}) - ${v.prompt || `Photo #${idx + 1}`}`,
      }));

    if (imagesToExport.length === 0) {
      alert('No valid images to export.');
      return;
    }

    setExportingGooglePhotos(true);
    setGooglePhotosSuccess(null);

    try {
      let clientToken: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('gphotos_token');
        const exp = sessionStorage.getItem('gphotos_token_exp');
        if (cached && exp && Date.now() < Number(exp)) {
          clientToken = cached;
        }
      }

      const res = await fetch('/api/google/photos/export-album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: clientToken,
          albumTitle,
          productId: productId || undefined,
          images: imagesToExport,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.needsAuth) {
          throw new Error('Google Photos authorization is required. Please re-login with Google or open the Photos picker first.');
        }
        throw new Error(data.error || 'Failed to save to Google Photos album');
      }

      setGooglePhotosSuccess({
        albumTitle: data.albumTitle || albumTitle,
        albumUrl: data.albumUrl,
        photosUploaded: data.photosUploaded || imagesToExport.length,
      });

      // Refresh product data if productId exists so updated R2 URLs reflect
      if (productId) {
        fetch(`/api/admin/products/${productId}`)
          .then(r => r.json())
          .then(d => {
            if (d.product?.generatedImages) {
              setGeneratedImages(d.product.generatedImages);
            }
          })
          .catch(console.warn);
      }
    } catch (err: any) {
      console.error('Export album error:', err);
      alert(err?.message || 'Failed to save to Google Photos album');
    } finally {
      setExportingGooglePhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);

    try {
      // Build customFields JSON
      const customFieldsJson: Record<string, any> = {};
      customFields.forEach(f => {
        customFieldsJson[f.key] = { label: f.label, value: f.value, type: f.type };
      });

      const payload: any = {
        ...form,
        price: form.price ? parseFloat(form.price) : null,
        mrp: form.mrp ? parseFloat(form.mrp) : null,
        wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null,
        quantity: parseInt(form.quantity) || 0,
        sizeInventory: Object.keys(sizeInventory).length > 0 ? sizeInventory : null,
        customFields: Object.keys(customFieldsJson).length > 0 ? customFieldsJson : null,
        generatedImages,
      };

      const res = await fetch(
        isEdit ? `/api/admin/products/${productId}` : '/api/admin/products',
        { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setSuccess(true);
      setTimeout(() => { if (!isEdit) router.push(`/admin/inventory/${data.product.id}`); }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-charcoal-muted">Loading product...</p>
      </div>
    );
  }

  // ─── Section Header helper ───
  const SectionHeader = ({ id, title, icon: Icon, badge }: { id: string; title: string; icon: any; badge?: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between cursor-pointer group"
    >
      <h2 className="font-display text-base font-bold text-charcoal flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent" />
        {title}
        {badge && <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-bg text-accent font-bold border border-accent-border">{badge}</span>}
      </h2>
      {openSections[id] ? <ChevronUp className="w-4 h-4 text-charcoal-muted" /> : <ChevronDown className="w-4 h-4 text-charcoal-muted" />}
    </button>
  );

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push('/admin/inventory')}
            className="flex items-center gap-1.5 text-xs text-charcoal-muted hover:text-charcoal mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory
          </button>
          <h1 className="font-display text-2xl font-bold text-charcoal">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isEdit && (
            <button
              type="button"
              onClick={() => handleSyncToPickyAssist()}
              disabled={syncingPicky || saving}
              title="Sync this product to Picky Assist (searches first, adds if new, updates diff if changed)"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-cream-border bg-white text-charcoal hover:border-emerald-600 hover:text-emerald-700 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingPicky ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
              <span>{syncingPicky ? 'Syncing...' : 'Sync to Picky Assist'}</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 text-xs text-charcoal cursor-pointer select-none bg-cream-light/60 px-2.5 py-1.5 rounded-lg border border-cream-border">
            <input
              type="checkbox"
              checked={autoSyncOnSave}
              onChange={(e) => setAutoSyncOnSave(e.target.checked)}
              className="accent-accent w-3.5 h-3.5 rounded"
            />
            <span className="font-medium text-[11px]">Auto-sync on save</span>
          </label>

          {success && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
          <Button type="submit" loading={saving} disabled={saving}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </div>

      {pickySyncResult && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-2.5 border shadow-xs animate-fade-in ${
          pickySyncResult.success ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-red-50 text-red-900 border-red-200'
        }`}>
          {pickySyncResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="font-bold">{pickySyncResult.success ? 'Picky Assist Sync Success' : 'Picky Assist Sync Failed'}</p>
              {pickySyncResult.actionTaken === 'updated' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                  VERIFIED & UPDATED EXISTING IN PICKY
                </span>
              )}
              {pickySyncResult.actionTaken === 'added' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                  NOT FOUND & CREATED NEW IN PICKY
                </span>
              )}
            </div>
            <p className="text-xs">{pickySyncResult.message}</p>
            {pickySyncResult.diff && Object.keys(pickySyncResult.diff).length > 0 && (
              <div className="mt-2 text-[11px] font-mono bg-white/70 p-2 rounded-lg border border-emerald-300">
                <span className="font-bold text-emerald-950 block mb-1">Updated Fields in Picky Assist:</span>
                {Object.entries(pickySyncResult.diff).map(([k, v]: any) => (
                  <div key={k}>
                    <span className="font-bold">{k}:</span> {JSON.stringify(v.remote)} &rarr; {JSON.stringify(v.local)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Stock Codes */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="core" title="Stock Codes & Identity" icon={Tag} />
            {openSections.core && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Input label="stockCode (Default / Master)" value={form.stockCode}
                      onChange={e => set('stockCode', e.target.value)} placeholder="967699512" required />
                    <p className="text-[10px] text-charcoal-muted mt-1">
                      {Object.keys(sizeInventory).length > 0 
                        ? 'Master / primary stockCode. Each size below has its own individual stockCode.' 
                        : '9+ digit scan stockCode'}
                    </p>
                  </div>
                  <div>
                    <Input label="code1" value={form.friendlyCode}
                      onChange={e => {
                        const val = e.target.value;
                        set('friendlyCode', val);
                        const parts = val.split('-');
                        if (parts.length > 2) {
                          set('color', parts.slice(2).join(' '));
                        } else if (parts.length === 2) {
                          set('color', parts[1]);
                        }
                      }} placeholder="saree-03-red" />
                    <p className="text-[10px] text-charcoal-muted mt-1">Short human-readable alias.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="productCode" value={form.designNumber}
                    onChange={e => set('designNumber', e.target.value)} placeholder="DES-2024-01" />
                  <Input label="Storage Location" value={form.location}
                    onChange={e => set('location', e.target.value)} placeholder="Rack A3, Shelf 2" />
                </div>

                {/* ── PROMINENT SIZE & STOCK MANAGER (PER-SIZE QUANTITIES) ── */}
                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-xs space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200/70">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-charcoal tracking-wide">
                              Sizes & Stock Quantities
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-extrabold border border-amber-300/80">
                              Total: {form.quantity} pcs
                            </span>
                          </div>
                          <p className="text-xs text-charcoal-muted mt-0.5">
                            Manage each size's exact inventory. Total stock updates automatically.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-charcoal-muted font-bold mr-0.5">Quick Add:</span>
                      {['S', 'M', 'L', 'XL', 'XXL', '3XL', 'FS'].map(sz => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            const current = sizeInventory[sz];
                            const baseCode = form.friendlyCode || form.stockCode || 'item';
                            const defaultVariantCode = current?.stockCode || `${baseCode}-${sz}`;
                            const next = {
                              ...sizeInventory,
                              [sz]: {
                                quantity: (current?.quantity || 0) + 1,
                                stockCode: defaultVariantCode,
                              }
                            };
                            setSizeInventory(next);
                            const tot = sumSizeInventory(next);
                            set('quantity', tot.toString());
                            set('size', Object.keys(next).join(', '));
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-amber-100 text-charcoal border border-amber-300 text-xs font-bold transition-all shadow-2xs hover:scale-105 cursor-pointer active:scale-95"
                          title={`Add 1 to size ${sz}`}
                        >
                          +{sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Configured Sizes Cards */}
                  {Object.entries(sizeInventory).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Object.entries(sizeInventory).map(([sKey, sItem]) => {
                        const qty = typeof sItem === 'number' ? sItem : sItem?.quantity || 0;
                        const stockCode = typeof sItem === 'object' ? sItem?.stockCode : null;
                        const stockCodesList: string[] = typeof sItem === 'object' && Array.isArray((sItem as any)?.stockCodes) && (sItem as any).stockCodes.length > 0
                          ? (sItem as any).stockCodes
                          : (stockCode ? String(stockCode).split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean) : []);

                        return (
                          <div
                            key={sKey}
                            className="flex flex-col justify-between p-3 rounded-xl bg-white border border-amber-200/90 shadow-xs hover:border-amber-400 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-1 mb-2">
                              <div className="flex-1 pr-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-black text-charcoal px-2.5 py-1 rounded-lg bg-amber-100/80 border border-amber-200/80 inline-block">
                                    {sKey}
                                  </span>
                                  {stockCodesList.length > 1 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                      {stockCodesList.length} codes
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1.5">
                                  <label className="text-[10px] font-bold text-amber-900/80 uppercase tracking-wider block mb-0.5">
                                    Stock Code(s):
                                  </label>
                                  {stockCodesList.length > 1 && (
                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                      {stockCodesList.map((code, cIdx) => (
                                        <span key={cIdx} className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                          {code}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <input
                                    type="text"
                                    value={stockCode || ''}
                                    placeholder="e.g. 5150000065, 5150000088"
                                    onChange={e => {
                                      const nextVal = e.target.value;
                                      const parsedCodes = nextVal.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
                                      const next = {
                                        ...sizeInventory,
                                        [sKey]: {
                                          quantity: qty,
                                          stockCode: nextVal || null,
                                          stockCodes: parsedCodes,
                                        }
                                      };
                                      setSizeInventory(next);
                                      // If top-level stockCode is empty, auto-populate with first size's stockCode
                                      if (!form.stockCode && parsedCodes[0]) {
                                        set('stockCode', parsedCodes[0]);
                                      }
                                    }}
                                    className="w-full px-2 py-1 text-xs font-mono font-bold text-charcoal bg-amber-50/70 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:bg-white transition-all placeholder:font-sans placeholder:font-normal placeholder:text-charcoal-muted/60"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...sizeInventory };
                                  delete next[sKey];
                                  setSizeInventory(next);
                                  const tot = sumSizeInventory(next);
                                  set('quantity', tot.toString());
                                  const remaining = Object.keys(next);
                                  set('size', remaining.length > 0 ? remaining.join(', ') : '');
                                }}
                                className="p-1 rounded-md text-charcoal-light/60 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                                title={`Remove size ${sKey}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-1 bg-cream-light/40 p-1.5 rounded-lg border border-cream-border/60">
                              <span className="text-xs font-bold text-amber-950 pl-1">
                                {qty} <span className="text-[10px] font-normal text-charcoal-muted">pcs</span>
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = {
                                      ...sizeInventory,
                                      [sKey]: {
                                        quantity: Math.max(0, qty - 1),
                                        stockCode: stockCode || null,
                                      }
                                    };
                                    setSizeInventory(next);
                                    const tot = sumSizeInventory(next);
                                    set('quantity', tot.toString());
                                    const activeSizes = Object.keys(next).filter(k => (next[k]?.quantity ?? 0) > 0);
                                    if (activeSizes.length > 0) set('size', activeSizes.join(', '));
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-cream-dark text-charcoal text-xs font-bold border border-cream-border transition-colors cursor-pointer active:scale-95 shadow-2xs"
                                  title="Decrease quantity by 1"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = {
                                      ...sizeInventory,
                                      [sKey]: {
                                        quantity: qty + 1,
                                        stockCode: stockCode || null,
                                      }
                                    };
                                    setSizeInventory(next);
                                    const tot = sumSizeInventory(next);
                                    set('quantity', tot.toString());
                                    set('size', Object.keys(next).join(', '));
                                  }}
                                  className="w-6 h-6 flex items-center justify-center rounded-md bg-white hover:bg-cream-dark text-charcoal text-xs font-bold border border-cream-border transition-colors cursor-pointer active:scale-95 shadow-2xs"
                                  title="Increase quantity by 1"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 px-4 rounded-xl bg-white/80 border border-dashed border-amber-300 text-center">
                      <p className="text-xs font-medium text-charcoal-muted">
                        No sizes configured yet. Use the inputs below or click the quick presets above to add sizes.
                      </p>
                    </div>
                  )}

                  {/* Add Size Input Row with Per-Size StockCode */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-200/70">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-charcoal">Size:</label>
                        <input
                          type="text"
                          placeholder="e.g. XL, 38, M"
                          value={newSizeKey}
                          onChange={e => setNewSizeKey(e.target.value.toUpperCase())}
                          className="w-28 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-charcoal uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-charcoal">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={newSizeQty}
                          onChange={e => setNewSizeQty(e.target.value)}
                          className="w-16 px-2.5 py-2 rounded-xl border border-amber-300 bg-white text-xs font-bold text-charcoal text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-xs font-bold text-charcoal">StockCode:</label>
                        <input
                          type="text"
                          placeholder="e.g. 5270000094 (optional)"
                          value={newSizeStockCode}
                          onChange={e => setNewSizeStockCode(e.target.value.trim())}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = newSizeKey.trim().toUpperCase();
                              const qtyNum = parseInt(newSizeQty, 10);
                              if (!trimmed || isNaN(qtyNum) || qtyNum < 0) return;
                              const currentItem = sizeInventory[trimmed];
                              const next = {
                                ...sizeInventory,
                                [trimmed]: {
                                  quantity: (currentItem?.quantity || 0) + qtyNum,
                                  stockCode: newSizeStockCode.trim() || currentItem?.stockCode || null,
                                }
                              };
                              setSizeInventory(next);
                              const tot = sumSizeInventory(next);
                              set('quantity', tot.toString());
                              set('size', Object.keys(next).join(', '));
                              setNewSizeKey('');
                              setNewSizeQty('1');
                              setNewSizeStockCode('');
                            }
                          }}
                          className="w-48 px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold text-charcoal focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newSizeKey.trim().toUpperCase();
                          const qtyNum = parseInt(newSizeQty, 10);
                          if (!trimmed || isNaN(qtyNum) || qtyNum < 0) return;
                          const currentItem = sizeInventory[trimmed];
                          const baseCode = form.friendlyCode || form.stockCode || 'item';
                          const generatedCode = newSizeStockCode.trim() || currentItem?.stockCode || `${baseCode}-${trimmed}`;
                          const next = {
                            ...sizeInventory,
                            [trimmed]: {
                              quantity: (currentItem?.quantity || 0) + qtyNum,
                              stockCode: generatedCode,
                            }
                          };
                          setSizeInventory(next);
                          const tot = sumSizeInventory(next);
                          set('quantity', tot.toString());
                          set('size', Object.keys(next).join(', '));
                          setNewSizeKey('');
                          setNewSizeQty('1');
                          setNewSizeStockCode('');
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add Size
                      </button>
                    </div>

                    <div className="text-xs text-charcoal-muted">
                      Size Summary: <span className="font-bold text-charcoal bg-amber-100/60 px-2 py-1 rounded-md border border-amber-200/80">{form.size || 'None'}</span>
                    </div>
                  </div>
                </div>

                {/* ── DESIGN GROUP PANEL ── */}
                {form.designNumber && (
                  <div className={`rounded-xl border p-4 space-y-3 transition-all ${
                    designGroup
                      ? designGroupLinked
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                      : 'bg-cream-light border-cream-border'
                  }`}>
                    {designGroupLoading ? (
                      <div className="flex items-center gap-2 text-xs text-charcoal-muted">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Looking up design group...
                      </div>
                    ) : designGroup ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-charcoal flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${designGroupLinked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              Design Group · <span className="font-mono">{designGroup.designNumber}</span>
                              {designGroupLinked && <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold">LINKED</span>}
                            </p>
                            <p className="text-[10px] text-charcoal-muted mt-0.5">{designGroup.title}</p>
                          </div>
                          {isEdit && (
                            designGroupLinked ? (
                              <button type="button" onClick={handleUnlinkFromGroup} disabled={linkingGroup}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-50 cursor-pointer disabled:opacity-50">
                                {linkingGroup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Unlink
                              </button>
                            ) : (
                              <button type="button" onClick={handleLinkToGroup} disabled={linkingGroup}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[10px] font-bold hover:bg-amber-100 cursor-pointer disabled:opacity-50">
                                {linkingGroup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Link to Group
                              </button>
                            )
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-2">
                            All Stock Codes for this Design ({designGroup.stockEntries.length})
                          </p>
                          <div className="space-y-1.5">
                            {designGroup.stockEntries.map(entry => (
                              <div key={entry.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                entry.id === productId ? 'bg-white border-2 border-accent/50 font-bold' : 'bg-white/60 border border-cream-border'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-charcoal">{entry.stockCode}</span>
                                  {entry.id === productId && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent text-white">THIS</span>}
                                  {entry.location && <span className="text-charcoal-muted">{entry.location}</span>}
                                </div>
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className={`font-bold ${entry.quantity > 0 ? 'text-emerald-700' : 'text-red-500'}`}>Qty: {entry.quantity}</span>
                                  <span className={`px-1.5 py-0.5 rounded-full border font-bold ${
                                    entry.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    entry.status === 'OUT_OF_STOCK' ? 'bg-red-50 text-red-600 border-red-200' :
                                    'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                    {entry.status.replace('_', ' ')}
                                  </span>
                                  {entry.id !== productId && (
                                    <a href={`/admin/inventory/${entry.id}`} className="text-accent hover:underline" target="_blank">Edit →</a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-charcoal">No design group for <span className="font-mono">{form.designNumber}</span></p>
                          <p className="text-[10px] text-charcoal-muted mt-0.5">
                            Create a group to link future stock codes (new batches) to this same design.
                          </p>
                        </div>
                        {isEdit && form.title && (
                          <button type="button" onClick={handleCreateAndLinkGroup} disabled={linkingGroup}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-charcoal text-white text-[10px] font-bold hover:bg-charcoal/80 cursor-pointer disabled:opacity-50 shrink-0">
                            {linkingGroup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create Group
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>


          {/* Product Details */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="garment" title="Product Details" icon={Package} />
            {openSections.garment && (
              <div className="space-y-5 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
                      productName *
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateName}
                      disabled={generatingName}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                      title="AI product-namer for RGJ Dass reading color, motif & mood from photo"
                    >
                      {generatingName ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                          <span>Reading image vibe...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>✨ AI Name from Photo</span>
                        </>
                      )}
                    </button>
                  </div>

                  {!hasProductImages && (
                    <div className="mb-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        <strong>No photo attached:</strong> For best naming accuracy, it is better to upload or generate photos first so the AI can read the actual fabric colors, motif, and drape.
                      </span>
                    </div>
                  )}

                  <input
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="e.g. Coral Bloom (or Coral Bloom — White & Coral Saree)"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                  />

                  {nameSavedNotice && (
                    <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{nameSavedNotice}</span>
                    </div>
                  )}
                  
                  {nameSuggestions && (
                    <div className="mt-2.5 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" /> AI Generated Options (Review & Save to Use):
                        </span>
                        <button
                          type="button"
                          onClick={() => setNameSuggestions(null)}
                          className="text-amber-600 hover:text-amber-800 text-[10px] cursor-pointer"
                        >
                          ✕ dismiss
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Design Name (1-3 words)</span>
                            <span className="font-bold text-slate-900">{nameSuggestions.productName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyName(nameSuggestions.productName)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                          >
                            ✓ Save to Use
                          </button>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                          <div className="truncate">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Catalogue Name</span>
                            <span className="font-bold text-slate-900 truncate block">{nameSuggestions.catalogueTitle}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyName(nameSuggestions.catalogueTitle)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                          >
                            ✓ Save to Use
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Feature Keywords */}
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      Special Craft & Feature Keywords (Included in AI Name, Description & Captions)
                    </label>
                    {aiKeywords && (
                      <button
                        type="button"
                        onClick={() => setAiKeywords('')}
                        className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={aiKeywords}
                    onChange={e => setAiKeywords(e.target.value)}
                    placeholder="e.g. chikankari, handloom cotton, Lucknowi work, summer pastel, zari border..."
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs text-charcoal placeholder:text-slate-400 focus:outline-none focus:border-amber-600"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800">
                    <span className="font-medium text-amber-900">Suggestions:</span>
                    {['Chikankari', 'Kanjivaram', 'Handloom', 'Zari Border', 'Modal Cotton', 'Banarasi Weave'].map(kw => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => {
                          const current = aiKeywords.split(',').map(s => s.trim()).filter(Boolean);
                          if (!current.some(c => c.toLowerCase() === kw.toLowerCase())) {
                            setAiKeywords([...current, kw].join(', '));
                          }
                        }}
                        className="px-2 py-0.5 rounded-full bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        + {kw}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
                      productDescription (used for caption generation)
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateDescription}
                      disabled={generatingDescription}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
                      title="Generate a 2-3 sentence product description with your keywords"
                    >
                      {generatingDescription ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                          <span>Writing description...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>✨ AI Description</span>
                        </>
                      )}
                    </button>
                  </div>
                  <Textarea value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Describe the product — weave, work, occasions, feel..." rows={4} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Colour */}
                  <Input 
                    label="Colour" 
                    value={form.color} 
                    onChange={e => set('color', e.target.value)} 
                    placeholder="e.g. Red, Blue, Custom Colour"
                  />
                  {/* Cloth Type */}
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Fabric / Cloth Type</label>
                    <select value={form.clothType} onChange={e => set('clothType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select fabric...</option>
                      {CLOTH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

              </div>
            )}
          </Card>

          {/* Other Details */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="otherDetails" title="Other Details" icon={Package} />
            {openSections.otherDetails !== false && (
              <div className="space-y-5 pt-1">
                {/* Garment-specific */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Embroidery Type</label>
                    <select value={form.embroideryType} onChange={e => set('embroideryType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select...</option>
                      {EMBROIDERY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Cut Style</label>
                    <select value={form.cutStyle} onChange={e => set('cutStyle', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select...</option>
                      {CUT_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Kurta Length</label>
                    <select value={form.kurtaLength} onChange={e => set('kurtaLength', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select...</option>
                      {KURTA_LENGTHS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Pant Style</label>
                    <select value={form.pantStyle} onChange={e => set('pantStyle', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select...</option>
                      {PANT_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <Input label="Border Details" value={form.border}
                  onChange={e => set('border', e.target.value)} placeholder="e.g. Gold Zari border, 2 inch" />

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Tags</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {form.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-bg text-accent text-xs font-semibold border border-accent-border">
                        {tag}
                        <button type="button" onClick={() => set('tags', form.tags.filter(t => t !== tag))} className="cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      suppressHydrationWarning
                      value={tagInput}
                      onChange={e => {
                        const val = e.target.value;
                        if (val.includes(',')) {
                          const parts = val.split(',');
                          const newTags = parts.slice(0, -1).map(t => t.trim().toLowerCase()).filter(Boolean);
                          if (newTags.length > 0) {
                            set('tags', Array.from(new Set([...form.tags, ...newTags])));
                          }
                          setTagInput(parts[parts.length - 1].trimStart());
                        } else {
                          setTagInput(val);
                        }
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                      placeholder="Type tag + Enter or comma (e.g. bridal, festive, onam)"
                      className="flex-1 px-3 py-2 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                    />
                    <button type="button" onClick={addTag}
                      className="px-3 py-2 rounded-xl border border-cream-border bg-cream-light hover:border-accent text-xs font-semibold cursor-pointer">Add</button>
                  </div>
                </div>

                {/* Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Category</label>
                    <select value={form.categoryId} onChange={e => { set('categoryId', e.target.value); }}
                      className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                      <option value="">Select category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Platform Captions */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="captions" title="Platform Captions" icon={MessageSquare}
              badge={[form.whatsappRetail, form.instagramCaption, form.facebookCaption, form.shopifyTitle].filter(Boolean).length > 0 ? 'Filled' : undefined} />
            {openSections.captions && (
              <div className="space-y-6 pt-1">
                {/* Image Warning if no images attached */}
                {!hasProductImages && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">No product images attached yet:</span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          It is better to generate or upload catalogue photos first for much higher accuracy, so the AI can inspect the real fabric weave, border motifs, and drape. You can still generate captions now based on entered product details.
                        </p>
                      </div>
                    </div>
                    {isEdit && (
                      <a
                        href={`/admin/generate?productId=${productId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shrink-0 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Generate Photos First →
                      </a>
                    )}
                  </div>
                )}

                {/* AI Brand Strategy Banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          RGJ Dass AI Brand Strategy Copywriter
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed max-w-xl">
                        AI crafts retail & wholesale captions grounded in RGJ Dass’s 75-year Secunderabad heritage, 
                        <strong> The Home CEO</strong> and <strong>Professional Connoisseur</strong> personas, and the 
                        <em> 4-minute morning drape</em> ritual (strict banned words filter applied).
                      </p>
                      {aiKeywords && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold pt-1">
                          <Key className="w-3.5 h-3.5 text-amber-700" />
                          <span>Active Keywords:</span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-950 text-[11px] font-bold font-mono">
                            {aiKeywords}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateAllCaptions}
                      disabled={generatingCaptions}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {generatingCaptions ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Generating Draft Captions...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-white" />
                          <span>✨ Generate Captions (Review & Save)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Success feedback when draft was applied to form */}
                {captionsAppliedNotice && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ Captions applied to form! Review them below and click "Save Changes" at the top to save permanently.</span>
                  </div>
                )}

                {/* Draft Review Container (Not automatic - user reviews and clicks Save to Use) */}
                {draftCaptions && (
                  <div className="p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-300 shadow-xs space-y-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          <h3 className="text-sm font-bold text-amber-950">
                            Generated Captions Draft (Review before saving)
                          </h3>
                        </div>
                        <p className="text-xs text-amber-800 mt-0.5">
                          These captions have been generated but are NOT applied yet. Review below and click "Save to Use" to apply them.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDraftCaptions(null)}
                          className="px-3 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors cursor-pointer"
                        >
                          ✕ Discard
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAllDraftCaptions}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save to Use (Apply All)</span>
                        </button>
                      </div>
                    </div>

                    {/* Preview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {draftCaptions.whatsappRetail && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-green-600" /> WhatsApp Retail
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('whatsappRetail', draftCaptions.whatsappRetail)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.whatsappRetail}
                          </p>
                        </div>
                      )}

                      {draftCaptions.whatsappWholesale && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-green-600" /> WhatsApp Wholesale
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('whatsappWholesale', draftCaptions.whatsappWholesale)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.whatsappWholesale}
                          </p>
                        </div>
                      )}

                      {draftCaptions.whatsappCatalogueTitle && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-green-600" /> WhatsApp Catalogue
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('whatsappCatalogueTitle', draftCaptions.whatsappCatalogueTitle)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.whatsappCatalogueTitle}
                          </p>
                        </div>
                      )}

                      {draftCaptions.instagramCaption && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Share2 className="w-3.5 h-3.5 text-pink-600" /> Instagram Caption
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('instagramCaption', draftCaptions.instagramCaption)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.instagramCaption}
                          </p>
                        </div>
                      )}

                      {draftCaptions.facebookCaption && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ThumbsUp className="w-3.5 h-3.5 text-blue-600" /> Facebook Caption
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('facebookCaption', draftCaptions.facebookCaption)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.facebookCaption}
                          </p>
                        </div>
                      )}

                      {draftCaptions.shopifyTitle && (
                        <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Shopify Listing
                            </span>
                            <button
                              type="button"
                              onClick={() => handleApplySingleDraftCaption('shopifyTitle', draftCaptions.shopifyTitle)}
                              className="px-2.5 py-1 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap line-clamp-4 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {draftCaptions.shopifyTitle}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* WhatsApp */}
                <div className="space-y-4 p-4 rounded-xl border border-cream-border bg-cream-light/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-charcoal">WhatsApp Channels</span>
                    </div>
                  </div>

                  {/* WhatsApp Retail */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-charcoal">WhatsApp Retail Caption</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleCaption('whatsappRetail')}
                          disabled={generatingSingleCaption === 'whatsappRetail' || generatingCaptions}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {generatingSingleCaption === 'whatsappRetail' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Redo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText('whatsappRetail', form.whatsappRetail)}
                          disabled={!form.whatsappRetail}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {copiedField === 'whatsappRetail' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'whatsappRetail' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {singleCaptionDraft && singleCaptionDraft.key === 'whatsappRetail' && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSingleCaptionDraft(null)}
                              className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={handleApplySingleRedo}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                          {singleCaptionDraft.value}
                        </p>
                      </div>
                    )}

                    <Textarea value={form.whatsappRetail}
                      onChange={e => set('whatsappRetail', e.target.value)}
                      placeholder="WhatsApp broadcast for retail customers..." rows={4} />
                  </div>

                  {/* WhatsApp Wholesale */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-charcoal">WhatsApp Wholesale Caption (B2B)</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleCaption('whatsappWholesale')}
                          disabled={generatingSingleCaption === 'whatsappWholesale' || generatingCaptions}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {generatingSingleCaption === 'whatsappWholesale' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Redo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText('whatsappWholesale', form.whatsappWholesale)}
                          disabled={!form.whatsappWholesale}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {copiedField === 'whatsappWholesale' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'whatsappWholesale' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {singleCaptionDraft && singleCaptionDraft.key === 'whatsappWholesale' && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSingleCaptionDraft(null)}
                              className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={handleApplySingleRedo}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                          {singleCaptionDraft.value}
                        </p>
                      </div>
                    )}

                    <Textarea value={form.whatsappWholesale}
                      onChange={e => set('whatsappWholesale', e.target.value)}
                      placeholder="WhatsApp message for wholesale partners (MOQ, 4-colour pack, margins)..." rows={4} />
                  </div>

                  {/* WhatsApp Catalogue Title & Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-charcoal">WhatsApp Catalogue Title & Description</label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRegenerateSingleCaption('whatsappCatalogueTitle')}
                          disabled={generatingSingleCaption === 'whatsappCatalogueTitle' || generatingCaptions}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {generatingSingleCaption === 'whatsappCatalogueTitle' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Redo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText('whatsappCatalogueTitle', form.whatsappCatalogueTitle)}
                          disabled={!form.whatsappCatalogueTitle}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                        >
                          {copiedField === 'whatsappCatalogueTitle' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'whatsappCatalogueTitle' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {singleCaptionDraft && singleCaptionDraft.key === 'whatsappCatalogueTitle' && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSingleCaptionDraft(null)}
                              className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              onClick={handleApplySingleRedo}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                            >
                              ✓ Save to Use
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                          {singleCaptionDraft.value}
                        </p>
                      </div>
                    )}

                    <Textarea value={form.whatsappCatalogueTitle}
                      onChange={e => set('whatsappCatalogueTitle', e.target.value)}
                      placeholder="Catalogue listing title + short searchable description..." rows={3} />
                  </div>
                </div>

                {/* Instagram */}
                <div className="space-y-3 p-4 rounded-xl border border-cream-border bg-cream-light/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-pink-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Instagram Caption + Hashtags</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRegenerateSingleCaption('instagramCaption')}
                        disabled={generatingSingleCaption === 'instagramCaption' || generatingCaptions}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {generatingSingleCaption === 'instagramCaption' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Redo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText('instagramCaption', form.instagramCaption)}
                        disabled={!form.instagramCaption}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {copiedField === 'instagramCaption' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'instagramCaption' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {singleCaptionDraft && singleCaptionDraft.key === 'instagramCaption' && (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSingleCaptionDraft(null)}
                            className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={handleApplySingleRedo}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            ✓ Save to Use
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                        {singleCaptionDraft.value}
                      </p>
                    </div>
                  )}

                  <Textarea value={form.instagramCaption}
                    onChange={e => set('instagramCaption', e.target.value)}
                    placeholder="Instagram caption with stop-scroll hook and curated #hashtags..." rows={6} />
                </div>

                {/* Facebook */}
                <div className="space-y-3 p-4 rounded-xl border border-cream-border bg-cream-light/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Facebook Caption + Tags</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRegenerateSingleCaption('facebookCaption')}
                        disabled={generatingSingleCaption === 'facebookCaption' || generatingCaptions}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {generatingSingleCaption === 'facebookCaption' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Redo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText('facebookCaption', form.facebookCaption)}
                        disabled={!form.facebookCaption}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {copiedField === 'facebookCaption' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'facebookCaption' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {singleCaptionDraft && singleCaptionDraft.key === 'facebookCaption' && (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSingleCaptionDraft(null)}
                            className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={handleApplySingleRedo}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            ✓ Save to Use
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                        {singleCaptionDraft.value}
                      </p>
                    </div>
                  )}

                  <Textarea value={form.facebookCaption}
                    onChange={e => set('facebookCaption', e.target.value)}
                    placeholder="Facebook post caption celebrating craft & everyday wearability..." rows={5} />
                </div>

                {/* Shopify */}
                <div className="space-y-3 p-4 rounded-xl border border-cream-border bg-cream-light/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Shopify Title & Description</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRegenerateSingleCaption('shopifyTitle')}
                        disabled={generatingSingleCaption === 'shopifyTitle' || generatingCaptions}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {generatingSingleCaption === 'shopifyTitle' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Redo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText('shopifyTitle', form.shopifyTitle)}
                        disabled={!form.shopifyTitle}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-slate-700 hover:text-black bg-white border border-slate-200 cursor-pointer disabled:opacity-50"
                      >
                        {copiedField === 'shopifyTitle' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'shopifyTitle' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {singleCaptionDraft && singleCaptionDraft.key === 'shopifyTitle' && (
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Generated Alternative:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSingleCaptionDraft(null)}
                            className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            onClick={handleApplySingleRedo}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                          >
                            ✓ Save to Use
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2 rounded-lg border border-amber-200 whitespace-pre-wrap">
                        {singleCaptionDraft.value}
                      </p>
                    </div>
                  )}

                  <Textarea value={form.shopifyTitle}
                    onChange={e => set('shopifyTitle', e.target.value)}
                    placeholder="Shopify product title + 3-paragraph structured SEO description..." rows={6} />
                </div>
              </div>
            )}
          </Card>

          {/* Website & Integration */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="website" title="Website & Integration" icon={Globe} />
            {openSections.website && (
              <div className="space-y-5 pt-1">
                <Input label="Website Product ID" value={form.websiteProductId}
                  onChange={e => set('websiteProductId', e.target.value)}
                  placeholder="e.g. WP-12345 (from your website team)" />
                <Textarea label="Website SEO Description" value={form.websiteCopy}
                  onChange={e => set('websiteCopy', e.target.value)}
                  placeholder="SEO-optimised product description for the website..." rows={5} />
              </div>
            )}
          </Card>

          {/* Custom Columns */}
          <Card className="p-6 space-y-5">
            <SectionHeader id="custom" title="Custom Columns" icon={Settings2}
              badge={customFields.length > 0 ? `${customFields.length} fields` : undefined} />
            {openSections.custom && (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-charcoal-muted">
                  Add any extra columns you need. These are saved per product and can be extended anytime.
                </p>
                {customFields.length > 0 && (
                  <div className="space-y-3">
                    {customFields.map(field => (
                      <div key={field.key} className="flex items-start gap-3 p-3 rounded-xl border border-cream-border bg-cream-light">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-charcoal mb-1">{field.label}</label>
                          <input
                            value={field.value}
                            onChange={e => updateCustomField(field.key, e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent"
                            placeholder={`Enter ${field.label}...`}
                          />
                        </div>
                        <button type="button" onClick={() => removeCustomField(field.key)}
                          className="mt-6 p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 text-charcoal-muted transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showAddCol ? (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-charcoal mb-1">Column Name</label>
                      <input
                        autoFocus
                        value={newColLabel}
                        onChange={e => setNewColLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomColumn(); } }}
                        placeholder="e.g. Supplier Code, Season, Collection"
                        className="w-full px-3 py-2 rounded-xl border border-accent bg-white text-sm text-charcoal focus:outline-none"
                      />
                    </div>
                    <button type="button" onClick={addCustomColumn}
                      className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold cursor-pointer hover:bg-accent/90">
                      Add
                    </button>
                    <button type="button" onClick={() => setShowAddCol(false)}
                      className="px-3 py-2.5 rounded-xl border border-cream-border text-xs font-semibold cursor-pointer hover:border-charcoal">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAddCol(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-accent text-accent text-xs font-bold hover:bg-accent-bg transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Add Custom Column
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">

          {/* Pricing */}
          <Card className="p-6 space-y-4">
            <SectionHeader id="pricing" title="Pricing" icon={Tag} />
            {openSections.pricing && (
              <div className="space-y-4 pt-1">
                <Input label="unitPrice (₹)" type="number" value={form.price}
                  onChange={e => set('price', e.target.value)} placeholder="0.00" />
                <Input label="retailPrice (₹)" type="number" value={form.mrp}
                  onChange={e => set('mrp', e.target.value)} placeholder="0.00" />
                <Input label="dealerPrice (₹)" type="number" value={form.wholesalePrice}
                  onChange={e => set('wholesalePrice', e.target.value)} placeholder="0.00" />
                {form.wholesalePrice && form.price && (
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    Margin: ₹{(parseFloat(form.price) - parseFloat(form.wholesalePrice)).toLocaleString('en-IN')} per piece
                  </p>
                )}
              </div>
            )}
          </Card>

          {/* Stock */}
          <Card className="p-6 space-y-4">
            <SectionHeader id="stock" title="Stock Quantity" icon={Package} />
            {openSections.stock && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5 max-w-[200px]">
                  <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
                    {isEdit ? "Total Stock" : "Initial Total Stock"}
                  </label>
                  <div className="flex items-center gap-2">
                    <button type="button" 
                      onClick={() => set('quantity', Math.max(0, (parseInt(form.quantity) || 0) - 1).toString())}
                      className="w-12 h-12 flex shrink-0 items-center justify-center rounded-xl border border-cream-border bg-cream-light hover:bg-cream-dark hover:border-accent text-charcoal transition-all cursor-pointer">
                      <Minus className="w-5 h-5" />
                    </button>
                    <input type="number" value={form.quantity}
                      onChange={e => set('quantity', e.target.value)} placeholder="0"
                      className="flex-1 w-full px-2 py-3 text-center rounded-xl bg-white border border-cream-border text-charcoal font-bold text-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-200"
                    />
                    <button type="button" 
                      onClick={() => set('quantity', ((parseInt(form.quantity) || 0) + 1).toString())}
                      className="w-12 h-12 flex shrink-0 items-center justify-center rounded-xl border border-cream-border bg-cream-light hover:bg-cream-dark hover:border-accent text-charcoal transition-all cursor-pointer">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* ── SIZE-WISE STOCK BREAKDOWN ── */}
                <div className="border-t border-cream-border pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase">
                      Size Breakdown (Per-Size Quantities)
                    </label>
                    {Object.keys(sizeInventory).length > 0 && (
                      <span className="text-[10px] text-accent font-bold">
                        {Object.keys(sizeInventory).length} sizes configured
                      </span>
                    )}
                  </div>

                  {/* List of configured sizes */}
                  {Object.entries(sizeInventory).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(sizeInventory).map(([sKey, sItem]) => {
                        const qty = typeof sItem === 'number' ? sItem : sItem?.quantity || 0;
                        const stockCode = typeof sItem === 'object' ? sItem?.stockCode : null;

                        return (
                          <div key={sKey} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-cream-light/60 border border-cream-border">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-charcoal px-2.5 py-0.5 rounded-md bg-white border border-cream-border inline-block w-fit">
                                {sKey}
                              </span>
                              {stockCode && (
                                <div className="flex flex-wrap gap-1 mt-1 max-w-[260px]">
                                  {stockCode.split(/[,;]+/).map((c: string, idx: number) => (
                                    <span key={idx} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/90 border border-cream-border text-charcoal font-semibold">
                                      {c.trim()}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = {
                                    ...sizeInventory,
                                    [sKey]: {
                                      quantity: Math.max(0, qty - 1),
                                      stockCode: stockCode || null,
                                    }
                                  };
                                  setSizeInventory(next);
                                  const tot = sumSizeInventory(next);
                                  set('quantity', tot.toString());
                                  const activeSizes = Object.keys(next).filter(k => (next[k]?.quantity ?? 0) > 0);
                                  if (activeSizes.length > 0) set('size', activeSizes.join(', '));
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-cream-border text-charcoal hover:border-accent cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-charcoal">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = {
                                    ...sizeInventory,
                                    [sKey]: {
                                      quantity: qty + 1,
                                      stockCode: stockCode || null,
                                    }
                                  };
                                  setSizeInventory(next);
                                  const tot = sumSizeInventory(next);
                                  set('quantity', tot.toString());
                                  set('size', Object.keys(next).join(', '));
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-cream-border text-charcoal hover:border-accent cursor-pointer"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = { ...sizeInventory };
                                  delete next[sKey];
                                  setSizeInventory(next);
                                  const tot = sumSizeInventory(next);
                                  set('quantity', tot.toString());
                                  const remaining = Object.keys(next);
                                  set('size', remaining.length > 0 ? remaining.join(', ') : '');
                                }}
                                className="p-1.5 text-red-500 hover:text-red-700 cursor-pointer ml-1"
                                title="Remove size"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-charcoal-muted italic">
                      No per-size breakdown added. Add sizes below if this item has multiple sizes (e.g. S, M, L).
                    </p>
                  )}

                  {/* Add size row */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Size (e.g. M)"
                      value={newSizeKey}
                      onChange={e => setNewSizeKey(e.target.value.toUpperCase())}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-cream-border bg-white text-xs font-bold text-charcoal focus:outline-none focus:border-accent"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={newSizeQty}
                      onChange={e => setNewSizeQty(e.target.value)}
                      className="w-14 px-2 py-1.5 rounded-lg border border-cream-border bg-white text-xs font-bold text-charcoal text-center focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newSizeKey.trim().toUpperCase();
                        const qtyNum = parseInt(newSizeQty, 10);
                        if (!trimmed || isNaN(qtyNum) || qtyNum < 0) return;
                        const current = sizeInventory[trimmed];
                        const next = {
                          ...sizeInventory,
                          [trimmed]: {
                            quantity: (current?.quantity || 0) + qtyNum,
                            stockCode: newSizeStockCode.trim() || current?.stockCode || null,
                          }
                        };
                        setSizeInventory(next);
                        const tot = sumSizeInventory(next);
                        set('quantity', tot.toString());
                        set('size', Object.keys(next).join(', '));
                        setNewSizeKey('');
                        setNewSizeQty('1');
                        setNewSizeStockCode('');
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors cursor-pointer"
                    >
                      + Add Size
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Status */}
          <Card className="p-6 space-y-3">
            <h2 className="font-display text-base font-bold text-charcoal">Status</h2>
            {(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED'] as const).map(s => (
              <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.status === s ? 'border-accent bg-accent-bg' : 'border-cream-border hover:border-accent/40'}`}>
                <input type="radio" name="status" value={s} checked={form.status === s}
                  onChange={() => set('status', s)} className="accent-accent" />
                <div>
                  <p className="text-xs font-bold text-charcoal">{s.replace('_', ' ')}</p>
                  <p className="text-[10px] text-charcoal-muted">
                    {s === 'ACTIVE' ? 'Visible and in stock' : s === 'DRAFT' ? 'Hidden from all channels' :
                     s === 'OUT_OF_STOCK' ? 'Visible but sold out' : 'Hidden — permanently retired'}
                  </p>
                </div>
              </label>
            ))}
          </Card>

          {/* Cover Image */}
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-charcoal">Thumbnail</h2>
              {generatedImages && Object.keys(generatedImages).length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const sortedList = Object.entries(generatedImages).sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0));
                    const firstUrl = sortedList[0]?.[1]?.imageUrl;
                    if (firstUrl) setCoverImage(firstUrl);
                  }}
                  className="text-[10px] px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Make photo #1 the cover thumbnail"
                >
                  <Star className="w-3 h-3 text-amber-500 fill-current" /> Use Photo #1 as Cover
                </button>
              )}
            </div>
            
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input label="Cover Image URL" value={form.coverImageUrl}
                  onChange={e => set('coverImageUrl', e.target.value)} placeholder="https://..." />
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCoverImage}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploadingCover}
                />
                <button
                  type="button"
                  disabled={uploadingCover}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cream-border bg-white hover:bg-cream-light text-sm font-semibold text-charcoal transition-colors disabled:opacity-50"
                >
                  {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-accent" />}
                  Upload
                </button>
              </div>
            </div>

            {form.coverImageUrl && (
              <div className="aspect-square rounded-xl overflow-hidden border border-cream-border bg-cream-light relative group">
                <img src={form.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-amber-400 text-amber-950 text-[10px] font-bold shadow-sm flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Cover Image
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Remove cover image?')) {
                      const oldCover = form.coverImageUrl;
                      set('coverImageUrl', '');
                      if (productId) {
                        fetch(`/api/admin/products/${productId}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ coverImageUrl: '' }),
                        }).catch(err => console.warn('Clear cover failed:', err));
                      }
                      const isUsedInCatalogue = generatedImages && Object.values(generatedImages).some(g => g.imageUrl === oldCover);
                      if (!isUsedInCatalogue && oldCover && (oldCover.startsWith('http') || oldCover.startsWith('/api/images/'))) {
                        fetch('/api/upload', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ url: oldCover }),
                        }).catch(console.warn);
                      }
                    }
                  }}
                  title="Remove cover photo"
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/65 hover:bg-red-600 text-white backdrop-blur-md flex items-center justify-center transition-colors shadow-xs cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Card>

          {/* AI Catalogue Photos */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-charcoal flex items-center gap-2 whitespace-nowrap">
                <Sparkles className="w-4 h-4 text-accent shrink-0" /> AI Catalogue Photos
              </h2>
              {isEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleUploadCataloguePhoto}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploadingCatalogue}
                    />
                    <button
                      type="button"
                      disabled={uploadingCatalogue}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cream-border bg-white text-charcoal font-bold hover:bg-cream-light transition-all flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
                      title="Upload one or multiple photos from your device"
                    >
                      {uploadingCatalogue && !catalogueUploadStatus?.startsWith('Drive') ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-accent" />
                          <span>{catalogueUploadStatus ? `Uploading (${catalogueUploadStatus})` : 'Uploading...'}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 shrink-0" />
                          <span>Upload Local</span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenGooglePicker}
                    disabled={uploadingCatalogue}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cream-border bg-white text-charcoal font-bold hover:bg-cream-light transition-all flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
                    title="Select one or multiple photos from Google Drive"
                  >
                    {uploadingCatalogue && catalogueUploadStatus?.startsWith('Drive') ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin shrink-0 text-accent" />
                        <span>{catalogueUploadStatus}</span>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 48 48" className="w-3 h-3 shrink-0">
                          <path fill="#FFC107" d="M17 7.5L31 7.5 45 31.5 31 31.5z"></path>
                          <path fill="#1976D2" d="M3.1 31.5L10.1 43.5 38.1 43.5 31.1 31.5z"></path>
                          <path fill="#4CAF50" d="M17 7.5L3.1 31.5 10.1 43.5 24 19.5z"></path>
                        </svg>
                        <span>Drive</span>
                      </>
                    )}
                  </button>
                  {isPickingPhotos ? (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 text-[10px] text-amber-900 font-semibold shadow-xs">
                      {photosNeedsClickToOpen ? (
                        <button
                          type="button"
                          onClick={openAuthorizedPhotosWindow}
                          className="bg-accent text-white px-2 py-0.5 rounded font-bold hover:bg-accent/90 shadow-xs"
                        >
                          👉 Open Photos Window
                        </button>
                      ) : (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin shrink-0 text-amber-600" />
                          <span className="truncate max-w-[160px]">{photosPickingStatus || 'Photos active...'}</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={cancelPhotosPicking}
                        className="ml-1 text-slate-400 hover:text-rose-600 font-bold px-1 rounded cursor-pointer"
                        title="Cancel selection"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openPhotosPicker}
                      disabled={uploadingCatalogue}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cream-border bg-white text-charcoal font-bold hover:bg-cream-light transition-all flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
                      title="Select photos directly from Google Photos"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0">
                        <path fill="#EA4335" d="M12 2a5 5 0 0 0-5 5v5h5a5 5 0 0 0 0-10z" />
                        <path fill="#4285F4" d="M2 12a5 5 0 0 0 5 5h5v-5a5 5 0 0 0-10 0z" />
                        <path fill="#FBBC04" d="M22 12a5 5 0 0 0-5-5h-5v5a5 5 0 0 0 10 0z" />
                        <path fill="#34A853" d="M12 22a5 5 0 0 0 5-5v-5h-5a5 5 0 0 0 0 10z" />
                      </svg>
                      <span>Photos</span>
                    </button>
                  )}
                  {generatedImages && Object.keys(generatedImages).length >= 2 ? (
                    <button
                      type="button"
                      onClick={() => setShowCollageModal(true)}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-bold hover:opacity-90 transition-all flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                      title="Create wholesale catalogue sheet or social collage"
                    >
                      <Sparkles className="w-3 h-3 shrink-0" /> Collage
                    </button>
                  ) : generatedImages && Object.keys(generatedImages).length === 1 ? (
                    <button
                      type="button"
                      disabled
                      className="text-[10px] px-2 py-1.5 rounded-lg bg-cream-light border border-cream-border text-charcoal-muted font-medium flex items-center gap-1 cursor-not-allowed whitespace-nowrap opacity-60"
                      title="Upload or generate at least 2 photos to create a collage"
                    >
                      <Sparkles className="w-3 h-3 shrink-0" /> Collage (Min 2)
                    </button>
                  ) : null}
                  {generatedImages && Object.keys(generatedImages).length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportAlbumToGooglePhotos}
                      disabled={exportingGooglePhotos}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap shadow-xs cursor-pointer"
                      title={`Save all ${Object.keys(generatedImages).length} photos to Cloudflare R2 & Google Photos in album "${form.friendlyCode || form.stockCode || 'Code1'}"`}
                    >
                      {exportingGooglePhotos ? (
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0">
                          <path fill="#EA4335" d="M12 2a5 5 0 0 0-5 5v5h5a5 5 0 0 0 0-10z" />
                          <path fill="#4285F4" d="M2 12a5 5 0 0 0 5 5h5v-5a5 5 0 0 0-10 0z" />
                          <path fill="#FBBC04" d="M22 12a5 5 0 0 0-5-5h-5v5a5 5 0 0 0 10 0z" />
                          <path fill="#34A853" d="M12 22a5 5 0 0 0 5-5v-5h-5a5 5 0 0 0 0 10z" />
                        </svg>
                      )}
                      <span>{exportingGooglePhotos ? 'Syncing...' : `Save to Photos (${form.friendlyCode || form.stockCode || 'Code1'})`}</span>
                    </button>
                  )}
                  <a href={`/admin/generate?productId=${productId}`}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-accent text-white font-bold hover:bg-accent/90 transition-all flex items-center gap-1 whitespace-nowrap"
                    target="_blank" rel="noreferrer">
                    <ImageIcon className="w-3 h-3 shrink-0" /> Generate Photos
                  </a>
                </div>
              )}
            </div>

            {/* Google Photos Album Sync Success Feedback */}
            {googlePhotosSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold">Album Synced:</span> {googlePhotosSuccess.albumTitle} ({googlePhotosSuccess.photosUploaded} photos saved to Google Photos & R2)
                  </div>
                </div>
                {googlePhotosSuccess.albumUrl && (
                  <a
                    href={googlePhotosSuccess.albumUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition-colors whitespace-nowrap flex items-center gap-1"
                  >
                    <span>Open Album</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            )}

            {generatedImages && Object.keys(generatedImages).length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  {cataloguePhotosList.map((item, idx) => {
                    const isCover = item.isCover;
                    return (
                      <div
                        key={item.poseId}
                        className={`aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                          isCover
                            ? 'border-amber-400 ring-2 ring-amber-300 shadow-md'
                            : 'border-cream-border hover:border-accent/60 shadow-xs'
                        } bg-cream-light group relative`}
                      >
                        {/* The Image (Click to View in Lightbox) */}
                        <div
                          onClick={() => setLightboxIndex(idx)}
                          className="w-full h-full cursor-zoom-in relative"
                          title="Click to view full photo"
                        >
                          <img
                            src={item.imageUrl}
                            alt={`Catalogue Photo #${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />

                          {/* Hover Overlay with Click to View hint */}
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <div className="px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-xl text-white text-[10px] font-bold flex items-center gap-1.5 shadow-md transform translate-y-1 group-hover:translate-y-0 transition-transform">
                              <Eye className="w-3.5 h-3.5 text-accent" />
                              <span>Click to View</span>
                            </div>
                          </div>
                        </div>

                        {/* Top Left: Order Badge + Cover Tag */}
                        <div className="absolute top-2 left-2 flex items-center gap-1 z-10 pointer-events-none">
                          <div className="w-5 h-5 bg-charcoal/85 backdrop-blur-md rounded-md flex items-center justify-center text-white text-[10px] font-bold shadow-xs">
                            {idx + 1}
                          </div>
                          {isCover && (
                            <div className="px-1.5 py-0.5 bg-amber-400 text-amber-950 rounded-md text-[9px] font-extrabold shadow-xs flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5 fill-current" /> COVER
                            </div>
                          )}
                        </div>

                        {/* Top Right: Compact Action Buttons (View + Delete) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxIndex(idx);
                            }}
                            title="View Full Size Photo"
                            className="w-6 h-6 rounded-md bg-black/65 hover:bg-white text-white hover:text-charcoal backdrop-blur-md flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete Photo #${idx + 1}?`)) {
                                deleteImage(item.poseId);
                              }
                            }}
                            title="Delete photo"
                            className="w-6 h-6 rounded-md bg-black/65 hover:bg-red-600 text-white backdrop-blur-md flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Bottom Bar: Cover Setter & Reorder Controls */}
                        <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between z-10">
                          {/* Make Cover Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCoverImage(item.imageUrl);
                            }}
                            title={isCover ? "Current Cover Photo" : "Set as Cover Photo"}
                            className={`px-2 py-1 rounded-md text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs ${
                              isCover
                                ? 'bg-amber-400 text-amber-950'
                                : 'bg-black/65 hover:bg-amber-400 text-white hover:text-amber-950 backdrop-blur-md'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${isCover ? 'fill-current' : ''}`} />
                            <span>{isCover ? 'Cover' : 'Set Cover'}</span>
                          </button>

                          {/* Reorder Arrows */}
                          <div className="flex items-center gap-0.5 bg-black/65 backdrop-blur-md p-0.5 rounded-md shadow-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(item.poseId, 'up');
                              }}
                              disabled={idx === 0}
                              title="Move photo earlier"
                              className="w-5 h-5 flex items-center justify-center text-white hover:bg-white/30 rounded disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(item.poseId, 'down');
                              }}
                              disabled={idx === cataloguePhotosList.length - 1}
                              title="Move photo later"
                              className="w-5 h-5 flex items-center justify-center text-white hover:bg-white/30 rounded disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                            >
                              <ArrowLeft className="w-3 h-3 rotate-180" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Wholesale Catalogue Collage Banner Action */}
                {cataloguePhotosList.length >= 2 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCollageModal(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer group"
                    >
                      <Sparkles className="w-4 h-4 text-amber-200 group-hover:rotate-12 transition-transform shrink-0" />
                      <span>Create Wholesale Catalogue Collage ({cataloguePhotosList.length} Photos)</span>
                      <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/20 text-white ml-0.5">
                        10 Layouts • WhatsApp & Print
                      </span>
                    </button>
                  </div>
                )}

                <div className="space-y-0.5 text-center pt-1">
                  <p className="text-[11px] font-semibold text-charcoal">
                    {cataloguePhotosList.length} Catalogue Photo{cataloguePhotosList.length > 1 ? 's' : ''} (AI & Uploaded)
                  </p>
                  <p className="text-[10px] text-charcoal-muted">
                    Click any photo to view full size. Photo #1 is default cover.
                  </p>
                  {linkedOrderId && (
                    <span className="text-[10px] text-charcoal-muted block font-mono">
                      Session: {linkedOrderId}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold text-charcoal">No AI photos yet</p>
                  <p className="text-[10px] text-charcoal-muted mt-0.5">
                    {isEdit ? 'Click "Generate Photos" to start an AI photoshoot session for this product.' : 'Save the product first, then generate AI catalogue photos.'}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </form>

      {/* Wholesale & Social Collage Studio Modal */}
      {showCollageModal && (
        <CollageCreator
          images={collageImagesList}
          productName={form.title}
          stockCode={form.stockCode || form.friendlyCode}
          designNumber={form.designNumber}
          isOpen={showCollageModal}
          onClose={() => setShowCollageModal(false)}
        />
      )}

      {/* ── HIGH-RES FULLSCREEN PHOTO VIEWER LIGHTBOX (CLICK TO VIEW) ── */}
      {lightboxIndex !== null && cataloguePhotosList[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[250] bg-black/92 backdrop-blur-xl flex flex-col p-3 sm:p-5 text-white animate-fade-in font-sans select-none"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between gap-3 p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 mb-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Photo Info & Cover Status */}
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <div>
                <h3 className="text-sm font-bold tracking-wide">
                  Catalogue Photo {lightboxIndex + 1} of {cataloguePhotosList.length}
                </h3>
                <p className="text-[11px] text-white/60">
                  {cataloguePhotosList[lightboxIndex].isCover ? 'Current Product Cover Image' : 'Click "Make Cover" to use as thumbnail'}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Set as Cover button */}
              <button
                type="button"
                onClick={() => setCoverImage(cataloguePhotosList[lightboxIndex].imageUrl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  cataloguePhotosList[lightboxIndex].isCover
                    ? 'bg-amber-400 text-amber-950 shadow-md'
                    : 'bg-white/15 hover:bg-amber-400 hover:text-amber-950 text-white'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${cataloguePhotosList[lightboxIndex].isCover ? 'fill-current' : ''}`} />
                <span>{cataloguePhotosList[lightboxIndex].isCover ? 'Cover Photo' : 'Make Cover Photo'}</span>
              </button>

              {/* Download Photo */}
              <a
                href={cataloguePhotosList[lightboxIndex].imageUrl}
                download={`catalogue_photo_${lightboxIndex + 1}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Download original photo"
              >
                <Download className="w-4 h-4" />
              </a>

              {/* Open in New Tab */}
              <a
                href={cataloguePhotosList[lightboxIndex].imageUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Open photo URL in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Close viewer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Center Image Stage with Navigation Arrows */}
          <div
            className="flex-1 min-h-0 relative flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev Arrow */}
            {lightboxIndex > 0 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(lightboxIndex - 1)}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-white text-white hover:text-charcoal backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-xl border border-white/20 hover:scale-105"
                title="Previous photo (←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main High-Res Image */}
            <div className="max-w-full max-h-full flex items-center justify-center relative">
              <img
                src={cataloguePhotosList[lightboxIndex].imageUrl}
                alt={`Photo #${lightboxIndex + 1}`}
                className="max-h-[75vh] max-w-[88vw] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/10 transition-all duration-200"
              />
            </div>

            {/* Next Arrow */}
            {lightboxIndex < cataloguePhotosList.length - 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(lightboxIndex + 1)}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-white text-white hover:text-charcoal backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-xl border border-white/20 hover:scale-105"
                title="Next photo (→)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnail Strip */}
          <div
            className="flex items-center justify-center gap-2 p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 mt-3 shrink-0 overflow-x-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {cataloguePhotosList.map((photo, pIdx) => {
              const isSelected = pIdx === lightboxIndex;
              const isCover = photo.isCover;
              return (
                <button
                  key={photo.poseId || pIdx}
                  type="button"
                  onClick={() => setLightboxIndex(pIdx)}
                  className={`relative w-14 h-18 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer border-2 ${
                    isSelected
                      ? 'border-accent ring-2 ring-accent/60 scale-105 shadow-md'
                      : isCover
                      ? 'border-amber-400 opacity-80 hover:opacity-100'
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-black/75 text-white text-[9px] font-bold px-1 rounded">
                    #{pIdx + 1}
                  </div>
                  {isCover && (
                    <div className="absolute bottom-1 right-1 bg-amber-400 text-amber-950 p-0.5 rounded">
                      <Star className="w-2.5 h-2.5 fill-current" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
