'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Image as ImageIcon,
  Sliders,
  Camera,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';

interface TemplateDetail {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  garmentType: string | null;
  coverImage: string | null;
  allowModelSelection: boolean;
  isActive: boolean;
  systemPrompt: string | null;
  cameraSettings: string | null;
  negativePrompt: string | null;
  imageSlots: { id: string; name: string; description: string | null; isRequired: boolean; sampleImageUrl?: string | null }[];
  customOptions: { id: string; label: string; optionType: string; choices: string[] }[];
  poses: { id: string; name: string; description: string | null; promptSnippet: string; category: string; previewImage?: string | null }[];
}

export default function TemplateInspectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id === 'new') {
      router.replace('/admin/templates');
      return;
    }

    fetch(`/api/admin/templates/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load template');
        setTemplate(data.template);
      })
      .catch((err) => setError(err.message || 'Failed to load template'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (id === 'new' || loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-6 py-12">
        <Link href="/admin/templates" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Templates
        </Link>
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error || 'Template not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/templates"
            className="p-2.5 rounded-xl bg-white border border-cream-border hover:bg-cream text-charcoal transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-charcoal">{template.name}</h1>
              <Badge variant={template.isActive ? 'success' : 'muted'}>
                {template.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Lock className="w-3 h-3" /> Read-Only (Hardcoded)
              </span>
            </div>
            <p className="mt-0.5 text-xs text-charcoal-muted">
              Slug: <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-charcoal">{template.slug}</code> • Source:{' '}
              <code className="font-mono bg-cream px-1.5 py-0.5 rounded text-charcoal">lib/hardcoded-templates.ts</code>
            </p>
          </div>
        </div>

        <Link href={`/admin/generate/${template.id}`}>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors cursor-pointer shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>Open in AI Studio</span>
          </button>
        </Link>
      </div>

      {/* Overview */}
      <Card className="p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-charcoal border-b border-cream-border/60 pb-3">
          1. Overview &amp; Model Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Tagline</p>
            <p className="text-charcoal mt-1">{template.tagline || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Customer Model Selection
            </p>
            <p className="text-charcoal mt-1 font-semibold">
              {template.allowModelSelection ? 'Enabled (Customers can choose Persona)' : 'Disabled (Default Persona only)'}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Description</p>
            <p className="text-charcoal-muted text-xs mt-1 leading-relaxed">{template.description || '—'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Garment Mapping Instruction</p>
            <p className="font-mono text-xs bg-cream-light p-3 rounded-xl border border-cream-border/60 mt-1 text-charcoal">
              {template.garmentType || '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Base Image Slots */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-cream-border/60 pb-3">
          <ImageIcon className="w-4 h-4 text-accent" />
          <h2 className="font-display text-base font-bold text-charcoal">
            2. Base Upload Slots ({template.imageSlots.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {template.imageSlots.map((slot) => (
            <div key={slot.id} className="p-4 rounded-xl bg-cream-light border border-cream-border/60 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-charcoal">{slot.name}</span>
                <Badge variant={slot.isRequired ? 'accent' : 'muted'}>
                  {slot.isRequired ? 'Required' : 'Optional'}
                </Badge>
              </div>
              <p className="font-mono text-[10px] text-charcoal-light">slotId: {slot.id}</p>
              <p className="text-xs text-charcoal-muted leading-relaxed">{slot.description}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Custom Options */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-cream-border/60 pb-3">
          <Sliders className="w-4 h-4 text-accent" />
          <h2 className="font-display text-base font-bold text-charcoal">
            3. Garment Styling Options ({template.customOptions.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {template.customOptions.map((opt) => (
            <div key={opt.id} className="p-4 rounded-xl bg-cream-light border border-cream-border/60 space-y-2">
              <p className="font-bold text-sm text-charcoal">{opt.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(opt.choices) ? opt.choices : []).map((c, idx) => (
                  <span key={idx} className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-cream-border text-charcoal">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Poses */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-cream-border/60 pb-3">
          <Camera className="w-4 h-4 text-accent" />
          <h2 className="font-display text-base font-bold text-charcoal">
            4. Fixed AI Pose Recipes ({template.poses.length})
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {template.poses.map((pose) => (
            <div key={pose.id} className="p-4 rounded-xl bg-cream-light border border-cream-border/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm text-charcoal">{pose.name}</p>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white border border-cream-border text-charcoal-muted">
                  {pose.category}
                </span>
              </div>
              {pose.description && <p className="text-xs text-charcoal-muted">{pose.description}</p>}
              <p className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-cream-border/60 text-charcoal-muted leading-relaxed">
                {pose.promptSnippet}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Prompt Formula */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-cream-border/60 pb-3">
          <Lock className="w-4 h-4 text-accent" />
          <h2 className="font-display text-base font-bold text-charcoal">5. Base System &amp; Camera Prompts</h2>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <p className="font-bold uppercase tracking-wider text-charcoal-muted mb-1">System Prompt</p>
            <p className="font-mono bg-cream-light p-3 rounded-xl border border-cream-border/60 text-charcoal leading-relaxed">
              {template.systemPrompt || '—'}
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-charcoal-muted mb-1">Camera Settings</p>
            <p className="font-mono bg-cream-light p-3 rounded-xl border border-cream-border/60 text-charcoal leading-relaxed">
              {template.cameraSettings || '—'}
            </p>
          </div>
          <div>
            <p className="font-bold uppercase tracking-wider text-charcoal-muted mb-1">Base Negative Prompt</p>
            <p className="font-mono bg-cream-light p-3 rounded-xl border border-cream-border/60 text-charcoal leading-relaxed">
              {template.negativePrompt || '—'}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
