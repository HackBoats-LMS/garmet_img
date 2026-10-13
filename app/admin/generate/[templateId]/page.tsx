'use client';

import React, { useEffect, useState, useRef, use, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft, ArrowRight, Upload, X, Sparkles, Download, Check, Camera, Layers,
  Image as ImageIcon, RotateCw, RotateCcw, Maximize2, Eye, Info, ArrowLeftRight, ZoomIn, ZoomOut, CheckCircle2, AlertCircle, ArrowDown, Loader2
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/Input';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { StepIndicator } from '@/app/components/ui/StepIndicator';
import useDrivePicker from 'react-google-drive-picker';
import { useGooglePhotosPicker } from '@/app/hooks/useGooglePhotosPicker';
import { CollageCreator, CollageInputImage } from '@/app/components/CollageCreator';

interface TemplateData {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  systemPrompt?: string | null;
  negativePrompt?: string | null;
  cameraSettings?: string | null;
  allowModelSelection: boolean;
  defaultModelId: string | null;
  allowedModelIds?: string[] | null;
  imageSlots: { id: string; name: string; description: string | null; isRequired: boolean; sampleImageUrl?: string | null; }[];
  customOptions: { id: string; label: string; optionType: string; choices: string[] }[];
  poses: { id: string; name: string; description: string | null; promptSnippet: string; previewImage?: string | null; category: string; purpose?: string | null; fabricFocus?: string | null; }[];
}

interface AIModelData {
  id: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  skinTone: string | null;
  promptAnchor: string;
  isActive: boolean;
}

function AdminGenerateContent({ templateId }: { templateId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const [product, setProduct] = useState<any>(null);
  useEffect(() => {
    // Reset photoshoot session order and state when productId changes
    setOrderId(null);
    setGeneratedImages({});
    setUploadedImages({});
    if (!productId) {
      setProduct(null);
      setProductName('');
      setStockCode('');
      setDescription('');
      return;
    }
    fetch('/api/admin/products/' + productId)
      .then(async r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        return text ? JSON.parse(text) : {};
      })
      .then(d => {
        if (!d.product) return;
        setProduct(d.product);
        setProductName(d.product.productName || d.product.title || '');
        setStockCode(d.product.code1 || d.product.stockCode || '');
        setDescription(d.product.productDescription || d.product.description || '');
        if (d.product.linkedOrderId) {
          setOrderId(d.product.linkedOrderId);
        }
        if (d.product.generatedImages && typeof d.product.generatedImages === 'object') {
          setGeneratedImages(d.product.generatedImages);
        }
        if (d.product.referenceImages && Array.isArray(d.product.referenceImages)) {
          const restoredUploads: Record<string, string> = {};
          d.product.referenceImages.forEach((img: any, idx: number) => {
            if (img?.url) {
              const slotKey = img.slotId || `slot_${idx}`;
              restoredUploads[slotKey] = img.url;
            }
          });
          if (Object.keys(restoredUploads).length > 0) {
            setUploadedImages(restoredUploads);
          }
        }
      }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [models, setModels] = useState<AIModelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Step 1: Details & Images
  const [productName, setProductName] = useState('');
  const [stockCode, setStockCode] = useState('');
  const [description, setDescription] = useState('');
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({});
  const [zoomModal, setZoomModal] = useState<{ slotId: string; title: string; url: string; zoom: number } | null>(null);
  const [poseModal, setPoseModal] = useState<{ name: string; url: string; description: string; purpose?: string; fabricFocus?: string; promptSnippet?: string } | null>(null);
  const [swapDropdownSlot, setSwapDropdownSlot] = useState<string | null>(null);
  const [rotationToast, setRotationToast] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Rotate an uploaded image 90 degrees clockwise (+90) or counter-clockwise (-90) using HTML5 Canvas
  const rotateImageSlot = (slotId: string, angle = 90) => {
    const currentDataUrl = uploadedImages[slotId];
    if (!currentDataUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rad = (angle * Math.PI) / 180;
      if (Math.abs(angle) === 90 || Math.abs(angle) === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setUploadedImages(prev => ({ ...prev, [slotId]: rotatedDataUrl }));
        // Update lightbox if currently open
        setZoomModal(prev => prev && prev.slotId === slotId ? { ...prev, url: rotatedDataUrl } : prev);
        // Show confirmation toast
        setRotationToast(`Orientation rotated ${angle > 0 ? '90° clockwise ↷' : '90° counter-clockwise ↶'}. Rotated photo will be sent directly to AI.`);
        setTimeout(() => setRotationToast(null), 4000);
      }
    };
    img.src = currentDataUrl;
  };

  // Swap images between two slots
  const swapSlots = (fromId: string, toId: string) => {
    setUploadedImages(prev => {
      const next = { ...prev };
      const temp = next[fromId];
      next[fromId] = next[toId];
      next[toId] = temp;
      return next;
    });
  };

  // Step 2: Persona & Model
  const [icp, setIcp] = useState<string>('home_ceo');
  const [occasion, setOccasion] = useState<string>('');
  const [fabricType, setFabricType] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Step: Background Selection
  const [selectedBackground, setSelectedBackground] = useState<string>('');

  const getSuggestedBackgrounds = (occ: string, fab: string): string[] => {
    if (occ) {
      switch (occ) {
        case 'Onam / festival': return ['Mirror or courtyard, warm light', 'Home doorway / living room'];
        case 'Kitty party': return ["Café / friend's living room", 'Living room / dining'];
        case 'Parent-teacher meet': return ['Home entrance w/ bag or car-side', 'Office / car-side / home entrance'];
        case 'Small get-together': return ['Living room / dining', 'Balcony / terrace (open shade)'];
        case 'Workday': return ['Office / car-side / home entrance', 'Home entrance w/ bag or car-side'];
      }
    }
    if (fab) {
      switch (fab) {
        case 'Linen / light cotton': return ['Balcony / terrace (open shade)', "Café / friend's living room"];
        case 'Everyday cotton / ajrakh / print': return ['Home doorway / living room', 'Living room / dining'];
        case 'Tussar / silk / premium': return ['Mirror / dressing corner (warm light)', 'Mirror or courtyard, warm light'];
        case 'Kurti set (any)': return ['Office / car-side / home entrance', 'Home entrance w/ bag or car-side'];
      }
    }
    // Fallback if neither is selected yet
    return ['Living room / dining', 'Home doorway / living room'];
  };

  useEffect(() => {
    const suggested = getSuggestedBackgrounds(occasion, fabricType);
    if (suggested.length > 0 && !suggested.includes(selectedBackground)) {
      setSelectedBackground(suggested[0]);
    }
  }, [occasion, fabricType]);

  // Step 3: Options
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Step 4: Generate
  const [generatedImages, setGeneratedImages] = useState<Record<string, { imageUrl: string; prompt: string }>>({});
  const [generatingPose, setGeneratingPose] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isGeneratingSelected, setIsGeneratingSelected] = useState(false);
  const [selectedPoses, setSelectedPoses] = useState<Set<string>>(new Set());
  const [genStatus, setGenStatus] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Collage Creator Modal State
  const [showCollageModal, setShowCollageModal] = useState(false);
  const collageImagesList: CollageInputImage[] = React.useMemo(() => {
    return Object.entries(generatedImages)
      .filter(([, v]) => Boolean(v?.imageUrl))
      .map(([k, v]) => {
        const pose = template?.poses.find(p => p.id === k || k.startsWith(`${p.id}_`));
        return {
          id: k,
          url: v.imageUrl,
          poseName: pose?.name || k,
        };
      });
  }, [generatedImages, template?.poses]);

  // Step: Image Format
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('3:4');

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [templateId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch template and models independently so one failure doesn't block the other
      let tData: any = {};
      let mData: any = {};

      // Fetch template data
      try {
        const tRes = await fetch(`/api/admin/templates/${templateId}`);
        if (tRes.ok) {
          tData = JSON.parse(await tRes.text() || '{}');
        } else {
          console.error('Template fetch failed with status:', tRes.status);
        }
      } catch (e) {
        console.error('Error fetching template data:', e);
      }

      // Fetch models data (non-blocking — page can work without models)
      try {
        const mRes = await fetch('/api/admin/models');
        if (mRes.ok) {
          mData = JSON.parse(await mRes.text() || '{}');
        } else {
          console.error('Models fetch failed with status:', mRes.status);
        }
      } catch (e) {
        console.error('Error fetching models data:', e);
      }

      setTemplate(tData.template || null);
      const activeModels = (mData.models || []).filter((m: AIModelData) => m.isActive);

      // Filter models accessible for this garment template
      let accessibleModels = activeModels;
      if (Array.isArray(tData.template?.allowedModelIds) && tData.template.allowedModelIds.length > 0) {
        accessibleModels = activeModels.filter((m: AIModelData) => tData.template.allowedModelIds.includes(m.id));
      }
      setModels(accessibleModels);

      // Auto-select default model or first accessible model
      const preferredDefault = tData.template?.defaultModelId;
      const initialModel = accessibleModels.find((m: AIModelData) => m.id === preferredDefault)?.id || accessibleModels[0]?.id || '';
      if (initialModel) {
        setSelectedModelId(initialModel);
      }
    } catch (err) {
      console.error('fetchData unexpected error:', err);
    } finally {
      // ALWAYS stop loading — even if everything fails, show the UI
      setLoading(false);
    }
  };

  // Dynamic steps based on template config
  const getSteps = () => {
    const steps = [
      { label: 'Details & Photos' },
      { label: 'Background' },
    ];
    if (template?.allowModelSelection) {
      steps.push({ label: 'Choose Model' });
    }
    if ((template?.customOptions?.length || 0) > 0) {
      steps.push({ label: 'Garment Options' });
    }
    steps.push({ label: 'Image Format' });
    steps.push({ label: 'AI Photoshoot' });
    steps.push({ label: 'Gallery & Download' });
    return steps;
  };

  const steps = getSteps();

  // Map logical step index to actual step content
  const getStepContent = () => {
    let stepMap: string[] = ['details', 'background'];
    if (template?.allowModelSelection) stepMap.push('model');
    if ((template?.customOptions?.length || 0) > 0) stepMap.push('options');
    stepMap.push('format');
    stepMap.push('generate');
    stepMap.push('save');
    return stepMap[currentStep] || 'details';
  };

  const currentContent = getStepContent();
  // Drag & Drop State
  const [dragActiveSlot, setDragActiveSlot] = useState<string | null>(null);
  const [openPicker, authResponse] = useDrivePicker();

  const handleOpenGooglePicker = (slotId: string) => {
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
      multiselect: false,
      callbackFunction: async (data: any) => {
        if (data.action === 'picked') {
          const doc = data.docs[0];
          const token = (authResponse as any)?.access_token || data.oauthToken;
          
          if (doc.id) {
            try {
              const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                const blob = await res.blob();
                processImageFile(slotId, new File([blob], doc.name || "google_photo.jpg", { type: blob.type }));
                return;
              }
            } catch (err) {
              console.warn("Drive v3 download failed", err);
            }
          }
          if (doc.url) {
            processImageUrl(slotId, doc.url);
          }
        }
      }
    });
  };

  const [activePhotosSlotId, setActivePhotosSlotId] = useState<string | null>(null);

  const {
    openPhotosPicker,
    openAuthorizedPhotosWindow,
    needsClickToOpen: photosNeedsClickToOpen,
    isPicking: isPickingPhotos,
    pickingStatus: photosPickingStatus,
    cancelPicking: cancelPhotosPicking,
  } = useGooglePhotosPicker({
    maxItems: 1,
    onPhotosSelected: async (photos) => {
      if (!photos || photos.length === 0 || !activePhotosSlotId) return;
      const p = photos[0];
      try {
        const arr = p.base64.split(',');
        const mime = p.mimeType || arr[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1] || arr[0]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], p.filename || 'google_photo.jpg', { type: mime });
        processImageFile(activePhotosSlotId, file);
      } catch (convErr) {
        console.warn('Failed to convert photo base64 to file', convErr);
      }
    },
    onError: (err) => {
      alert(err);
    },
  });

  const handleOpenGooglePhotosPicker = (slotId: string) => {
    setActivePhotosSlotId(slotId);
    openPhotosPicker();
  };
  const [analyzingSwatch, setAnalyzingSwatch] = useState(false);
  const [swatchAnalysis, setSwatchAnalysis] = useState<{
    title?: string;
    craft?: string;
    primaryColor?: string;
    bodyMotifs?: string;
    borderDesign?: string;
    palluDesign?: string;
    fabricNotes?: string;
  } | null>(null);

  // Unified image processing (canvas compression to 1024px jpeg)
  const processImageFile = async (slotId: string, file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 1024;
        let w = img.width, h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
          else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setUploadedImages(prev => ({ ...prev, [slotId]: dataUrl }));
        setValidationError(null);

        // Trigger AI Swatch Vision Analysis for rich micro-textile details
        try {
          setAnalyzingSwatch(true);
          const anRes = await fetch('/api/analyze-swatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: dataUrl }),
          });
          if (anRes.ok) {
            const anData = await anRes.json();
            if (anData?.analysis) {
              setSwatchAnalysis(anData.analysis);
              if (!productName && anData.analysis.title) {
                setProductName(anData.analysis.title);
              }
              if (!description && anData.analysis.fabricNotes) {
                setDescription(anData.analysis.fabricNotes);
              }
            }
          }
        } catch (err) {
          console.warn('[Swatch Analysis] Error:', err);
        } finally {
          setAnalyzingSwatch(false);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImageUrl = async (slotId: string, url: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1024;
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setUploadedImages(prev => ({ ...prev, [slotId]: dataUrl }));
      setValidationError(null);

      // Trigger AI Swatch Vision Analysis for rich micro-textile details
      try {
        setAnalyzingSwatch(true);
        const anRes = await fetch('/api/analyze-swatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl }),
        });
        if (anRes.ok) {
          const anData = await anRes.json();
          if (anData?.analysis) {
            setSwatchAnalysis(anData.analysis);
            if (!productName && anData.analysis.title) {
              setProductName(anData.analysis.title);
            }
            if (!description && anData.analysis.fabricNotes) {
              setDescription(anData.analysis.fabricNotes);
            }
          }
        }
      } catch (err) {
        console.warn('[Swatch Analysis] Error:', err);
      } finally {
        setAnalyzingSwatch(false);
      }
    };
    img.onerror = () => {
      console.error('Failed to load image from URL:', url);
    };
    img.src = url;
  };

  const handleImageUpload = (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(slotId, file);
  };

  const handleDragOver = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveSlot(slotId);
  };

  const handleDragLeave = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragActiveSlot === slotId) {
      setDragActiveSlot(null);
    }
  };

  const handleDrop = (slotId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveSlot(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(slotId, file);
    }
  };

  // Compress image for API transmission (1024px max, 85% JPEG quality for better clarity)
  const compressImageForAPI = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1024;
            let w = img.width, h = img.height;
            if (w > MAX_DIM || h > MAX_DIM) {
              if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
              else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
            }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) {
            console.warn('[Compress] Canvas tainted or error:', e);
            resolve(dataUrl); // Fallback to raw if compression fails
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    });
  };

  // Combine multiple images into a single grid canvas (for APIs that only accept 1 image)
  const createGridComposite = (images: string[]): Promise<string> => {
    return new Promise((resolve) => {
      if (!images || images.length === 0) return resolve('');
      if (images.length === 1) return resolve(images[0]); // No need to composite if only 1 image

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(images[0]);

      // Standardize size to 1024x1024
      canvas.width = 1024;
      canvas.height = 1024;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 1024);

      let loadedImages = 0;
      const imgElements: HTMLImageElement[] = [];

      images.forEach((src, idx) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          imgElements[idx] = img;
          loadedImages++;
          if (loadedImages === images.length) {
            // Draw grid
            if (images.length === 2) {
              // 1x2 layout (side by side)
              ctx.drawImage(imgElements[0], 0, 0, 512, 1024);
              ctx.drawImage(imgElements[1], 512, 0, 512, 1024);
            } else if (images.length >= 3) {
              // 2x2 grid
              ctx.drawImage(imgElements[0], 0, 0, 512, 512);
              ctx.drawImage(imgElements[1], 512, 0, 512, 512);
              if (imgElements[2]) ctx.drawImage(imgElements[2], 0, 512, 512, 512);
              if (imgElements[3]) ctx.drawImage(imgElements[3], 512, 512, 512, 512);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          }
        };
        img.onerror = () => {
          loadedImages++;
          if (loadedImages === images.length) resolve(images[0] || ''); // fallback
        };
        img.src = src;
      });
    });
  };

  // Generate single pose
  const handleGeneratePose = async (poseId: string) => {
    const pose = template?.poses.find(p => p.id === poseId);
    const model = models.find(m => m.id === selectedModelId);
    if (!pose || !template) return;

    setGeneratingPose(poseId);
    setGenError(null);

    // Build options string
    const optStr = Object.entries(selectedOptions)
      .map(([id, val]) => {
        const opt = template.customOptions.find(o => o.id === id);
        return opt ? `${opt.label}: ${val}` : '';
      })
      .filter(Boolean)
      .join(', ');

    // Collect ALL raw uploaded fabric images for Gemini (it can see each one separately)
    const allFabricImages = (template?.imageSlots || [])
      .map(slot => uploadedImages[slot.id])
      .filter(Boolean);
    // Fallback if no slots defined
    if (allFabricImages.length === 0) {
      const vals = Object.values(uploadedImages).filter(Boolean);
      allFabricImages.push(...vals);
    }

    // Compress all images to 512px / 60% JPEG for API (avoids 413 payload-too-large)
    setGenStatus('Compressing images for AI...');
    const compressedUploadedImages: Record<string, string> = {};
    for (const key of Object.keys(uploadedImages)) {
      if (uploadedImages[key]) {
        compressedUploadedImages[key] = await compressImageForAPI(uploadedImages[key]);
      }
    }
    const compressedFabricImages = await Promise.all(
      allFabricImages.map(img => compressImageForAPI(img as string))
    );
    const rawGarmentRef = compressedFabricImages[0] || null;
    const validImages = compressedFabricImages;

    // Model Subject & Identity
    const modelSubject = model?.imageUrl
      ? `A stunning, high-fashion Indian female model (with identical facial likeness, natural Indian skin tone, dark eyes, and elegant posture as shown in the selected model persona)`
      : (model?.promptAnchor || 'A radiant Indian female fashion model with natural skin texture, serene facial expression, and elegant posture');

    // Build ultra-specific garment textile description
    let textileDetails = '';
    if (swatchAnalysis) {
      const parts: string[] = [];
      if (swatchAnalysis.craft) parts.push(`Craft: Authentic ${swatchAnalysis.craft}`);
      if (swatchAnalysis.primaryColor) parts.push(`Color Palette: ${swatchAnalysis.primaryColor}`);
      if (swatchAnalysis.bodyMotifs) parts.push(`Saree Main Body: ${swatchAnalysis.bodyMotifs}`);
      if (swatchAnalysis.borderDesign) parts.push(`Border Trims: ${swatchAnalysis.borderDesign}`);
      if (swatchAnalysis.palluDesign) parts.push(`Grand Pallu Styling: ${swatchAnalysis.palluDesign}`);
      if (swatchAnalysis.fabricNotes) parts.push(`Fabric Weave & Texture: ${swatchAnalysis.fabricNotes}`);
      textileDetails = parts.join('. ');
    } else if (description) {
      textileDetails = `Garment Fabric & Motifs: ${description}`;
    }

    const isSaree = template.slug?.toLowerCase().includes('saree');
    const isKurti = template.slug?.toLowerCase().includes('kurti') || template.slug?.toLowerCase().includes('kurta');
    const isLehenga = template.slug?.toLowerCase().includes('lehenga');
    
    let dynamicStyling = '';
    if (isSaree) {
      const hasBlouseImage = Object.keys(uploadedImages).some(slotId => {
        const slot = template?.imageSlots.find(s => s.id === slotId);
        return slot && slot.name.toLowerCase().includes('blouse');
      });

      if (hasBlouseImage) {
        dynamicStyling = optStr ? `Blouse & Custom Styling: Fitted designer blouse accurately matching the provided blouse fabric image with ${optStr}.` : 'Blouse: Perfectly fitted designer blouse accurately matching the provided blouse fabric image.';
      } else {
        dynamicStyling = optStr ? `Blouse & Custom Styling: Automatically generated fitted matching designer blouse complementing the saree body and border with ${optStr}.` : 'Blouse: Automatically generated perfectly fitted matching designer blouse complementing the saree body and border.';
      }
    } else if (isKurti) {
      let kurtiDetails = '';
      const hasPant = !!uploadedImages['kurti_pant'] || !!uploadedImages['bottom_pant'];
      const hasDupatta = !!uploadedImages['kurti_dupatta'];

      if (hasPant && hasDupatta) {
        kurtiDetails = 'Styling: Perfectly matching bottom pant and gracefully draped dupatta matching the provided fabric images.';
      } else if (hasPant) {
        kurtiDetails = 'Styling: Perfectly matching bottom pant matching the provided fabric image, without any dupatta.';
      } else {
        kurtiDetails = 'Styling: Perfectly matching complementary bottom pant designed to match the kurti body, without any dupatta.';
      }
      dynamicStyling = optStr ? `${kurtiDetails} Custom Details: ${optStr}.` : kurtiDetails;
    } else if (isLehenga) {
      dynamicStyling = optStr ? `Lehenga Styling: ${optStr}.` : 'Styling: Perfectly matching choli and gracefully draped dupatta.';
    } else {
      dynamicStyling = optStr ? `Styling: ${optStr}.` : '';
    }

    const backgroundSetting = selectedBackground ? `Background Setting: ${selectedBackground}.` : 'Background Setting: high-end luxury fashion studio.';

    const garmentDrapeDetails = isSaree 
      ? 'CRITICAL INSTRUCTION: You MUST strictly replicate the EXACT geometric patterns, motif scale, shapes, and border placements shown in the provided reference fabric images. Do NOT invent generic patterns. Do NOT mix or blend the patterns from the different uploaded images; keep the pallu (shoulder drape) design strictly separate from the main body design. The final garment must perfectly match the visual texture and layout of the uploaded fabric swatches. The fabric must be fully opaque and flawlessly continuous—absolutely NO skin showing through the fabric, no sheer patches, no rips, and no distorted blending artifacts. Natural fabric texture, authentic crisp pleated folds, and graceful shoulder pallu drape.' 
      : 'CRITICAL INSTRUCTION: You MUST strictly replicate the EXACT patterns, motif scale, shapes, and border placements shown in the provided reference fabric images. Do NOT invent generic patterns. Do NOT mix or blend the patterns from the different uploaded images. The fabric must be fully opaque and flawlessly continuous—absolutely NO skin showing through the fabric, no sheer patches, and no blending artifacts. Natural fabric texture, authentic crisp folds, and graceful drape.';

    const isMirrorPose = pose.name.toLowerCase().includes('mirror') || (pose.promptSnippet && pose.promptSnippet.toLowerCase().includes('mirror'));

    const mirrorPhysicsGuidance = isMirrorPose
      ? ' CRITICAL OPTICAL PHYSICS & RAY-TRACED MIRROR ACCURACY: Camera is positioned over-the-shoulder 45 degrees behind the model looking into the dressing mirror. The mirror reflection must obey real-world optical physics: the reflection cleanly shows the model looking directly into her own eyes in the glass with a calm, composed expression. Her raised hand adjusting her shoulder pallu pin must geometrically and symmetrically mirror her true physical 3D position in the foreground with matching directional lighting, ambient shadows, and jewelry. Coherent single human identity, realistic reflection depth, zero optical distortion, and zero warped limbs.'
      : '';

    const mirrorNegative = isMirrorPose
      ? ', broken mirror physics, distorted reflection, impossible reflection angle, reflection looking at camera while body faces away, double faces, duplicate limbs, floating hands, misaligned reflections, uncanny valley reflection, two different people in mirror, warped glass'
      : '';

    // Construct full photorealistic photoshoot prompt: Subject -> Wearing Garment -> Pose -> Styling -> Lighting & Camera
    const prompt = `Authentic raw commercial catalogue fashion photography of ${modelSubject} elegantly dressed in an authentic luxury ${productName || template.name}. ${backgroundSetting} Pose & Angle: ${pose.name} — ${pose.promptSnippet}.${mirrorPhysicsGuidance} Garment & Draping: ${garmentDrapeDetails} ${textileDetails ? `${textileDetails}. ` : ''}${dynamicStyling} Photography & Aesthetics: Shot on Hasselblad H6D-100c with HC 100mm f/2.2 lens, softbox key lighting, soft natural ambient shadows, photorealistic skin with natural pores and subtle skin texture, realistic hands and fingers, 8k UHD editorial Vogue India fashion catalogue, zero CGI, zero plastic skin, authentic human realism.`;

    // Compress model face if it's a data URL
    let compressedModelFace = model?.imageUrl || null;
    if (compressedModelFace && compressedModelFace.startsWith('data:image/')) {
      compressedModelFace = await compressImageForAPI(compressedModelFace);
    }

    try {
      // Fetch the configured generation API route (generate vs generate-flux)
      let activeApiRoute = 'generate';
      try {
        const cfgRes = await fetch('/api/admin/studio-config');
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          if (cfgData?.config?.apiRoute) activeApiRoute = cfgData.config.apiRoute;
        }
      } catch (e) {
        console.warn('Failed to fetch studio config for apiRoute', e);
      }

      const res = await fetch(`/api/${activeApiRoute}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negativePrompt: `doll, plastic skin, barbie doll, mannequin, porcelain face, 3d render, CGI, digital illustration, cartoon, anime, airbrushed, wax figure, fake eyes, artificial skin, smooth skin filter, oversaturated, blurry, flat fabric swatch, cloth only, fabric texture without person, textile pattern sample, no human, no person, bad anatomy, deformed limbs, deformed fingers, extra limbs, mutated hands, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses${mirrorNegative}`,
          referenceImageUrl: rawGarmentRef,
          modelFaceUrl: compressedModelFace,
          posePreviewUrl: pose.previewImage || null,
          garment_des: textileDetails || (productName ? `${productName} ${description || ''}` : description || prompt),
          category: template.slug?.includes('pant') || template.slug?.includes('skirt') ? 'lower_body' : (template.slug?.includes('saree') || template.slug?.includes('dress') || template.slug?.includes('lehenga') ? 'dresses' : 'upper_body'),
          crop: false,
          seed: 42,
          steps: 30,
          userId: (session?.user as any)?.id || 'customer',
          templateId: template.id,
          orderId: orderId || `order_${Date.now()}`,
          productId: productId || null,
          poseId: pose.id,
          productName: productName || template.name,
          stockCode: stockCode || null,
          description: description || null,
          uploadedImages: compressedUploadedImages,
          icp,
          occasion,
          fabricType,
          selectedModelId,
          selectedOptions,
          aspectRatio: selectedAspectRatio,
          referenceImages: [
            ...(validImages.length > 0 ? validImages : []),
            ...(compressedModelFace ? [compressedModelFace] : []),
          ],
        }),
      });

      const data = await res.json();
      let finalUrl = (data?.imageUrl || '').trim().replace(/[\\'";,\s]+$/, '').replace(/%5C$/i, '');

      // Poll if processing
      if (!finalUrl && data?.taskId && (data?.isProcessing || res.status === 202)) {
        setGenStatus(`Generating ${pose.name}...`);
        const providerParam = data?.provider ? `&provider=${data.provider}` : '';
        // Poll up to 150 times (every 2.5s) = ~6 additional minutes of waiting
        for (let i = 0; i < 150; i++) {
          const uId = (session?.user as any)?.id || 'customer';
          const oId = orderId || 'order';
          const pIdParam = productId ? `&productId=${productId}` : '';
          const check = await fetch(`/api/task-status?taskId=${data.taskId}&userId=${uId}&orderId=${oId}&poseId=${pose.id}${providerParam}${pIdParam}`);
          if (check.ok) {
            const cd = await check.json();
            if (cd.status === 'completed' && cd.imageUrl) {
              finalUrl = (cd.imageUrl as string).trim().replace(/[\\'";,\s]+$/, '').replace(/%5C$/i, '');
              break;
            }
            if (cd.status === 'failed') { setGenError(cd.error || 'Generation failed'); break; }
          }
          await new Promise((r) => setTimeout(r, 2500));
        }
      }

      if (finalUrl) {
        finalUrl = finalUrl.trim().replace(/[\\'";,\s]+$/, '').replace(/%5C$/i, '');
        
        // Create the updated images object with a unique timestamp key to allow multiple generations of the same pose
        const uniqueKey = `${poseId}_${Date.now()}`;
        const updatedImages = { ...generatedImages, [uniqueKey]: { imageUrl: finalUrl, prompt } };
        setGeneratedImages(updatedImages);
        
        // Auto-save immediately so the image shows up in the gallery
        // even if the user navigates away before clicking "Save & Download"
        await handleSaveOrder(updatedImages);
        
        setGenStatus(`${pose.name} generated!`);
        setTimeout(() => setGenStatus(null), 3000);
      } else if (!genError) {
        setGenError(data?.error || 'Generation is still processing.');
      }
    } catch (err: any) {
      setGenError(err?.message || 'Network error occurred');
    } finally {
      setGeneratingPose(null);
    }
  };

  // Generate all poses
  const handleGenerateAll = async () => {
    if (!template?.poses?.length) return;
    setIsGeneratingAll(true);
    for (const pose of template.poses) {
      await handleGeneratePose(pose.id);
    }
    setIsGeneratingAll(false);
  };

  // Generate selected poses
  const handleGenerateSelected = async () => {
    if (selectedPoses.size === 0) return;
    setIsGeneratingSelected(true);
    for (const poseId of Array.from(selectedPoses)) {
      await handleGeneratePose(poseId);
    }
    setIsGeneratingSelected(false);
  };

  // Save order
  const handleSaveOrder = async (overrideImages?: Record<string, { imageUrl: string; prompt: string }>) => {
    if (!session?.user || !template) return;
    const userId = (session.user as any).id;

    const res = await fetch('/api/customer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: orderId,
        productId: productId || undefined,
        userId,
        templateId: template.id,
        productName,
        stockCode,
        description,
        uploadedImages,
        icp,
        occasion,
        fabricType,
        selectedModelId,
        selectedBackground,
        selectedOptions,
        aspectRatio: selectedAspectRatio,
        generatedImages: overrideImages || generatedImages,
        status: 'completed',
      }),
    });

    const data = await res.json();
    if (data.order?.id) setOrderId(data.order.id);
  };

  // Download image
  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-charcoal-muted">Loading photoshoot wizard...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-medium text-charcoal">Failed to load template data</p>
        <p className="text-xs text-charcoal-muted">Please check your connection and try again.</p>
        <Button onClick={() => fetchData()} variant="primary">Retry</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 animate-fade-in">
      {/* Template Header */}
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full bg-accent-bg text-accent text-xs font-semibold uppercase tracking-wider mb-2">
          {template.name}
        </span>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-charcoal">
          {template.tagline || `Create your ${template.name} photoshoot`}
        </h1>
      </div>

      {/* Step Indicator */}
      <div className="mb-10 max-w-xl mx-auto">
        <StepIndicator steps={steps} currentStep={currentStep} />
      </div>

      {/* ──── STEP: DETAILS & PHOTOS ──── */}
      {currentContent === 'details' && (
        <div className="space-y-8 animate-slide-in">
          {validationError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Action Required</p>
                <p className="text-xs text-red-700 mt-1">{validationError}</p>
              </div>
            </div>
          )}
          <Card className="p-8 space-y-6">
            <h2 className="font-display text-lg font-bold text-charcoal border-b border-cream-border/60 pb-3">
              1. Garment Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input label="Product Name" value={productName} onChange={e => { setProductName(e.target.value); setValidationError(null); }} placeholder="e.g. Royal Emerald Kanchipuram" required />
              <Input label="Code1 (optional)" value={stockCode} onChange={e => setStockCode(e.target.value)} placeholder="e.g. saree-03-red" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Occasion (Background rules apply)</label>
                <select value={occasion} onChange={e => setOccasion(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                  <option value="">Blank (Use Fabric rules)</option>
                  <option value="Onam / festival">Onam / festival</option>
                  <option value="Kitty party">Kitty party</option>
                  <option value="Parent-teacher meet">Parent-teacher meet</option>
                  <option value="Small get-together">Small get-together</option>
                  <option value="Workday">Workday</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-charcoal tracking-wide uppercase mb-1.5">Fabric (If occasion is blank)</label>
                <select value={fabricType} onChange={e => setFabricType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent">
                  <option value="">Select Fabric...</option>
                  <option value="Linen / light cotton">Linen / light cotton</option>
                  <option value="Everyday cotton / ajrakh / print">Everyday cotton / ajrakh / print</option>
                  <option value="Tussar / silk / premium">Tussar / silk / premium</option>
                  <option value="Kurti set (any)">Kurti set (any)</option>
                </select>
              </div>
            </div>
            <Textarea label="Garment Description & Fabric Details" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the weave, borders, zari work, and drape..." rows={3} />
          </Card>

          {/* Image Upload Slots & Positioning Guide */}
          <Card className="p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-charcoal flex items-center gap-2">
                    <span>2. Upload Garment Photos & Fabric Swatches</span>
                    <Badge variant="accent">Accuracy First</Badge>
                  </h2>
                  <p className="text-xs text-charcoal-muted mt-1">
                    Upload crisp photos for each section. Rotate sideways photos with 🔄 so borders and motifs are upright for the AI photoshoot.
                  </p>
                </div>
              </div>

              {/* Dynamic Visual Example Reference Photos Banner */}
              {template.imageSlots.some(s => s.sampleImageUrl) && (
                <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-charcoal space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>💡 {template.name} Reference Swatch Examples:</span>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300/40">
                      Real Photo Guide
                    </span>
                  </div>

                  <p className="text-xs text-charcoal-muted leading-relaxed">
                    Upload crisp photos for each section below. Click any sample below to inspect the ideal framing:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {template.imageSlots.filter(s => s.sampleImageUrl).map((slot, idx) => (
                      <div
                        key={slot.id}
                        onClick={() => setZoomModal({ slotId: `sample_${slot.id}`, title: `Example: ${slot.name}`, url: slot.sampleImageUrl!, zoom: 1 })}
                        className="group relative rounded-xl overflow-hidden border border-amber-500/30 bg-white shadow-xs cursor-zoom-in hover:border-amber-600 transition-all hover:shadow-md"
                      >
                        <div className="aspect-[3/4] w-full overflow-hidden bg-cream">
                          <img src={slot.sampleImageUrl!} alt={`Sample for ${slot.name}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                        <div className="p-2.5 bg-white/95 border-t border-amber-500/20">
                          <div className="flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">{idx + 1}</span>
                            <p className="text-[11px] font-bold text-charcoal truncate">{slot.name}</p>
                          </div>
                          <p className="text-[10px] text-charcoal-muted mt-0.5 leading-tight line-clamp-1">{slot.description}</p>
                        </div>
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium flex items-center gap-1">
                          <Eye className="w-3 h-3 text-amber-300" /> View
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-charcoal space-y-3 shadow-xs">
                <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-950">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Upload each section below. Keep borders upright or click <strong>Rotate 90° ↷</strong>.</span>
                  </div>
                  {template.imageSlots.some(s => s.sampleImageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (template?.imageSlots) {
                          const newUploaded: Record<string, string> = { ...uploadedImages };
                          template.imageSlots.forEach(s => {
                            if (s.sampleImageUrl) {
                              newUploaded[s.id] = s.sampleImageUrl;
                            }
                          });
                          setUploadedImages(newUploaded);
                          setRotationToast('✨ Loaded sample reference images into all upload slots!');
                          setTimeout(() => setRotationToast(null), 3500);
                        }
                      }}
                      className="text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer text-[11px]"
                    >
                      ⚡ Use these samples for test generation
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Individual Detailed Image Drop Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {template.imageSlots.map(slot => {
                const isUploaded = !!uploadedImages[slot.id];
                const otherSlots = template.imageSlots.filter(s => s.id !== slot.id);

                return (
                  <div key={slot.id} className="space-y-2 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-charcoal uppercase tracking-wider">{slot.name}</span>
                      {slot.isRequired ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent-bg text-accent">Required</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cream text-charcoal-muted">Optional</span>
                      )}
                    </div>
                    {slot.description && (
                      <p className="text-[11px] text-charcoal-muted leading-tight">{slot.description}</p>
                    )}

                        <div
                          onClick={(e) => {
                            if (!isUploaded) {
                              e.preventDefault();
                              fileInputRefs.current[slot.id]?.click();
                            }
                          }}
                          onDragOver={(e) => handleDragOver(slot.id, e)}
                          onDragEnter={(e) => handleDragOver(slot.id, e)}
                          onDragLeave={(e) => handleDragLeave(slot.id, e)}
                          onDrop={(e) => handleDrop(slot.id, e)}
                          className={`
                            relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all group shadow-xs
                            ${isUploaded ? 'border-cream-border bg-white' : 'cursor-pointer hover:border-accent hover:bg-cream'}
                            ${dragActiveSlot === slot.id ? 'border-accent bg-accent-bg scale-[1.02] ring-4 ring-accent/20' : 'bg-cream-light'}
                          `}
                        >
                      {isUploaded ? (
                        <>
                          {/* Image preview with click to zoom */}
                          <img
                            src={uploadedImages[slot.id]}
                            alt={slot.name}
                            onClick={() => setZoomModal({ slotId: slot.id, title: slot.name, url: uploadedImages[slot.id], zoom: 1 })}
                            className="w-full h-full object-cover cursor-zoom-in group-hover:scale-105 transition-transform duration-300"
                          />

                          {/* Hover action overlay bar */}
                          <div className="absolute inset-0 bg-charcoal/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
                            {/* Top row: View Full + Remove */}
                            <div className="flex items-center justify-between pointer-events-auto">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomModal({ slotId: slot.id, title: slot.name, url: uploadedImages[slot.id], zoom: 1 });
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-charcoal text-xs font-bold shadow-md hover:bg-white transition-colors cursor-pointer"
                                title="View in Full Screen"
                              >
                                <Eye className="w-3.5 h-3.5 text-accent" />
                                <span>Full View</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUploadedImages(prev => { const n = { ...prev }; delete n[slot.id]; return n; });
                                }}
                                className="w-7 h-7 rounded-xl bg-white/90 text-charcoal hover:bg-error hover:text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
                                title="Remove photo"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Center prompt: Click to expand */}
                            <div
                              onClick={() => setZoomModal({ slotId: slot.id, title: slot.name, url: uploadedImages[slot.id], zoom: 1 })}
                              className="text-center pointer-events-auto cursor-zoom-in"
                            >
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold">
                                <Maximize2 className="w-3 h-3 text-amber-400" /> Click to inspect & rotate
                              </span>
                            </div>

                            {/* Bottom row: Rotate & Change photo */}
                            <div className="flex items-center justify-between gap-1.5 pointer-events-auto">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rotateImageSlot(slot.id, -90);
                                }}
                                className="p-1.5 rounded-xl bg-white/90 text-charcoal hover:bg-accent hover:text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                                title="Rotate 90° Counter-Clockwise"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rotateImageSlot(slot.id, 90);
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-white/90 text-charcoal hover:bg-accent hover:text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                                title="Rotate 90° Clockwise"
                              >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>Rotate 90°</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  fileInputRefs.current[slot.id]?.click();
                                }}
                                className="p-1.5 rounded-xl bg-white/90 text-charcoal hover:bg-white text-xs font-bold shadow-md transition-colors cursor-pointer"
                                title="Replace Photo"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6 flex flex-col items-center pointer-events-none">
                          <div className={`
                            w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform shadow-xs
                            ${dragActiveSlot === slot.id ? 'bg-accent text-white scale-110' : 'bg-white border border-cream-border text-charcoal-light group-hover:border-accent group-hover:text-accent'}
                          `}>
                            <ImageIcon className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-semibold text-charcoal">
                            {dragActiveSlot === slot.id ? 'Drop photo here!' : 'Click or drop photo'}
                          </p>
                          <p className="text-[10px] text-charcoal-muted mt-1">JPEG, PNG, WEBP up to 10MB</p>
                        </div>
                      )}

                      <input
                        ref={el => { fileInputRefs.current[slot.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageUpload(slot.id, e)}
                      />
                    </div>

                    {!isUploaded && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenGooglePicker(slot.id);
                          }}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold transition-colors border border-blue-200 cursor-pointer shadow-xs whitespace-nowrap"
                          title="Select from Google Drive"
                        >
                          <svg viewBox="0 0 48 48" className="w-3.5 h-3.5 shrink-0">
                            <path fill="#FFC107" d="M17 7.5L31 7.5 45 31.5 31 31.5z"></path>
                            <path fill="#1976D2" d="M3.1 31.5L10.1 43.5 38.1 43.5 31.1 31.5z"></path>
                            <path fill="#4CAF50" d="M17 7.5L3.1 31.5 10.1 43.5 24 19.5z"></path>
                          </svg>
                          <span>Drive</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenGooglePhotosPicker(slot.id);
                          }}
                          disabled={isPickingPhotos && activePhotosSlotId === slot.id}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 text-amber-900 text-xs font-bold transition-colors border border-amber-200 cursor-pointer shadow-xs whitespace-nowrap disabled:opacity-50"
                          title="Select from Google Photos"
                        >
                          {isPickingPhotos && activePhotosSlotId === slot.id ? (
                            <span className="flex items-center gap-1">
                              {photosNeedsClickToOpen ? (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAuthorizedPhotosWindow();
                                  }}
                                  className="bg-accent text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs cursor-pointer hover:bg-accent/90"
                                >
                                  👉 Open
                                </span>
                              ) : (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0 text-amber-600" />
                                  <span className="text-[10px] truncate max-w-[65px]">{photosPickingStatus || 'Loading...'}</span>
                                </>
                              )}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelPhotosPicking();
                                }}
                                className="text-slate-400 hover:text-rose-600 font-bold px-0.5 cursor-pointer"
                                title="Cancel"
                              >
                                ✕
                              </span>
                            </span>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0">
                                <path fill="#EA4335" d="M12 2a5 5 0 0 0-5 5v5h5a5 5 0 0 0 0-10z" />
                                <path fill="#4285F4" d="M2 12a5 5 0 0 0 5 5h5v-5a5 5 0 0 0-10 0z" />
                                <path fill="#FBBC04" d="M22 12a5 5 0 0 0-5-5h-5v5a5 5 0 0 0 10 0z" />
                                <path fill="#34A853" d="M12 22a5 5 0 0 0 5-5v-5h-5a5 5 0 0 0 0 10z" />
                              </svg>
                              <span>Photos</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    {/* Quick Slot Management Controls (When Uploaded) */}
                    {isUploaded && (
                      <div className="flex items-center justify-between gap-1.5 pt-1 text-xs">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => rotateImageSlot(slot.id, -90)}
                            className="p-1.5 rounded-lg bg-cream hover:bg-cream-dark/60 text-charcoal font-medium transition-colors cursor-pointer border border-cream-border/60"
                            title="Rotate -90° (Counter-Clockwise)"
                          >
                            <RotateCcw className="w-3 h-3 text-accent" />
                          </button>
                          <button
                            type="button"
                            onClick={() => rotateImageSlot(slot.id, 90)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream hover:bg-cream-dark/60 text-charcoal font-medium transition-colors cursor-pointer border border-cream-border/60"
                            title="Rotate +90° (Clockwise)"
                          >
                            <RotateCw className="w-3 h-3 text-accent" />
                            <span>Rotate 90°</span>
                          </button>
                        </div>

                        {otherSlots.length > 0 && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setSwapDropdownSlot(swapDropdownSlot === slot.id ? null : slot.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cream hover:bg-cream-dark/60 text-charcoal font-medium transition-colors cursor-pointer border border-cream-border/60"
                            >
                              <ArrowLeftRight className="w-3 h-3 text-charcoal-muted" />
                              <span>Swap slot</span>
                            </button>

                            {swapDropdownSlot === slot.id && (
                              <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-xl border border-cream-border p-1.5 z-20 animate-fade-in">
                                <p className="text-[10px] font-bold text-charcoal-muted uppercase px-2 py-1">Swap position with:</p>
                                {otherSlots.map(target => (
                                  <button
                                    key={target.id}
                                    type="button"
                                    onClick={() => {
                                      swapSlots(slot.id, target.id);
                                      setSwapDropdownSlot(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-accent-bg hover:text-accent text-xs font-semibold text-charcoal transition-colors cursor-pointer flex items-center justify-between"
                                  >
                                    <span className="truncate">{target.name}</span>
                                    {uploadedImages[target.id] && (
                                      <span className="w-2 h-2 rounded-full bg-accent ml-1 shrink-0" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ──── STEP: BACKGROUND SELECTION ──── */}
      {currentContent === 'background' && (
        <div className="space-y-6 animate-slide-in">
          <Card className="p-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-2">Choose Photoshoot Background</h2>
            <p className="text-xs text-charcoal-muted mb-2">Based on your occasion and fabric, we recommend these two tailored settings. Pick the one that fits your vibe best.</p>
            <div className="mb-6 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p><strong>Note:</strong> The images below represent the <em>vibe</em> and setting. The AI will generate a unique background tailored to the model and pose, so the final background may vary slightly from what you see here.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {[
                { id: 'Mirror or courtyard, warm light', vibe: 'Rooted, festive', imageUrl: '/backgrounds/bg_courtyard_festival.jpg' },
                { id: "Café / friend's living room", vibe: 'Noticed', imageUrl: '/backgrounds/bg_cafe_new.jpg' },
                { id: 'Home entrance w/ bag or car-side', vibe: 'Capable (ICP2 scene)', imageUrl: '/backgrounds/bg_car_side_new.jpg' },
                { id: 'Living room / dining', vibe: 'Unhurried', imageUrl: '/backgrounds/bg_dining_new.jpg' },
                { id: 'Balcony / terrace (open shade)', vibe: 'Airy, breathable -> light-filled', imageUrl: '/backgrounds/bg_balcony_new.jpg' },
                { id: 'Home doorway / living room', vibe: 'Everyday -> her home, daylight', imageUrl: '/backgrounds/bg_indian_home_festive.jpg' },
                { id: 'Mirror / dressing corner (warm light)', vibe: 'Rich -> getting-ready ritual, premium', imageUrl: '/backgrounds/bg_dressing_new.jpg' },
                { id: 'Office / car-side / home entrance', vibe: 'ICP2, on-the-go', imageUrl: '/backgrounds/bg_office_new.png' },
              ].filter(bg => getSuggestedBackgrounds(occasion, fabricType).includes(bg.id)).map(bg => (
                  <div
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg.id)}
                    className={`
                      rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 group relative flex flex-col
                      ${selectedBackground === bg.id
                        ? 'border-accent bg-accent-bg ring-2 ring-accent/30 shadow-md scale-[1.02]'
                        : 'border-cream-border bg-white hover:border-accent/40 hover:shadow-sm'}
                    `}
                  >
                    <div className="h-48 w-full relative overflow-hidden bg-cream-dark">
                      <img src={bg.imageUrl} alt={bg.vibe} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 to-transparent pointer-events-none" />
                      {selectedBackground === bg.id && (
                        <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-md">
                          <Check className="w-5 h-5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-white flex-1 flex flex-col justify-between">
                      <span className="text-charcoal text-sm font-bold line-clamp-2 leading-tight mb-1">{bg.id}</span>
                      <p className="text-xs font-medium text-charcoal-muted line-clamp-2">Vibe: <span className="font-semibold text-accent">{bg.vibe}</span></p>
                    </div>
                  </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ──── STEP: MODEL SELECTION ──── */}
      {currentContent === 'model' && (
        <div className="animate-slide-in space-y-6">
          {/* Persona Selection */}
          <Card className="p-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-2">Choose Customer Persona (ICP)</h2>
            <p className="text-xs text-charcoal-muted mb-6">Select the ideal customer profile to determine styling, background, and expressions.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { id: 'home_ceo', label: 'Home CEO (ICP1)', desc: 'Runs her home & social world. Ages 37-42. Composed, gracious.' },
                { id: 'professional', label: 'Professional Connoisseur (ICP2)', desc: 'Dresses for herself, time-poor. Ages 33-35. Direct, capable.' }
              ].map(persona => (
                <div
                  key={persona.id}
                  onClick={() => {
                    setIcp(persona.id);
                    // Reset selected model if it doesn't match new ICP
                    const allowedForIcp = persona.id === 'home_ceo' ? ['priyanka', 'anjali'] : ['sana', 'navya'];
                    const currentModel = models.find(m => m.id === selectedModelId);
                    if (currentModel && !allowedForIcp.includes(currentModel.name.toLowerCase())) {
                      setSelectedModelId('');
                    }
                  }}
                  className={`
                    p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200
                    ${icp === persona.id ? 'border-accent bg-accent-bg ring-2 ring-accent/20' : 'border-cream-border bg-white hover:border-accent/40'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${icp === persona.id ? 'border-accent bg-accent' : 'border-cream-dark'}`}>
                      {icp === persona.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                    <span className="font-bold text-charcoal">{persona.label}</span>
                  </div>
                  <p className="text-xs text-charcoal-muted pl-8">{persona.desc}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Filter models by ICP */}
          <Card className="p-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-2">Choose Model</h2>
            <p className="text-xs text-charcoal-muted mb-6">Select the specific model for the chosen persona.</p>

            {models.filter(m => icp === 'home_ceo' ? ['priyanka', 'anjali'].includes(m.name.toLowerCase()) : ['sana', 'navya'].includes(m.name.toLowerCase())).length === 0 ? (
              <p className="text-sm text-charcoal-muted py-12 text-center">No models match the selected persona. Make sure models named Priyanka, Anjali, Sana, and Navya are added in Admin.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {models
                  .filter(m => icp === 'home_ceo' ? ['priyanka', 'anjali'].includes(m.name.toLowerCase()) : ['sana', 'navya'].includes(m.name.toLowerCase()))
                  .map(model => (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModelId(model.id)}
                    className={`
                      rounded-2xl border overflow-hidden cursor-pointer transition-all duration-200 group
                      ${selectedModelId === model.id
                        ? 'border-accent ring-2 ring-accent/30 shadow-md scale-[1.02]'
                        : 'border-cream-border hover:border-accent/40 bg-white hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="aspect-[3/4] bg-cream-dark relative overflow-hidden">
                      {model.imageUrl ? (
                        <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-display text-4xl font-bold text-charcoal/10">{model.name?.charAt(0)}</span>
                        </div>
                      )}
                      {selectedModelId === model.id && (
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-accent flex items-center justify-center shadow-md">
                          <Check className="w-4 h-4 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-white">
                      <p className="text-sm font-bold text-charcoal">{model.name}</p>
                      {model.tagline && <p className="text-xs text-charcoal-muted mt-0.5">{model.tagline}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ──── STEP: OPTIONS ──── */}
      {currentContent === 'options' && (
        <div className="space-y-6 animate-slide-in">
          {template.customOptions.map(opt => (
            <Card key={opt.id} className="p-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-charcoal mb-4">{opt.label}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(Array.isArray(opt.choices) ? opt.choices : (typeof opt.choices === 'string' ? JSON.parse(opt.choices) : [])).map((choice: string, cIdx: number) => (
                  <div
                    key={cIdx}
                    onClick={() => setSelectedOptions(prev => ({ ...prev, [opt.id]: choice }))}
                    className={`
                      p-4 rounded-xl border cursor-pointer transition-all duration-200
                      flex items-center gap-3.5
                      ${selectedOptions[opt.id] === choice
                        ? 'border-accent bg-accent-bg ring-1 ring-accent/30 shadow-xs'
                        : 'border-cream-border hover:border-accent/40 bg-white hover:bg-cream-light'
                      }
                    `}
                  >
                    <div className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${selectedOptions[opt.id] === choice
                        ? 'border-accent bg-accent'
                        : 'border-cream-dark'
                      }
                    `}>
                      {selectedOptions[opt.id] === choice && (
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-charcoal">{choice}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ──── STEP: IMAGE FORMAT ──── */}
      {currentContent === 'format' && (
        <div className="space-y-6 animate-slide-in">
          <Card className="p-8">
            <h2 className="font-display text-lg font-bold text-charcoal mb-1">Choose Image Format</h2>
            <p className="text-xs text-charcoal-muted mb-6">
              Select the aspect ratio for all generated images. This affects how they look when shared on different platforms.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                {
                  ratio: '3:4',
                  label: 'Portrait',
                  recommended: true,
                  platforms: 'Best for: Sarees, Lehengas, Full-length',
                  preview: 'h-40',
                  shape: 'w-24 h-32',
                  icon: '👗',
                  description: 'Classic fashion portrait — ideal for catalog shots',
                },
                {
                  ratio: '1:1',
                  label: 'Square',
                  recommended: false,
                  platforms: 'Best for: Instagram posts, Facebook',
                  preview: 'h-32',
                  shape: 'w-32 h-32',
                  icon: '📸',
                  description: 'Perfect for Instagram feed and Facebook catalog',
                },
                {
                  ratio: '9:16',
                  label: 'Vertical Story',
                  recommended: false,
                  platforms: 'Best for: Instagram Reels, WhatsApp Status',
                  preview: 'h-48',
                  shape: 'w-20 h-36',
                  icon: '📱',
                  description: 'Tall format for stories and short-form content',
                },
                {
                  ratio: '4:3',
                  label: 'Landscape',
                  recommended: false,
                  platforms: 'Best for: Wide shots, Group photos',
                  preview: 'h-32',
                  shape: 'w-40 h-30',
                  icon: '🖼️',
                  description: 'Wide format for website banners and group shots',
                },
                {
                  ratio: '16:9',
                  label: 'Widescreen',
                  recommended: false,
                  platforms: 'Best for: YouTube, Website banners',
                  preview: 'h-28',
                  shape: 'w-44 h-24',
                  icon: '🎬',
                  description: 'Cinema-wide format for website and YouTube thumbnails',
                },
              ] as const).map((item) => (
                <div
                  key={item.ratio}
                  onClick={() => setSelectedAspectRatio(item.ratio)}
                  className={`
                    relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center gap-3 text-center group
                    ${selectedAspectRatio === item.ratio
                      ? 'border-accent bg-accent-bg ring-2 ring-accent/20 shadow-md'
                      : 'border-cream-border bg-white hover:border-accent/40 hover:shadow-sm'
                    }
                  `}
                >
                  {item.recommended && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent text-white uppercase tracking-wider">
                      Recommended
                    </span>
                  )}

                  {/* Visual ratio preview */}
                  <div className="flex items-center justify-center h-24 w-full">
                    <div
                      className={`
                        ${selectedAspectRatio === item.ratio ? 'bg-accent/20 border-accent' : 'bg-cream-dark/50 border-cream-border'}
                        border-2 rounded-lg transition-all
                      `}
                      style={{
                        aspectRatio: item.ratio.replace(':', '/'),
                        maxHeight: '88px',
                        maxWidth: '80px',
                        minHeight: '40px',
                        minWidth: '40px',
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className="text-base">{item.icon}</span>
                      <p className="text-sm font-bold text-charcoal">{item.label}</p>
                    </div>
                    <p className="text-xs font-mono font-semibold text-accent mb-1">{item.ratio}</p>
                    <p className="text-[11px] text-charcoal-muted leading-tight">{item.platforms}</p>
                  </div>

                  {selectedAspectRatio === item.ratio && (
                    <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <strong>💡 Tip:</strong> For saree catalog shoots, <strong>3:4 Portrait</strong> is recommended as it captures the full garment from head to toe in the most flattering way. Choose 9:16 for Instagram Stories and Reels.
            </div>
          </Card>
        </div>
      )}

      {/* ──── STEP: GENERATE ──── */}
      {currentContent === 'generate' && (
        <div className="space-y-8 animate-slide-in">
          {/* Status Alert */}
          {genStatus && (
            <div className="p-4 rounded-xl bg-accent-bg border border-accent-border text-accent text-sm font-semibold flex items-center gap-2.5 shadow-xs">
              <Sparkles className="w-5 h-5 text-accent animate-spin" />
              <span>{genStatus}</span>
            </div>
          )}
          {genError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {genError}
            </div>
          )}

          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-cream-border shadow-xs">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal">
                Studio Poses ({template.poses.length})
              </h2>
              <p className="text-xs text-charcoal-muted mt-1">Generate poses individually, select multiple, or all together</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {collageImagesList.length >= 2 && (
                <Button 
                  onClick={() => setShowCollageModal(true)} 
                  variant="ghost"
                  size="lg"
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                >
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Create Collage ({collageImagesList.length})</span>
                </Button>
              )}
              <Button 
                onClick={handleGenerateSelected} 
                loading={isGeneratingSelected} 
                disabled={isGeneratingSelected || isGeneratingAll || selectedPoses.size === 0} 
                variant="ghost"
                size="lg"
              >
                <Layers className="w-4 h-4" />
                Generate Selected ({selectedPoses.size})
              </Button>
              <Button onClick={handleGenerateAll} loading={isGeneratingAll} disabled={isGeneratingAll || isGeneratingSelected} size="lg">
                <Sparkles className="w-4 h-4" />
                Generate All Poses
              </Button>
            </div>
          </div>

          {/* Pose Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {template.poses.map(pose => {
              const genKeys = Object.keys(generatedImages).filter(k => k === pose.id || k.startsWith(`${pose.id}_`));
              const generated = genKeys.length > 0 ? generatedImages[genKeys[genKeys.length - 1]] : null;
              const cleanImageUrl = generated?.imageUrl ? generated.imageUrl.trim().replace(/[\\'";,\s]+$/, '').replace(/%5C$/i, '') : '';
              const isGenerating = generatingPose === pose.id;

              // Fallback map if pose.previewImage is not yet set in DB
              const defaultPoseMap: Record<string, string> = {
                '1. The Mirror Moment': '/poses/saree_pose_mirror.jpg',
                '2. The Classic Front Stand': '/poses/saree_pose_front.jpg',
                '3. The Confident Walk-In': '/poses/saree_pose_2.jpg',
                '4. The Verandah Hostess': '/poses/saree_pose_3.jpg',
                '5. The Glance': '/poses/saree_pose_4.jpg',
                '6. The Pallu Cascade': '/poses/saree_pose_5.jpg',
                '1. Professional Stride': '/poses/kurti_pose_1.jpg',
                '2. Courtyard Festive Walk': '/poses/kurti_pose_2.jpg',
                '3. Boardroom & Lounge Seated': '/poses/kurti_pose_3.jpg',
                '4. Neckline & Embroidery Detail': '/poses/kurti_pose_4.jpg',
              };
              const previewImgSrc = pose.previewImage || defaultPoseMap[pose.name] || '/poses/saree_pose_front.jpg';
              const isMirrorPose = pose.name.toLowerCase().includes('mirror') || (pose.promptSnippet && pose.promptSnippet.toLowerCase().includes('mirror'));

              return (
                <Card 
                  key={pose.id} 
                  className={`relative overflow-hidden flex flex-col group transition-all duration-300 shadow-xs hover:shadow-md cursor-pointer
                    ${selectedPoses.has(pose.id) 
                      ? 'border-2 border-accent ring-2 ring-accent/20' 
                      : 'border border-cream-border hover:border-accent/40'
                    }`}
                  onClick={() => {
                    const newSet = new Set(selectedPoses);
                    if (newSet.has(pose.id)) newSet.delete(pose.id);
                    else newSet.add(pose.id);
                    setSelectedPoses(newSet);
                  }}
                >
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 right-3 z-20">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm
                      ${selectedPoses.has(pose.id) ? 'bg-accent border-accent text-white' : 'bg-white/80 border-charcoal-light backdrop-blur-sm group-hover:border-accent'}
                    `}>
                      {selectedPoses.has(pose.id) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </div>
                  </div>

                  <div className="aspect-square bg-cream-light relative flex items-center justify-center overflow-hidden">
                    {cleanImageUrl ? (
                      <>
                        <img src={cleanImageUrl} alt={pose.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-3 left-3 px-3 py-1 z-10 rounded-full bg-charcoal/85 backdrop-blur-sm text-[10px] font-bold text-white flex items-center gap-1.5 shadow-md border border-white/10">
                          <Sparkles className="w-3 h-3 text-accent" />
                          <span>✨ AI Generated</span>
                        </div>
                      </>
                    ) : isGenerating ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {previewImgSrc && (
                          <img src={previewImgSrc} alt="Reference" className="absolute inset-0 w-full h-full object-cover filter blur-xs opacity-40 scale-105" />
                        )}
                        <div className="relative z-10 text-center p-6 bg-charcoal/70 backdrop-blur-md rounded-2xl mx-4 shadow-xl border border-white/10">
                          <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-xs font-bold text-white">Generating photoshoot...</p>
                          <p className="text-[10px] text-cream-dark/80 mt-1">Applying studio lighting & model drape</p>
                        </div>
                      </div>
                    ) : previewImgSrc ? (
                      <div 
                        className="relative w-full h-full overflow-hidden cursor-pointer"
                        onClick={() => setPoseModal({
                          name: pose.name,
                          url: previewImgSrc,
                          description: pose.description || '',
                          purpose: pose.purpose || undefined,
                          fabricFocus: pose.fabricFocus || undefined,
                          promptSnippet: pose.promptSnippet,
                        })}
                      >
                        <img
                          src={previewImgSrc}
                          alt={pose.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/85 via-black/20 to-black/30" />
                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          <div className="px-3 py-1 rounded-full bg-charcoal/80 backdrop-blur-md text-[10px] font-semibold text-white/95 border border-white/15 flex items-center gap-1.5 shadow-sm">
                            <Camera className="w-3.5 h-3.5 text-accent" />
                            <span>Sample Angle Reference</span>
                          </div>
                          {isMirrorPose && (
                            <div className="px-2.5 py-1 rounded-full bg-purple-600/90 backdrop-blur-md text-[10px] font-bold text-white shadow-sm flex items-center gap-1 border border-purple-400/30">
                              <span>🪞 Optical Physics</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPoseModal({
                              name: pose.name,
                              url: previewImgSrc,
                              description: pose.description || '',
                              purpose: pose.purpose || undefined,
                              fabricFocus: pose.fabricFocus || undefined,
                              promptSnippet: pose.promptSnippet,
                            });
                          }}
                          className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-sm text-white text-[10px] font-semibold flex items-center gap-1 transition-all border border-white/20 shadow-sm cursor-pointer"
                          title="Click to view full reference angle & optical details"
                        >
                          <Eye className="w-3 h-3 text-accent" />
                          <span>Inspect</span>
                        </button>

                        <div className="absolute bottom-3 left-3 right-3 text-left">
                          <p className="text-xs text-white/95 font-medium line-clamp-2 drop-shadow-sm leading-relaxed">
                            {pose.description || 'Target catalog angle & drape posture'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6">
                        <ImageIcon className="w-12 h-12 text-charcoal-light/30 mx-auto mb-2" />
                        <p className="text-xs text-charcoal-muted font-medium">Ready to generate</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white border-t border-cream-border/60 flex flex-col justify-between gap-3 flex-1">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-charcoal">{pose.name}</p>
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-charcoal-light px-2 py-0.5 rounded-md bg-cream-light border border-cream-border">
                          {pose.category}
                        </span>
                      </div>
                      {pose.purpose && (
                        <p className="text-[11px] text-charcoal-muted line-clamp-1 italic">
                          🎯 {pose.purpose}
                        </p>
                      )}
                      {pose.fabricFocus && (
                        <p className="text-[10px] text-accent line-clamp-1 font-medium">
                          ✨ Focus: {pose.fabricFocus}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-cream-border/40">
                      {previewImgSrc ? (
                        <button
                          type="button"
                          onClick={() => setPoseModal({
                            name: pose.name,
                            url: previewImgSrc,
                            description: pose.description || '',
                            purpose: pose.purpose || undefined,
                            fabricFocus: pose.fabricFocus || undefined,
                            promptSnippet: pose.promptSnippet,
                          })}
                          className="text-[11px] font-semibold text-accent hover:text-accent-hover flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Reference</span>
                        </button>
                      ) : <div />}

                      {!cleanImageUrl && !isGenerating && (
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleGeneratePose(pose.id); }} disabled={isGeneratingAll || isGeneratingSelected}>
                          <Sparkles className="w-3.5 h-3.5" /> Generate
                        </Button>
                      )}
                      {cleanImageUrl && (
                        <button
                          onClick={() => handleDownload(cleanImageUrl, `${template.name}_${pose.name}.jpg`)}
                          className="p-2 rounded-xl text-charcoal-muted hover:text-accent hover:bg-accent-bg transition-colors cursor-pointer border border-cream-border shadow-xs"
                          title="Download image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ──── STEP: SAVE & DOWNLOAD ──── */}
      {currentContent === 'save' && (
        <div className="space-y-8 animate-slide-in">
          <Card className="p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-bg border border-accent-border flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Check className="w-8 h-8 text-accent" strokeWidth={2.5} />
            </div>
            <h2 className="font-display text-2xl font-extrabold text-charcoal">Your Photoshoot is Complete!</h2>
            <p className="mt-2 text-sm text-charcoal-muted max-w-md mx-auto">
              {Object.keys(generatedImages).length} of {template.poses.length} poses generated successfully.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button
                onClick={() => {
                  Object.entries(generatedImages).forEach(([poseId, data]) => {
                    const pose = template.poses.find(p => p.id === poseId);
                    if (data.imageUrl) handleDownload(data.imageUrl, `${template.name}_${pose?.name || poseId}.jpg`);
                  });
                }}
                size="lg"
              >
                <Download className="w-4 h-4" /> Download All HD Images
              </Button>

              {collageImagesList.length >= 2 && (
                <Button
                  onClick={() => setShowCollageModal(true)}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 via-rose-500 to-violet-600 hover:opacity-95 text-white font-bold shadow-md"
                >
                  <Sparkles className="w-4 h-4" /> Create Wholesale Collage Sheet
                </Button>
              )}
            </div>
          </Card>

          {/* Gallery Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {template.poses.map(pose => {
              const genKeys = Object.keys(generatedImages).filter(k => k === pose.id || k.startsWith(`${pose.id}_`));
              const gen = genKeys.length > 0 ? generatedImages[genKeys[genKeys.length - 1]] : null;
              const cleanGenUrl = gen?.imageUrl ? gen.imageUrl.trim().replace(/[\\'";,\s]+$/, '').replace(/%5C$/i, '') : '';
              if (!cleanGenUrl) return null;
              return (
                <div key={pose.id} className="group relative rounded-2xl overflow-hidden shadow-sm border border-cream-border">
                  <img src={cleanGenUrl} alt={pose.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-charcoal/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDownload(cleanGenUrl, `${template.name}_${pose.name}.jpg`)}
                      className="p-3 bg-white rounded-xl shadow-lg hover:bg-cream transition-colors cursor-pointer"
                    >
                      <Download className="w-5 h-5 text-charcoal" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-charcoal/80 to-transparent p-3">
                    <p className="text-xs text-white font-semibold">{pose.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-12 flex items-center justify-between border-t border-cream-border/60 pt-6">
        <Button
          variant="ghost"
          onClick={() => {
            if (currentStep > 0) setCurrentStep(currentStep - 1);
            else router.push('/customer');
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          {currentStep === 0 ? 'Back to Categories' : 'Previous Step'}
        </Button>

        {currentStep < steps.length - 1 && (
          <Button onClick={() => {
            if (currentContent === 'details') {
              if (!productName.trim()) {
                setValidationError('Please provide a Product Name.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
              const missingRequiredSlots = template?.imageSlots.filter(
                slot => slot.isRequired && !uploadedImages[slot.id]
              );
              if (missingRequiredSlots && missingRequiredSlots.length > 0) {
                setValidationError(`Please upload photos for the required slots: ${missingRequiredSlots.map(s => s.name).join(', ')}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
              }
            }
            setValidationError(null);
            setCurrentStep(currentStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}>
            <span>Next Step</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Full-Screen Swatch Lightbox Zoom & Inspection Modal */}
      {mounted && zoomModal && createPortal(
        <div className="fixed inset-0 z-[150] bg-charcoal/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-cream-border">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-cream-border flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-accent-bg text-accent flex items-center justify-center font-bold text-xs">
                  HD
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-charcoal">{zoomModal.title}</h3>
                  <p className="text-xs text-charcoal-muted">High-definition fabric swatch inspection</p>
                </div>
              </div>

              {/* Header Action Tools */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => rotateImageSlot(zoomModal.slotId, -90)}
                  className="p-2 rounded-xl bg-cream hover:bg-cream-dark/80 text-charcoal transition-colors cursor-pointer border border-cream-border/60"
                  title="Rotate 90° Counter-Clockwise"
                >
                  <RotateCcw className="w-4 h-4 text-accent" />
                </button>

                <button
                  type="button"
                  onClick={() => rotateImageSlot(zoomModal.slotId, 90)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cream hover:bg-cream-dark/80 text-charcoal text-xs font-bold transition-colors cursor-pointer border border-cream-border/60"
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw className="w-4 h-4 text-accent" />
                  <span>Rotate 90° ↷</span>
                </button>

                <button
                  type="button"
                  onClick={() => setZoomModal(prev => prev ? { ...prev, zoom: Math.min(2.5, prev.zoom + 0.25) } : null)}
                  className="p-2 rounded-xl bg-cream hover:bg-cream-dark/80 text-charcoal transition-colors cursor-pointer border border-cream-border/60"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoomModal(prev => prev ? { ...prev, zoom: Math.max(0.75, prev.zoom - 0.25) } : null)}
                  className="p-2 rounded-xl bg-cream hover:bg-cream-dark/80 text-charcoal transition-colors cursor-pointer border border-cream-border/60"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoomModal(null)}
                  className="p-2 rounded-xl hover:bg-cream text-charcoal-muted hover:text-charcoal transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Viewport with Orientation Anchors */}
            <div className="flex-1 bg-cream-light/60 p-6 flex flex-col items-center justify-center overflow-auto min-h-[420px] relative">
              {/* Top Orientation Anchor Pill */}
              <div className="mb-2.5 px-3 py-1 rounded-full bg-white/90 border border-cream-border text-[11px] font-bold text-charcoal shadow-xs flex items-center gap-1.5 shrink-0">
                <span className="text-accent font-extrabold">⬆️ TOP:</span>
                <span>{zoomModal.slotId.includes('body') || zoomModal.title.toLowerCase().includes('body') ? 'Saree Body / Waist & Pleats (Upper Drape)' : 'Shoulder Drape / Inner Fabric'}</span>
              </div>

              {/* Image with zoom scale */}
              <div className="relative transition-transform duration-200 my-auto" style={{ transform: `scale(${zoomModal.zoom})` }}>
                <img
                  src={zoomModal.url}
                  alt={zoomModal.title}
                  className="max-h-[58vh] max-w-full object-contain rounded-2xl shadow-xl border border-cream-border"
                />
              </div>

              {/* Bottom Orientation Anchor Pill */}
              <div className="mt-2.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 shadow-xs flex items-center gap-1.5 shrink-0">
                <span className="text-emerald-600 font-extrabold">⬇️ BOTTOM:</span>
                <span>{zoomModal.slotId.includes('body') || zoomModal.title.toLowerCase().includes('body') ? 'Saree Border / Ankle Hemline (Lower Edge)' : 'Grand Pallu End Zari / Border'}</span>
              </div>
            </div>

            {/* Modal Footer Guidance */}
            <div className="p-3.5 px-6 border-t border-cream-border bg-white flex items-center justify-between text-xs text-charcoal-muted shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {zoomModal.title.toLowerCase().includes('body')
                    ? '✅ Correct orientation: Saree border is at the BOTTOM, and body pattern is on TOP.'
                    : '✅ Ensure the main zari motifs and borders align with the top and bottom indicators above.'}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setZoomModal(null)}>
                Done Inspecting
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reference Pose Inspector Lightbox Modal */}
      {mounted && poseModal && createPortal(
        <div className="fixed inset-0 z-[120] bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-cream-border flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-cream-border flex items-center justify-between bg-cream-light/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center text-accent">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-charcoal flex items-center gap-2">
                    {poseModal.name}
                    {poseModal.name.toLowerCase().includes('mirror') && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-extrabold border border-purple-200">
                        🪞 Ray-Traced Mirror Physics
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-charcoal-muted">Pose Reference & Photographic Angle Guide</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPoseModal(null)}
                className="p-2 rounded-xl hover:bg-cream text-charcoal-muted hover:text-charcoal transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image & Info */}
            <div className="flex-1 overflow-auto p-6 space-y-4 bg-cream-light/30">
              <div className="aspect-[3/4] max-h-[52vh] mx-auto rounded-2xl overflow-hidden border border-cream-border bg-black shadow-lg relative">
                <img
                  src={poseModal.url}
                  alt={poseModal.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3 p-4 rounded-2xl bg-white border border-cream-border text-xs">
                {poseModal.description && (
                  <div>
                    <span className="font-bold text-charcoal uppercase tracking-wider text-[10px] block mb-0.5">Posture & Angle:</span>
                    <p className="text-slate-700 leading-relaxed">{poseModal.description}</p>
                  </div>
                )}
                {poseModal.purpose && (
                  <div className="pt-2 border-t border-cream-border/60">
                    <span className="font-bold text-accent uppercase tracking-wider text-[10px] block mb-0.5">🎯 Target Audience Connection:</span>
                    <p className="text-slate-700 leading-relaxed">{poseModal.purpose}</p>
                  </div>
                )}
                {poseModal.fabricFocus && (
                  <div className="pt-2 border-t border-cream-border/60">
                    <span className="font-bold text-emerald-700 uppercase tracking-wider text-[10px] block mb-0.5">✨ Garment & Textile Emphasis:</span>
                    <p className="text-slate-700 leading-relaxed">{poseModal.fabricFocus}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-6 border-t border-cream-border bg-white flex items-center justify-between text-xs shrink-0">
              <span className="text-charcoal-muted">
                This reference image and optical geometry will guide the AI photoshoot.
              </span>
              <Button size="sm" onClick={() => setPoseModal(null)}>
                Got It
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Rotation Live Feedback Toast */}
      {rotationToast && (
        <div className="fixed bottom-6 right-6 z-[200] bg-charcoal text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2.5 animate-bounce-short">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{rotationToast}</span>
        </div>
      )}

      {/* Collage Studio Modal */}
      {showCollageModal && (
        <CollageCreator
          images={collageImagesList}
          productName={productName}
          stockCode={stockCode}
          designNumber={product?.productCode || product?.designNumber || ''}
          isOpen={showCollageModal}
          onClose={() => setShowCollageModal(false)}
        />
      )}
    </div>
  );
}

export default function AdminGeneratePage() {
  const routeParams = useParams();
  const templateId = routeParams?.templateId as string || '';
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}>
      <AdminGenerateContent templateId={templateId} />
    </Suspense>
  );
}
