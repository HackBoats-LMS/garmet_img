'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Eye, Lock, Sparkles } from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Toggle } from '@/app/components/ui/Toggle';

interface TemplateListItem {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  coverImage: string | null;
  isActive: boolean;
  allowModelSelection: boolean;
  createdAt: string;
  imageSlots?: any[];
  poses?: any[];
  customOptions?: any[];
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await fetch(`/api/admin/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    });
    fetchTemplates();
  };

  const handleToggleModelSelection = async (id: string, current: boolean) => {
    await fetch(`/api/admin/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowModelSelection: !current }),
    });
    fetchTemplates();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold text-charcoal">Garment Templates</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="w-3 h-3" />
              Code-Managed
            </span>
          </div>
          <p className="mt-1 text-sm text-charcoal-muted font-normal">
            Garment categories, upload slots, custom options, and AI poses are hardcoded for generation accuracy
          </p>
        </div>
      </div>

      {/* Hardcoded Notice Banner */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-950">
        <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Templates are hardcoded in source code</p>
          <p className="text-amber-900/80 mt-0.5 leading-relaxed">
            Adding, editing structure, or deleting templates in the Admin Panel is disabled to keep Saree &amp; Kurti AI features
            (Delicate Buttis, Dual/Lower Border modes, Swatch Vision Scan, and Optical Mirror Physics) aligned.
            To modify template definitions, edit <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-amber-200">lib/hardcoded-templates.ts</code> and{' '}
            <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded border border-amber-200">app/utils/modelsAndPoses.ts</code>.
          </p>
        </div>
      </div>

      {/* Templates List */}
      {templates.length === 0 && !loading ? (
        <Card className="p-16 text-center">
          <Layers className="w-14 h-14 text-charcoal-light/30 mx-auto" />
          <h3 className="mt-4 font-display text-xl font-bold text-charcoal">No templates loaded</h3>
          <p className="mt-2 text-sm text-charcoal-muted max-w-sm mx-auto">
            Check <code className="font-mono text-xs bg-cream px-1.5 py-0.5 rounded">lib/hardcoded-templates.ts</code> to configure garment templates.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-md transition-all duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                {/* Left: Info */}
                <div className="flex items-center gap-5">
                  <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-2xl bg-cream-dark/60 flex items-center justify-center shrink-0 overflow-hidden border border-cream-border relative shadow-xs">
                    {template.coverImage ? (
                      <img
                        src={template.coverImage}
                        alt={template.name}
                        className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="font-display text-2xl font-bold text-charcoal/20">
                        {template.name?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-display text-lg font-bold text-charcoal">{template.name}</h3>
                      <Badge variant={template.isActive ? 'success' : 'muted'}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    {template.tagline && (
                      <p className="text-xs text-charcoal-muted mt-1">{template.tagline}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-charcoal-light font-medium">
                      <span>
                        Slug: <code className="text-charcoal bg-cream px-1.5 py-0.5 rounded font-mono">{template.slug}</code>
                      </span>
                      {template.imageSlots && (
                        <span className="bg-cream px-2 py-0.5 rounded-md border border-cream-border/60 text-charcoal-muted">
                          {template.imageSlots.length} Slots
                        </span>
                      )}
                      {template.poses && (
                        <span className="bg-cream px-2 py-0.5 rounded-md border border-cream-border/60 text-charcoal-muted">
                          {template.poses.length} Poses
                        </span>
                      )}
                      {template.customOptions && (
                        <span className="bg-cream px-2 py-0.5 rounded-md border border-cream-border/60 text-charcoal-muted">
                          {template.customOptions.length} Options
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Controls & Read-Only Inspector */}
                <div className="flex items-center gap-5 border-t md:border-t-0 pt-4 md:pt-0 border-cream-border/60 flex-wrap">
                  {/* Model Selection Toggle */}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-charcoal">Customer Model Pick</p>
                    <button
                      onClick={() => handleToggleModelSelection(template.id, template.allowModelSelection)}
                      className={`text-xs font-bold mt-1 px-3 py-1 rounded-full border transition-all cursor-pointer ${
                        template.allowModelSelection
                          ? 'bg-accent-bg text-accent border-accent-border'
                          : 'bg-cream text-charcoal-muted border-cream-border'
                      }`}
                    >
                      {template.allowModelSelection ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {/* Active Toggle */}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-charcoal">Status</p>
                    <div className="mt-1">
                      <Toggle
                        checked={template.isActive}
                        onChange={() => handleToggleActive(template.id, template.isActive)}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/templates/${template.id}`}>
                      <button
                        title="Inspect template configuration (Read-Only)"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-charcoal hover:text-accent hover:bg-accent-bg transition-colors cursor-pointer border border-cream-border shadow-xs bg-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </Link>
                    <Link href={`/admin/generate/${template.id}`}>
                      <button
                        title="Open in AI Photoshoot Studio"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent/90 transition-colors cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Studio</span>
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
