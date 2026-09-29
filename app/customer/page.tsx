'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';

interface TemplateCard {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  coverImage: string | null;
  description: string | null;
  imageSlots: { id: string; name: string }[];
  poses: { id: string; name: string }[];
}

export default function CustomerHomePage() {
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates');
      const data = await res.json();
      setTemplates((data.templates || []).filter((t: any) => t.isActive));
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-charcoal-muted">Loading garment categories...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16 animate-fade-in">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-bg text-accent text-xs font-semibold border border-accent-border">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Photoshoot Studio</span>
          </div>
          <Link
            href="/customer/gallery"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-cream-dark text-charcoal text-xs font-semibold border border-cream-border transition-colors shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-accent" />
            <span>My Gallery</span>
          </Link>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-charcoal leading-tight">
          What are you creating <span className="text-accent">today?</span>
        </h1>
        <p className="mt-4 text-base text-charcoal-muted leading-relaxed font-normal">
          Select a garment category below to start your AI photoshoot. Upload your fabric swatches,
          choose a model persona, and download stunning 4K catalog assets.
        </p>
      </div>

      {/* Template Cards */}
      {templates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-cream-border p-12 max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-cream-dark/50 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-charcoal-light" />
          </div>
          <h3 className="font-display text-xl font-bold text-charcoal">No active templates</h3>
          <p className="mt-2 text-sm text-charcoal-muted">
            The studio admin hasn&apos;t created any active garment templates yet. Check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {templates.map((template) => (
            <Link key={template.id} href={`/customer/order/${template.id}`} className="group">
              <div className="rounded-3xl bg-white border border-cream-border overflow-hidden hover:border-accent/40 hover:shadow-xl transition-all duration-300 flex flex-col h-full group-hover:-translate-y-1">
                {/* Cover Image */}
                <div className="relative aspect-[9/9] bg-gradient-to-br from-cream-dark to-cream overflow-hidden">
                  {template.coverImage ? (
                    <img
                      src={template.coverImage}
                      alt={template.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-charcoal-light/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent" />
                  
                  <div className="absolute bottom-5 left-5 right-5">
                    <h3 className="font-display text-xl font-bold text-white drop-shadow-sm">
                      {template.name}
                    </h3>
                    {template.tagline && (
                      <p className="text-xs text-cream-dark/90 mt-1 font-medium drop-shadow-sm">{template.tagline}</p>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  {template.description && (
                    <p className="text-sm text-charcoal-muted leading-relaxed line-clamp-2 mb-6 font-normal">
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-cream-border/50">
                    <div className="flex gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cream text-charcoal-soft border border-cream-border/60">
                        {template.imageSlots?.length || 0} photos
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cream text-charcoal-soft border border-cream-border/60">
                        {template.poses?.length || 0} poses
                      </span>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center group-hover:bg-accent-hover group-hover:scale-105 transition-all shadow-sm">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
