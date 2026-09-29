'use client';

import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Sparkles,
  Users,
  Check,
  Save,
  CheckCircle2,
  Sliders,
  Camera,
  Star,
  Zap,
  Trash2,
  Plus,
  X,
  Edit3,
  Image as ImageIcon,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Toggle } from '@/app/components/ui/Toggle';
import { Textarea } from '@/app/components/ui/Input';

// ─── Types ───
interface KieModel {
  id: string;
  displayName: string;
  modelId: string;
  isImageToImage: boolean;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

interface AIModelPersona {
  id: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
  skinTone: string | null;
  features: string | null;
  promptAnchor: string;
  isActive: boolean;
  isDefault: boolean;
}

// ─── Add Model Form ───
interface AddKieModelFormProps {
  onAdd: (m: { displayName: string; modelId: string; isImageToImage: boolean; description: string }) => void;
  onClose: () => void;
}

const AddKieModelForm: React.FC<AddKieModelFormProps> = ({ onAdd, onClose }) => {
  const [displayName, setDisplayName] = useState('');
  const [modelId, setModelId] = useState('');
  const [isImageToImage, setIsImageToImage] = useState(true);
  const [desc, setDesc] = useState('');

  const handleSubmit = () => {
    if (!displayName.trim() || !modelId.trim()) return;
    onAdd({ displayName: displayName.trim(), modelId: modelId.trim(), isImageToImage, description: desc.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-cream-border w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-7 py-5 border-b border-cream-border/60">
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal">Add Kie.ai Generation Model</h3>
            <p className="text-xs text-charcoal-muted mt-0.5">Enter the exact model slug from Kie.ai API docs</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-charcoal-muted hover:bg-cream-dark transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. GPT Image 2.5 Sunburst — Image-to-Image"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-cream-border focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white text-charcoal"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Kie.ai Model ID (exact slug)</label>
            <input
              type="text"
              value={modelId}
              onChange={e => setModelId(e.target.value)}
              placeholder="e.g. gpt-image-2-5-sunburst-image-to-image"
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-cream-border focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white text-charcoal font-mono"
            />
            <p className="text-[11px] text-charcoal-muted mt-1">This must exactly match the model ID in the Kie.ai API.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-2">Model Type</label>
            <div className="flex gap-3">
              {[
                { val: true, label: 'Image-to-Image', desc: 'Requires reference photos (input_urls)' },
                { val: false, label: 'Text-to-Image', desc: 'Text prompt only, no reference images needed' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => setIsImageToImage(opt.val)}
                  className={`flex-1 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    isImageToImage === opt.val
                      ? 'border-accent bg-accent-bg/40'
                      : 'border-cream-border bg-white hover:border-accent/40'
                  }`}
                >
                  <p className="text-xs font-bold text-charcoal">{opt.label}</p>
                  <p className="text-[10px] text-charcoal-muted mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">Description (optional)</label>
            <textarea
              rows={2}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Brief description of this model's strengths..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-cream-border focus:outline-none focus:ring-2 focus:ring-accent/30 bg-white text-charcoal resize-none"
            />
          </div>
        </div>

        <div className="px-7 py-5 bg-cream-light/60 border-t border-cream-border/60 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-charcoal-muted bg-white border border-cream-border hover:bg-cream transition-colors cursor-pointer">
            Cancel
          </button>
          <Button onClick={handleSubmit} disabled={!displayName.trim() || !modelId.trim()}>
            <Plus className="w-4 h-4" />
            Add Model
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───
export default function AIModelSelectionPage() {
  // Kie.ai Models State
  const [kieModels, setKieModels] = useState<KieModel[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Global Config State
  const [defaultResolution, setDefaultResolution] = useState('4k');
  const [defaultAspectRatio, setDefaultAspectRatio] = useState('3:4');
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState(
    'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style. The garment is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, and intricate metallic zari thread reflections.'
  );
  const [globalNegativePrompt, setGlobalNegativePrompt] = useState(
    'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses'
  );
  const [apiRoute, setApiRoute] = useState('generate');

  // Model Personas State
  const [models, setModels] = useState<AIModelPersona[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => { fetchData(); }, []);

  // Helper: fetch with a timeout so the page never hangs
  const fetchWithTimeout = async (url: string, ms = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const FALLBACK_KIE_MODELS: KieModel[] = [
    {
      id: 'default_i2i',
      displayName: 'GPT Image 2.5 Sunburst — Image-to-Image',
      modelId: 'gpt-image-2-5-sunburst-image-to-image',
      isImageToImage: true,
      description: 'Best for garment photoshoots with fabric reference images.',
      isActive: true,
      isDefault: true,
      sortOrder: 0,
    },
    {
      id: 'default_t2i',
      displayName: 'GPT Image 2.5 Sunburst — Text-to-Image',
      modelId: 'gpt-image-2-5-sunburst-text-to-image',
      isImageToImage: false,
      description: 'Text-only generation — no input images required.',
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all independently so one failure doesn't block the rest
      const [cfgRes, mRes, kieRes] = await Promise.all([
        fetchWithTimeout('/api/admin/studio-config'),
        fetchWithTimeout('/api/admin/models'),
        fetchWithTimeout('/api/admin/kie-models'),
      ]);

      if (cfgRes?.ok) {
        try {
          const cfgData = await cfgRes.json();
          const c = cfgData.config;
          if (c) {
            if (c.defaultResolution) setDefaultResolution(c.defaultResolution);
            if (c.defaultAspectRatio) setDefaultAspectRatio(c.defaultAspectRatio);
            if (c.globalSystemPrompt) setGlobalSystemPrompt(c.globalSystemPrompt);
            if (c.globalNegativePrompt) setGlobalNegativePrompt(c.globalNegativePrompt);
            if (c.defaultModelPersonaId) setDefaultModelId(c.defaultModelPersonaId);
            if (c.apiRoute) setApiRoute(c.apiRoute);
          }
        } catch { /* ignore parse errors */ }
      }

      if (mRes?.ok) {
        try {
          const mData = await mRes.json();
          const mList: AIModelPersona[] = mData.models || [];
          setModels(mList);
          const def = mList.find(m => m.isDefault);
          if (def && !defaultModelId) setDefaultModelId(def.id);
        } catch { /* ignore parse errors */ }
      }

      if (kieRes?.ok) {
        try {
          const kieData = await kieRes.json();
          const list: KieModel[] = kieData.models || [];
          setKieModels(list.length > 0 ? list : FALLBACK_KIE_MODELS);
        } catch {
          setKieModels(FALLBACK_KIE_MODELS);
        }
      } else {
        // Route not ready or returned error — use fallback so UI shows something
        setKieModels(FALLBACK_KIE_MODELS);
      }
    } catch (e) {
      console.error('Failed to load config:', e);
      setKieModels(FALLBACK_KIE_MODELS);
    } finally {
      setLoading(false);
    }
  };


  // ─── Kie Model Handlers ───
  const handleAddKieModel = async (m: { displayName: string; modelId: string; isImageToImage: boolean; description: string }) => {
    try {
      const res = await fetch('/api/admin/kie-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      if (res.ok) {
        setShowAddForm(false);
        await fetchData();
      }
    } catch (e) {
      console.error('[Add Kie Model]:', e);
    }
  };

  const handleDeleteKieModel = async (id: string) => {
    if (!confirm('Delete this model? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/admin/kie-models/${id}`, { method: 'DELETE' });
      setKieModels(prev => prev.filter(m => m.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleKieActive = async (id: string, current: boolean) => {
    setKieModels(prev => prev.map(m => m.id === id ? { ...m, isActive: !current } : m));
    await fetch(`/api/admin/kie-models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    });
  };

  const handleSetKieDefault = async (id: string) => {
    setKieModels(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
    await fetch(`/api/admin/kie-models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
  };

  // ─── Persona Handlers ───
  const handleToggleModelActive = async (id: string, currentStatus: boolean) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, isActive: !currentStatus } : m));
    await fetch(`/api/admin/models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentStatus }),
    });
  };

  const handleSetDefaultModel = (id: string) => {
    setDefaultModelId(id);
    setModels(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const activeDefault = kieModels.find(m => m.isDefault);
      const res = await fetch('/api/admin/studio-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedEngine: activeDefault?.modelId || kieModels[0]?.modelId || 'gpt-image-2-5-sunburst-image-to-image',
          defaultResolution,
          defaultAspectRatio,
          defaultModelPersonaId: defaultModelId,
          globalSystemPrompt,
          globalNegativePrompt,
          apiRoute,
        }),
      });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save config:', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-32 text-center">
        <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-charcoal">Loading AI Engine Configuration...</p>
      </div>
    );
  }

  const defaultKie = kieModels.find(m => m.isDefault);

  return (
    <div className="space-y-10 pb-20 animate-fade-in">
      {showAddForm && <AddKieModelForm onAdd={handleAddKieModel} onClose={() => setShowAddForm(false)} />}

      {/* ──── TOP HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-cream-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-bg border border-accent-border text-accent text-xs font-semibold uppercase tracking-wider mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Foundation & Persona Hub</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-charcoal">AI Engine & Model Management</h1>
          <p className="mt-1.5 text-sm text-charcoal-muted max-w-2xl">
            Manage Kie.ai generation models, configure quality settings, and control which AI model personas are shown to customers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              Saved & Live!
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Configuration</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ──── SECTION 1: KIE.AI GENERATION MODELS ──── */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-charcoal flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              1. Kie.ai Generation Models
            </h2>
            <p className="text-xs text-charcoal-muted mt-1">
              Add, remove, and manage which Kie.ai models are used for photoshoot generation. Set one as Default.
              {defaultKie && (
                <span className="ml-2 font-semibold text-accent">
                  Active: <code className="bg-accent-bg px-1 rounded">{defaultKie.modelId}</code>
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => setShowAddForm(true)} variant="secondary" size="md">
            <Plus className="w-4 h-4" />
            Add New Model
          </Button>
        </div>

        {kieModels.length === 0 ? (
          <Card className="p-10 text-center">
            <Cpu className="w-12 h-12 text-charcoal-light/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-charcoal">No Kie.ai models configured</p>
            <p className="text-xs text-charcoal-muted mt-1">Click "Add New Model" to add a generation model</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {kieModels.map(m => (
              <div
                key={m.id}
                className={`relative p-6 rounded-3xl border-2 transition-all flex flex-col gap-4 ${
                  m.isDefault
                    ? 'border-accent bg-accent-bg/30 ring-4 ring-accent/15'
                    : 'border-cream-border bg-white hover:border-accent/30'
                } ${!m.isActive ? 'opacity-60' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-charcoal truncate">{m.displayName}</h3>
                      {m.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent text-white uppercase tracking-wider shrink-0">
                          <Star className="w-2.5 h-2.5 fill-white" /> Default
                        </span>
                      )}
                    </div>
                    <code className="text-[11px] font-mono text-charcoal-soft bg-cream px-2 py-0.5 rounded mt-1 inline-block max-w-full truncate">
                      {m.modelId}
                    </code>
                  </div>
                  <Badge variant={m.isImageToImage ? 'accent' : 'muted'}>
                    {m.isImageToImage ? 'Img→Img' : 'Text→Img'}
                  </Badge>
                </div>

                {m.description && (
                  <p className="text-xs text-charcoal-muted leading-relaxed">{m.description}</p>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-cream-border/60">
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={m.isActive}
                      onChange={() => handleToggleKieActive(m.id, m.isActive)}
                    />
                    <span className="text-xs font-semibold text-charcoal">
                      {m.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetKieDefault(m.id)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        m.isDefault
                          ? 'bg-accent text-white shadow-xs'
                          : 'bg-cream text-charcoal-soft hover:bg-cream-dark'
                      }`}
                    >
                      {m.isDefault ? '✓ Default' : 'Set Default'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKieModel(m.id)}
                      disabled={deletingId === m.id}
                      className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      title="Delete model"
                    >
                      {deletingId === m.id ? (
                        <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──── SECTION 2: RESOLUTION & ASPECT RATIO DEFAULTS ──── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-cream-border/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              2. Default Resolution & Catalog Aspect Ratio
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              Set the output clarity and canvas dimensions for generated photoshoot assets
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Resolution */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
              Output Resolution Quality
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '4k', label: '4K UHD (Masterpiece)', desc: '100% Raw Quality' },
                { id: '2k', label: '2K QHD (Commercial)', desc: 'Fast & Crisp' },
                { id: '1080p', label: '1080p (Web Standard)', desc: 'Standard' },
              ].map(res => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setDefaultResolution(res.id)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    defaultResolution === res.id
                      ? 'border-accent bg-accent-bg/40 font-bold'
                      : 'border-cream-border bg-white hover:border-accent/40'
                  }`}
                >
                  <p className="text-xs font-bold text-charcoal">{res.label}</p>
                  <p className="text-[10px] text-charcoal-muted mt-0.5">{res.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
              Default Aspect Ratio
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: '3:4', label: '3:4 Catalog', desc: 'Fashion Portrait (Standard)' },
                { id: '1:1', label: '1:1 Square', desc: 'Listing & Instagram' },
                { id: '9:16', label: '9:16 Vertical', desc: 'Mobile Story & Reels' },
              ].map(ar => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setDefaultAspectRatio(ar.id)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    defaultAspectRatio === ar.id
                      ? 'border-accent bg-accent-bg/40 font-bold'
                      : 'border-cream-border bg-white hover:border-accent/40'
                  }`}
                >
                  <p className="text-xs font-bold text-charcoal">{ar.label}</p>
                  <p className="text-[10px] text-charcoal-muted mt-0.5">{ar.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* API Route Selection */}
        <div className="space-y-3 pt-6 border-t border-cream-border/60">
          <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
            Generation API Pipeline
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            {[
              { id: 'generate', label: 'Sunburst (Legacy Pipeline)', desc: 'Standard /api/generate route' },
              { id: 'generate-flux', label: 'Flux 2 (New Pipeline)', desc: 'Fast /api/generate-flux route' },
            ].map(route => (
              <button
                key={route.id}
                type="button"
                onClick={() => setApiRoute(route.id)}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  apiRoute === route.id
                    ? 'border-accent bg-accent-bg/40 font-bold'
                    : 'border-cream-border bg-white hover:border-accent/40'
                }`}
              >
                <p className="text-xs font-bold text-charcoal">{route.label}</p>
                <p className="text-[10px] text-charcoal-muted mt-0.5">{route.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ──── SECTION 3: AI MODEL PERSONAS ──── */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-charcoal flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              3. AI Model Personas (Customer Wizard)
            </h2>
            <p className="text-xs text-charcoal-muted mt-1">
              Toggle which model personas are available to customers, and choose the Primary Default Model.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-charcoal-muted font-semibold">
              Default Model:{' '}
              <strong className="text-charcoal">
                {models.find(m => m.id === defaultModelId)?.name || 'None'}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {models.map(model => {
            const isDefault = defaultModelId === model.id;
            return (
              <Card
                key={model.id}
                className={`p-5 space-y-4 transition-all relative overflow-hidden border-2 ${
                  isDefault ? 'border-accent bg-accent-bg/20 ring-2 ring-accent/20' : 'border-cream-border bg-white'
                } ${!model.isActive ? 'opacity-60 bg-cream-light' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-cream border border-cream-border shrink-0 shadow-xs">
                      {model.imageUrl ? (
                        <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-accent text-lg">
                          {model.name[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-charcoal truncate">{model.name}</p>
                        {isDefault && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-accent text-white uppercase tracking-wider">
                            <Star className="w-2.5 h-2.5 fill-white" /> Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-muted truncate mt-0.5">
                        {model.skinTone || 'Radiant Complexion'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-cream-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={model.isActive}
                      onChange={() => handleToggleModelActive(model.id, model.isActive)}
                    />
                    <span className="text-xs font-semibold text-charcoal">
                      {model.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetDefaultModel(model.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      isDefault
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-cream text-charcoal-soft hover:bg-cream-dark'
                    }`}
                  >
                    {isDefault ? '✓ Primary Default' : 'Set as Default'}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ──── SECTION 4: MASTER PROMPT FORMULA ──── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-cream-border/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-charcoal">
              4. Global Master AI Prompt Formula & Quality Directives
            </h2>
            <p className="text-xs text-charcoal-muted mt-0.5">
              These instructions are automatically injected into every customer photoshoot
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-2">
              Master System Prompt Directive
            </label>
            <Textarea
              rows={3}
              value={globalSystemPrompt}
              onChange={e => setGlobalSystemPrompt(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-2">
              Global Negative Prompt (Quality Filters)
            </label>
            <Textarea
              rows={2}
              value={globalNegativePrompt}
              onChange={e => setGlobalNegativePrompt(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-cream-border/60 flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="md">
            <Save className="w-4 h-4" />
            <span>Save All Settings</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
