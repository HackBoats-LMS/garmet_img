'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Save,
  Image as ImageIcon,
  Sliders,
  Camera,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Lock,
  EyeOff,
  Users,
  Check,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/Input';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Toggle } from '@/app/components/ui/Toggle';

interface ImageSlot {
  name: string;
  description: string;
  isRequired: boolean;
  sampleImageUrl?: string;
}

interface CustomOption {
  label: string;
  optionType: 'radio' | 'select' | 'checkbox';
  choices: string[];
}

interface PoseItem {
  name: string;
  description: string;
  promptSnippet: string;
  purpose?: string;
  fabricFocus?: string;
  previewImage?: string;
  category: string;
}

export default function TemplateEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [garmentType, setGarmentType] = useState('map fabric to the saree body silk, border, pallu, and blouse piece');
  const [coverImage, setCoverImage] = useState('');
  const [allowModelSelection, setAllowModelSelection] = useState(true);
  const [isActive, setIsActive] = useState(true);

  // Model Persona Access Control
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [allowedModelIds, setAllowedModelIds] = useState<string[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string>('');

  // Admin AI Prompt Formula (Hidden from Customers)
  const [systemPrompt, setSystemPrompt] = useState(
    'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style. The garment is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, and intricate metallic zari thread reflections.'
  );
  const [cameraSettings, setCameraSettings] = useState(
    'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, smooth natural bokeh depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting.'
  );
  const [negativePrompt, setNegativePrompt] = useState(
    'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses'
  );

  const [imageSlots, setImageSlots] = useState<ImageSlot[]>([]);
  const [customOptions, setCustomOptions] = useState<CustomOption[]>([]);
  const [poses, setPoses] = useState<PoseItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch all available models
    fetch('/api/admin/models')
      .then(res => res.json())
      .then(data => {
        if (data.models) setAvailableModels(data.models);
      })
      .catch(console.error);

    if (!isNew) {
      fetchTemplate();
    } else {
      setImageSlots([
        { name: 'Full Garment View', description: 'Overall drape showing the entire piece and base fabric', isRequired: true },
        { name: 'Pallu / Border Close-Up', description: 'Close-up showing weave, embroidery, and zari width', isRequired: true },
        { name: 'Blouse Piece / Swatch', description: 'Attached blouse fabric or contrast swatch', isRequired: false },
      ]);
      setCustomOptions([
        { label: 'Blouse Design', optionType: 'radio', choices: ['Matching Plain Silk', 'Heavy Embroidered Maggam Work', 'Contrast Velvet Contemporary', 'Sleeveless Modern Cut'] },
        { label: 'Drape & Pallu Style', optionType: 'radio', choices: ['Traditional Nivi Drape (Pleated)', 'Open Floating Grand Pallu', 'Royal Gujarati Front Pallu'] },
        { label: 'Background Setting', optionType: 'radio', choices: ['Royal Haveli Courtyard', 'Modern Studio Grey', 'Festive Floral Decor', 'Minimalist Architecture'] },
      ]);
      setPoses([
        { name: '1. Full Standing Front', description: 'Complete frontal symmetry showcasing body weave, vertical pleats & height drape', promptSnippet: 'full body front standing pose, arms relaxed at sides, perfect posture, displaying full vertical saree pleats and height drape', category: 'standing', purpose: 'Main hero image — full drape for WhatsApp/catalogue', fabricFocus: 'Body silk pattern, vertical pleats', previewImage: '/pose_1_standing.jpg' },
        { name: '2. Grand Pallu Spread', description: 'Both hands holding out the grand zari pallu to display full width weave pattern', promptSnippet: 'standing 3/4 turn with both hands gently holding open the heavy gold zari pallu, displaying the entire intricate peacock and kalash border weave to camera', category: 'drape', purpose: 'Detail view — WhatsApp secondary image', fabricFocus: 'Pallu weave, border width, zari detail', previewImage: '/saree_pallu.jpg' },
        { name: '3. Royal Seated Haveli', description: 'Seated on an antique carved haveli armchair with saree fanned out in opulent folds', promptSnippet: 'gracefully seated on a regal antique carved rosewood armchair, silk saree pleats elegantly fanned across the velvet rug, serene royal posture', category: 'seated', purpose: 'Lifestyle mood shot for Instagram', fabricFocus: 'Opulent draping and fabric sheen', previewImage: '/saree_body.jpg' },
        { name: '4. Blouse Back & Maggam Work', description: 'Turned 3/4 back profile highlighting designer blouse cutout and heavy zardozi embroidery', promptSnippet: 'standing three-quarter back angle over the shoulder, highlighting the elaborate deep back neckline cutout with heavy gold zardozi tassel doris, neat hair bun with white jasmine gajra', category: 'detail', purpose: 'Blouse back design reference', fabricFocus: 'Maggam work and blouse piece', previewImage: '/saree_blouse.jpg' },
      ]);
    }
  }, [id, isNew]);

  const fetchTemplate = async () => {
    const res = await fetch(`/api/admin/templates/${id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Failed to load template'); return; }

    const t = data.template;
    setName(t.name);
    setSlug(t.slug);
    setTagline(t.tagline || '');
    setDescription(t.description || '');
    if (t.garmentType) setGarmentType(t.garmentType);
    setCoverImage(t.coverImage || '');
    setAllowModelSelection(t.allowModelSelection);
    setIsActive(t.isActive);
    setDefaultModelId(t.defaultModelId || '');
    if (Array.isArray(t.allowedModelIds)) {
      setAllowedModelIds(t.allowedModelIds);
    }
    if (t.systemPrompt) setSystemPrompt(t.systemPrompt);
    if (t.negativePrompt) setNegativePrompt(t.negativePrompt);
    if (t.cameraSettings) setCameraSettings(t.cameraSettings);
    setImageSlots(t.imageSlots || []);
    setCustomOptions(
      (t.customOptions || []).map((o: any) => ({
        ...o,
        choices: Array.isArray(o.choices) ? o.choices : JSON.parse(o.choices || '[]'),
      }))
    );
    setPoses(t.poses || []);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (isNew) setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCoverImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required'); return; }
    if (!slug.trim()) { setError('Slug is required'); return; }

    setSaving(true);
    setError('');

    const payload = {
      name,
      slug,
      tagline,
      description,
      garmentType,
      coverImage,
      allowModelSelection,
      defaultModelId: defaultModelId || null,
      allowedModelIds: allowedModelIds.length > 0 ? allowedModelIds : null,
      isActive,
      systemPrompt,
      negativePrompt,
      cameraSettings,
      imageSlots,
      customOptions,
      poses,
    };

    try {
      const url = isNew ? '/api/admin/templates' : `/api/admin/templates/${id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save template');
        setSaving(false);
        return;
      }

      router.push('/admin/templates');
    } catch {
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const applyStarterTemplate = (type: 'saree' | 'kurti' | 'lehenga') => {
    if (type === 'saree') {
      setName('Kanchipuram Silk Saree');
      setSlug('saree');
      setGarmentType('map fabric to the saree body silk, border, pallu, and blouse piece');
      setImageSlots([
        { name: 'Full Garment View', description: 'Overall drape showing the entire piece and base fabric', isRequired: true },
        { name: 'Pallu / Border Close-Up', description: 'Close-up showing weave, embroidery, and zari width', isRequired: true },
        { name: 'Blouse Piece / Swatch', description: 'Attached blouse fabric or contrast swatch', isRequired: false },
      ]);
      setCustomOptions([
        { label: 'Blouse Design', optionType: 'radio', choices: ['Matching Plain Silk', 'Heavy Embroidered Maggam Work', 'Contrast Velvet Contemporary', 'Sleeveless Modern Cut'] },
        { label: 'Drape & Pallu Style', optionType: 'radio', choices: ['Traditional Nivi Drape (Pleated)', 'Open Floating Grand Pallu', 'Royal Gujarati Front Pallu'] },
        { label: 'Jewellery Styling', optionType: 'radio', choices: ['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Heavy Bridal / Antique Jewellery'] },
        { label: 'Background Setting', optionType: 'radio', choices: ['Royal Haveli Courtyard', 'Modern Studio Grey', 'Festive Floral Decor', 'Minimalist Architecture'] },
      ]);
      setPoses([
        { name: '1. Full Standing Front', description: 'Complete frontal symmetry', promptSnippet: 'full body front standing pose, arms relaxed at sides, perfect posture, displaying full vertical saree pleats and height drape', category: 'standing', purpose: 'Main hero image — full drape for WhatsApp/catalogue', fabricFocus: 'Body silk pattern, vertical pleats' },
        { name: '2. Grand Pallu Spread', description: 'Both hands holding out the grand zari pallu', promptSnippet: 'standing 3/4 turn with both hands gently holding open the heavy gold zari pallu, displaying the entire intricate peacock and kalash border weave to camera', category: 'drape', purpose: 'Detail view — WhatsApp secondary image', fabricFocus: 'Pallu weave, border width, zari detail' },
      ]);
    } else if (type === 'kurti') {
      setName('Kurti / Kurta Set');
      setSlug('kurti');
      setGarmentType('map fabric to the kurta body, yoke panel, and sleeve');
      setImageSlots([
        { name: 'Kurti Front / Main Body', description: 'Lay flat or hung, showing the full front design, yoke, and hem', isRequired: true },
        { name: 'Pant / Bottoms Swatch', description: 'Fabric for the accompanying bottom wear (if any)', isRequired: false },
        { name: 'Dupatta Swatch', description: 'Fabric for the accompanying dupatta (if any)', isRequired: false },
      ]);
      setCustomOptions([
        { label: 'Bottom Wear Style', optionType: 'radio', choices: ['Straight Pants', 'Palazzos', 'Churidar', 'No Bottoms (Dress Style)'] },
        { label: 'Dupatta Draping', optionType: 'radio', choices: ['One Shoulder Pinned', 'Both Shoulders Open', 'Neck Wrap', 'No Dupatta'] },
        { label: 'Jewellery Styling', optionType: 'radio', choices: ['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Heavy Bridal / Antique Jewellery'] },
        { label: 'Background Setting', optionType: 'radio', choices: ['Royal Haveli Courtyard', 'Modern Studio Grey', 'Festive Floral Decor', 'Minimalist Architecture'] },
      ]);
      setPoses([
        { name: '1. Front Standing', description: 'Showcasing the kurta fit and yoke', promptSnippet: 'full body front standing pose, wearing a beautifully tailored straight-cut kurti, arms relaxed, showcasing the yoke embroidery and side slits, elegant posture', category: 'standing', purpose: 'Main catalogue shot', fabricFocus: 'Kurta fit, yoke design' },
        { name: '2. 3/4 Angle Detail', description: 'Highlighting sleeves and side profile', promptSnippet: 'standing three-quarter profile, one hand gently resting on hip, showcasing the sleeve length and side drape of the kurta', category: 'detail', purpose: 'Secondary fit view', fabricFocus: 'Sleeve pattern, side profile' },
        { name: '3. Seated Elegance', description: 'Seated gracefully showcasing the bottom wear', promptSnippet: 'gracefully seated on an ornate chair, kurta hem draped neatly, showcasing the bottom wear style and elegant dupatta placement', category: 'seated', purpose: 'Lifestyle shot', fabricFocus: 'Overall silhouette and bottom wear' },
        { name: '4. Dupatta Detail', description: 'Close up on the yoke and dupatta drape', promptSnippet: 'close-up portrait shot, highlighting the yoke neckline embroidery and the sheer dupatta fabric gracefully pinned on the shoulder', category: 'detail', purpose: 'Focus on upper details', fabricFocus: 'Neckline and dupatta texture' },
      ]);
    } else if (type === 'lehenga') {
      setName('Lehenga Choli');
      setSlug('lehenga');
      setGarmentType('map fabric to the lehenga skirt, choli blouse, and dupatta');
      setImageSlots([
        { name: 'Lehenga Skirt Flare', description: 'Main fabric showing the skirt flare and border work', isRequired: true },
        { name: 'Choli (Blouse) Piece', description: 'Fabric for the blouse', isRequired: true },
        { name: 'Dupatta', description: 'Fabric and border of the dupatta', isRequired: true },
      ]);
      setCustomOptions([
        { label: 'Blouse Design', optionType: 'radio', choices: ['Deep V-Neck', 'Sweetheart Neck', 'Full Sleeves Traditional', 'Sleeveless Contemporary'] },
        { label: 'Dupatta Draping', optionType: 'radio', choices: ['Traditional Gujarati Front', 'One Shoulder Pinned', 'Over the Head Bridal'] },
        { label: 'Jewellery Styling', optionType: 'radio', choices: ['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Heavy Bridal / Antique Jewellery'] },
        { label: 'Background Setting', optionType: 'radio', choices: ['Royal Haveli Courtyard', 'Modern Studio Grey', 'Festive Floral Decor', 'Minimalist Architecture'] },
      ]);
      setPoses([
        { name: '1. Full Twirl', description: 'Dynamic twirl showing the skirt flare', promptSnippet: 'dynamic mid-twirl pose, lehenga skirt flared out beautifully displaying the heavy border work, dupatta gracefully pinned to one shoulder, joyous expression', category: 'standing', purpose: 'Hero shot showing flare volume', fabricFocus: 'Skirt border and kalis' },
        { name: '2. Bridal Portrait', description: 'Close up on blouse and dupatta drape', promptSnippet: 'close-up portrait, bride looking away gracefully, dupatta draped over the head and pinned at the shoulder, highlighting the intricate choli embroidery and sweetheart neckline', category: 'detail', purpose: 'Close-up for jewelry and blouse design', fabricFocus: 'Choli embroidery, dupatta sheer fabric' },
      ]);
    }
  };

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/templates"
            className="p-2.5 rounded-xl bg-white border border-cream-border hover:bg-cream text-charcoal transition-colors cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-charcoal">
              {isNew ? 'Create Garment Template' : `Edit: ${name}`}
            </h1>
            <p className="mt-0.5 text-xs text-charcoal-muted font-normal">
              Define the photoshoot requirements, image slots, and AI generation rules
            </p>
          </div>
        </div>

        <Button onClick={handleSave} loading={saving} size="md">
          <Save className="w-4 h-4" />
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {isNew && (
        <Card className="p-6 border-accent/30 bg-accent-bg/10">
          <h3 className="text-sm font-bold text-charcoal mb-3">Quick-Start Templates</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => applyStarterTemplate('saree')} size="sm">Saree Settings</Button>
            <Button variant="secondary" onClick={() => applyStarterTemplate('kurti')} size="sm">Kurti Settings</Button>
            <Button variant="secondary" onClick={() => applyStarterTemplate('lehenga')} size="sm">Lehenga Settings</Button>
          </div>
        </Card>
      )}

      {/* ─── SECTION 1: BASIC INFO ─── */}
      <Card className="p-8 space-y-6">
        <h2 className="font-display text-base font-bold text-charcoal border-b border-cream-border/60 pb-3">
          1. Basic Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Template Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Kanchipuram Silk Saree"
            required
          />
          <Input
            label="URL Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. saree"
            required
          />
        </div>

        <Input
          label="Tagline / Short Subtitle"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="e.g. Traditional & contemporary draping with custom zari border & blouse styling"
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this template is for, recommended fabric photos, and style guidelines..."
          rows={3}
        />

        {/* Cover Image Upload */}
        <div>
          <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
            Cover Preview Image
          </label>
          <div className="flex items-center gap-5">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setCoverImage(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }}
              className="w-24 h-24 rounded-2xl bg-cream-light border-2 border-dashed border-cream-border hover:border-accent flex items-center justify-center cursor-pointer overflow-hidden transition-colors shrink-0 shadow-xs"
            >
              {coverImage ? (
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 text-charcoal-light" />
              )}
            </div>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {coverImage ? 'Change Image' : 'Upload or Drop Cover Image'}
              </Button>
              <p className="text-xs text-charcoal-muted mt-2">Click or drag & drop: 1200x800 high-resolution preview</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          </div>
        </div>

        {/* Template Active Toggle */}
        <div className="pt-4 border-t border-cream-border/60">
          <div className="flex items-center justify-between p-4 rounded-xl bg-cream-light border border-cream-border/60">
            <div>
              <p className="text-sm font-bold text-charcoal">Template Active Status</p>
              <p className="text-xs text-charcoal-muted mt-0.5">When active, this garment is visible to customers in the photoshoot studio</p>
            </div>
            <Toggle checked={isActive} onChange={setIsActive} />
          </div>
        </div>
      </Card>

      {/* ─── SECTION 2: AI MODEL PERSONA ACCESS & PERMISSIONS ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-cream-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-charcoal">
                2. AI Model Persona Access & Permissions
              </h2>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Control which AI model faces customers can choose from for this specific garment
              </p>
            </div>
          </div>
        </div>

        {/* Allow Customer Selection Switch */}
        <div className="flex items-center justify-between p-5 rounded-2xl bg-cream-light border border-cream-border/60">
          <div>
            <p className="text-sm font-bold text-charcoal">Allow Customer to Select Model</p>
            <p className="text-xs text-charcoal-muted mt-0.5">
              If enabled, customers can pick from the approved models below. If disabled, photoshoots will automatically use the default model.
            </p>
          </div>
          <Toggle checked={allowModelSelection} onChange={setAllowModelSelection} />
        </div>

        {/* Model Persona Multi-Select Grid */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                Approved Models for this Template ({allowedModelIds.length === 0 ? 'All Models Allowed' : `${allowedModelIds.length} Selected`})
              </label>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Check the model personas customers are allowed to access for this garment:
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllowedModelIds(availableModels.map(m => m.id))}
                className="text-xs font-semibold text-accent hover:underline cursor-pointer"
              >
                Select All
              </button>
              <span className="text-charcoal-light text-xs">•</span>
              <button
                type="button"
                onClick={() => setAllowedModelIds([])}
                className="text-xs font-semibold text-charcoal-muted hover:text-charcoal cursor-pointer"
              >
                Allow All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableModels.map((model) => {
              const isAllowed = allowedModelIds.length === 0 || allowedModelIds.includes(model.id);
              const isDefault = defaultModelId === model.id;

              return (
                <div
                  key={model.id}
                  onClick={() => {
                    if (allowedModelIds.length === 0) {
                      // Initially all are allowed, unchecking this one means all others except this
                      setAllowedModelIds(availableModels.filter(m => m.id !== model.id).map(m => m.id));
                    } else if (allowedModelIds.includes(model.id)) {
                      setAllowedModelIds(allowedModelIds.filter(id => id !== model.id));
                    } else {
                      setAllowedModelIds([...allowedModelIds, model.id]);
                    }
                  }}
                  className={`
                    p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs
                    ${isAllowed
                      ? 'border-accent bg-accent-bg/30 ring-2 ring-accent/20'
                      : 'border-cream-border bg-white opacity-60 hover:opacity-100'
                    }
                  `}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-cream border border-cream-border shrink-0">
                      {model.imageUrl ? (
                        <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-accent">
                          {model.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-charcoal truncate">{model.name}</p>
                      <p className="text-[11px] text-charcoal-muted truncate">{model.skinTone || 'Radiant Skin'}</p>
                      {isDefault && (
                        <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-accent text-white uppercase tracking-wider">
                          Default Model
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className={`
                      w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                      ${isAllowed ? 'bg-accent border-accent text-white' : 'border-cream-border bg-white'}
                    `}>
                      {isAllowed && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDefaultModelId(model.id);
                        if (!allowedModelIds.includes(model.id) && allowedModelIds.length > 0) {
                          setAllowedModelIds([...allowedModelIds, model.id]);
                        }
                      }}
                      className={`text-[10px] font-semibold hover:underline cursor-pointer ${isDefault ? 'text-accent font-bold' : 'text-charcoal-muted hover:text-charcoal'}`}
                    >
                      {isDefault ? '✓ Default' : 'Set as Default'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ─── SECTION 3: AI PROMPT FORMULA (ADMIN ONLY) ─── */}
      <Card className="p-8 space-y-6 border-accent/30 bg-white">
        <div className="flex items-center justify-between border-b border-cream-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-charcoal">
                  3. Master AI Prompt Formula & Camera Engine
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-bg text-accent border border-accent-border">
                  Admin Only (Hidden from Users)
                </span>
              </div>
              <p className="text-xs text-charcoal-muted mt-0.5">
                The AI prompt recipes combined with customer swatches, choices, and poses behind the scenes.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Textarea
            label="Garment Mapping Instruction (Garment Type)"
            value={garmentType}
            onChange={(e) => setGarmentType(e.target.value)}
            placeholder="e.g. map fabric to the kurta body, yoke panel, and sleeve"
            rows={2}
          />

          <Textarea
            label="Master Prompt Directive (Style, Realism & Lighting)"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Commercial fashion photoshoot for luxury Indian garments..."
            rows={4}
          />

          <Textarea
            label="Camera & Lens Specifications"
            value={cameraSettings}
            onChange={(e) => setCameraSettings(e.target.value)}
            placeholder="Shot on Hasselblad H6D-100c paired with HC 100mm f/2.2..."
            rows={3}
          />

          <Textarea
            label="Negative Prompt (Quality & Artifact Filters)"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="bad anatomy, deformed fingers, plastic skin, oversaturated..."
            rows={3}
          />
        </div>
      </Card>

      {/* ─── SECTION 3: REQUIRED IMAGE SLOTS ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-cream-border/60 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              3. Required Image Slots ({imageSlots.length})
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              Specify which photos the customer must upload (e.g. Full Garment, Close-up, Blouse)
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageSlots([...imageSlots, { name: '', description: '', isRequired: true }])}
          >
            <Plus className="w-3.5 h-3.5" /> Add Slot
          </Button>
        </div>

        <div className="space-y-4">
          {imageSlots.map((slot, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-cream-light border border-cream-border/60 flex items-start gap-4">
              <span className="w-6 h-6 rounded-full bg-cream-dark flex items-center justify-center text-xs font-bold text-charcoal shrink-0 mt-2">
                {idx + 1}
              </span>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Slot Name"
                  value={slot.name}
                  onChange={(e) => {
                    const updated = [...imageSlots];
                    updated[idx].name = e.target.value;
                    setImageSlots(updated);
                  }}
                  placeholder="e.g. Full Saree Body View"
                />
                <Input
                  label="Guidance for Customer"
                  value={slot.description}
                  onChange={(e) => {
                    const updated = [...imageSlots];
                    updated[idx].description = e.target.value;
                    setImageSlots(updated);
                  }}
                  placeholder="e.g. Lay flat, show rich base silk color & buttas"
                />
                <div className="col-span-1 sm:col-span-2 pt-2 border-t border-cream-border/50 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-charcoal uppercase tracking-wider mb-1">Required Slot?</p>
                    <p className="text-[10px] text-charcoal-muted leading-tight">
                      If disabled, this image is optional. The AI will auto-generate based on color/context if omitted.
                    </p>
                  </div>
                  <Toggle
                    checked={slot.isRequired ?? true}
                    onChange={(val) => {
                      const updated = [...imageSlots];
                      updated[idx].isRequired = val;
                      setImageSlots(updated);
                    }}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 pt-2 border-t border-cream-border/50 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-charcoal uppercase tracking-wider mb-1">Visual Sample Reference (Optional)</p>
                    <p className="text-[10px] text-charcoal-muted leading-tight">
                      Upload a sample photo to show customers exactly how this part of the garment should be photographed.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {slot.sampleImageUrl ? (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-cream-border shrink-0 group">
                        <img src={slot.sampleImageUrl} alt="Sample" className="w-full h-full object-cover" />
                        <div 
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                          onClick={() => {
                            const updated = [...imageSlots];
                            updated[idx].sampleImageUrl = '';
                            setImageSlots(updated);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    ) : (
                      <label className="w-12 h-12 rounded-lg bg-cream-dark border border-dashed border-cream-border hover:border-accent flex items-center justify-center cursor-pointer transition-colors shrink-0">
                        <Upload className="w-4 h-4 text-charcoal-muted" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const updated = [...imageSlots];
                                updated[idx].sampleImageUrl = ev.target?.result as string;
                                setImageSlots(updated);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageSlots(imageSlots.filter((_, i) => i !== idx))}
                className="p-2 text-charcoal-light hover:text-error hover:bg-red-50 rounded-lg transition-colors cursor-pointer mt-6"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── SECTION 4: CUSTOM OPTIONS ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-cream-border/60 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              4. Garment Custom Options ({customOptions.length})
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              Custom options presented as choices to the customer (Blouse Style, Pallu Drape)
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCustomOptions([...customOptions, { label: '', optionType: 'radio', choices: ['Option 1', 'Option 2'] }])}
          >
            <Plus className="w-3.5 h-3.5" /> Add Option
          </Button>
        </div>

        <div className="space-y-5">
          {customOptions.map((opt, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-cream-light border border-cream-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Option #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setCustomOptions(customOptions.filter((_, i) => i !== idx))}
                  className="p-1 text-charcoal-light hover:text-error transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <Input
                label="Question / Option Label"
                value={opt.label}
                onChange={(e) => {
                  const updated = [...customOptions];
                  updated[idx].label = e.target.value;
                  setCustomOptions(updated);
                }}
                placeholder="e.g. Blouse Design Type"
              />

              <div>
                <label className="block text-xs font-semibold text-charcoal uppercase tracking-wider mb-1.5">
                  Choices (Comma-separated)
                </label>
                <input
                  type="text"
                  value={opt.choices.join(', ')}
                  onChange={(e) => {
                    const updated = [...customOptions];
                    updated[idx].choices = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                    setCustomOptions(updated);
                  }}
                  placeholder="Matching Plain Silk, Heavy Embroidered Maggam Work, Contrast Velvet"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-cream-border text-sm text-charcoal"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── SECTION 5: AI POSES ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-cream-border/60 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              5. Studio AI Poses ({poses.length})
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              The photoshoot poses generated for the customer. Customers will get {poses.length} photos per order.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPoses([...poses, { name: '', description: '', promptSnippet: '', category: 'full', purpose: '', fabricFocus: '' }])}
          >
            <Plus className="w-3.5 h-3.5" /> Add Pose
          </Button>
        </div>

        <div className="space-y-4">
          {poses.map((pose, idx) => (
            <div key={idx} className="p-5 rounded-xl bg-cream-light border border-cream-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Pose #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setPoses(poses.filter((_, i) => i !== idx))}
                  className="p-1 text-charcoal-light hover:text-error transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Pose Name"
                  value={pose.name}
                  onChange={(e) => {
                    const updated = [...poses];
                    updated[idx].name = e.target.value;
                    setPoses(updated);
                  }}
                  placeholder="e.g. 1. Full Standing Front"
                />
                <Input
                  label="Category"
                  value={pose.category}
                  onChange={(e) => {
                    const updated = [...poses];
                    updated[idx].category = e.target.value;
                    setPoses(updated);
                  }}
                  placeholder="standing, drape, seated, detail"
                />
                <Input
                  label="Sample Preview Image URL"
                  value={pose.previewImage || ''}
                  onChange={(e) => {
                    const updated = [...poses];
                    updated[idx].previewImage = e.target.value;
                    setPoses(updated);
                  }}
                  placeholder="/pose_1_standing.jpg or URL"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Pose Purpose (Optional)"
                  value={pose.purpose || ''}
                  onChange={(e) => {
                    const updated = [...poses];
                    updated[idx].purpose = e.target.value;
                    setPoses(updated);
                  }}
                  placeholder="e.g. Main hero image — full drape for WhatsApp"
                />
                <Input
                  label="Fabric Focus (Optional)"
                  value={pose.fabricFocus || ''}
                  onChange={(e) => {
                    const updated = [...poses];
                    updated[idx].fabricFocus = e.target.value;
                    setPoses(updated);
                  }}
                  placeholder="e.g. Pallu weave, border width, zari detail"
                />
              </div>

              <Textarea
                label="AI Pose Prompt Snippet"
                value={pose.promptSnippet}
                onChange={(e) => {
                  const updated = [...poses];
                  updated[idx].promptSnippet = e.target.value;
                  setPoses(updated);
                }}
                placeholder="e.g. full body front standing pose, arms relaxed at sides, perfect posture..."
                rows={2}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSave} loading={saving} size="lg">
          <Save className="w-4 h-4" />
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
