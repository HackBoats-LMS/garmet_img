'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Edit3, ToggleLeft, ToggleRight, Layers, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
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
  _count?: { imageSlots: number; poses: number; customOptions: number };
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    await fetch(`/api/admin/templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Garment Templates</h1>
          <p className="mt-1 text-sm text-charcoal-muted font-normal">
            Configure garment categories, upload requirements, custom options, and AI poses
          </p>
        </div>
        <Link href="/admin/templates/new">
          <Button size="md">
            <Plus className="w-4 h-4" />
            Create Template
          </Button>
        </Link>
      </div>

      {/* Templates List */}
      {templates.length === 0 && !loading ? (
        <Card className="p-16 text-center">
          <Layers className="w-14 h-14 text-charcoal-light/30 mx-auto" />
          <h3 className="mt-4 font-display text-xl font-bold text-charcoal">No templates yet</h3>
          <p className="mt-2 text-sm text-charcoal-muted max-w-sm mx-auto">
            Create your first garment photoshoot template like Saree, Kurti, or Western Gown.
          </p>
          <Link href="/admin/templates/new" className="inline-block mt-6">
            <Button size="lg">
              <Plus className="w-4 h-4" /> Create Template
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className="p-6 hover:shadow-md transition-all duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                {/* Left: Info */}
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-cream-dark/60 flex items-center justify-center shrink-0 overflow-hidden border border-cream-border">
                    {template.coverImage ? (
                      <img src={template.coverImage} alt={template.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-2xl font-bold text-charcoal/20">
                        {template.name?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg font-bold text-charcoal">{template.name}</h3>
                      <Badge variant={template.isActive ? 'success' : 'muted'}>
                        {template.isActive ? 'Active' : 'Draft'}
                      </Badge>
                    </div>
                    {template.tagline && (
                      <p className="text-xs text-charcoal-muted mt-1">{template.tagline}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-charcoal-light font-medium">
                      <span>Slug: <code className="text-charcoal bg-cream px-1.5 py-0.5 rounded font-mono">{template.slug}</code></span>
                    </div>
                  </div>
                </div>

                {/* Right: Controls & Actions */}
                <div className="flex items-center gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-cream-border/60">
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
                      <button className="p-2.5 rounded-xl text-charcoal-muted hover:text-accent hover:bg-accent-bg transition-colors cursor-pointer border border-cream-border shadow-xs">
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </Link>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2.5 rounded-xl text-charcoal-muted hover:text-error hover:bg-red-50 transition-colors cursor-pointer border border-cream-border shadow-xs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
