'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Layers, ArrowLeft, ArrowRight, Image as ImageIcon } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  tagline: string | null;
  coverImage: string | null;
  description: string | null;
  isActive: boolean;
  imageSlots: { id: string }[];
  poses: { id: string }[];
}

interface Product {
  id: string;
  title: string;
  stockCode: string;
  friendlyCode: string | null;
  color: string | null;
  clothType: string | null;
  description: string | null;
  coverImageUrl: string | null;
}

function GeneratePickerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');

  const [product, setProduct] = useState<Product | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!productId) { setError('No product specified.'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/admin/products/${productId}`).then(async r => { if (!r.ok) return {}; const text = await r.text(); return text ? JSON.parse(text) : {}; }),
      fetch('/api/admin/templates').then(async r => { if (!r.ok) return {}; const text = await r.text(); return text ? JSON.parse(text) : {}; }),
    ]).then(([pData, tData]) => {
      setProduct(pData.product || null);
      setTemplates((tData.templates || []).filter((t: Template) => t.isActive));
    }).catch(() => setError('Failed to load data.')).finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-charcoal-muted">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-32">
        <p className="text-sm text-red-600 font-medium">{error || 'Product not found.'}</p>
        <Link href="/admin/inventory" className="mt-4 inline-block text-xs text-accent hover:underline">← Back to Inventory</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/inventory"
          className="p-2 rounded-xl border border-cream-border text-charcoal-muted hover:text-charcoal hover:border-charcoal transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-accent" />
            <h1 className="font-display text-xl font-bold text-charcoal">AI Photoshoot</h1>
          </div>
          <p className="text-xs text-charcoal-muted mt-0.5">
            Generating for: <span className="font-semibold text-charcoal">{product.title}</span>
            {product.stockCode && <span className="ml-1 text-charcoal-light">· {product.stockCode}</span>}
          </p>
        </div>
      </div>

      {/* Product summary pill */}
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-cream-border mb-8 shadow-sm">
        {product.coverImageUrl ? (
          <img src={product.coverImageUrl} alt={product.title} className="w-14 h-14 rounded-xl object-cover border border-cream-border flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-cream-dark flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-6 h-6 text-charcoal-light" />
          </div>
        )}
        <div>
          <p className="font-semibold text-sm text-charcoal">{product.title}</p>
          <p className="text-xs text-charcoal-muted mt-0.5">
            {[product.color, product.clothType, product.friendlyCode || product.stockCode].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Template picker */}
      <div className="mb-4">
        <h2 className="font-display text-base font-bold text-charcoal mb-1">Select a Photoshoot Template</h2>
        <p className="text-xs text-charcoal-muted">Choose the garment template that matches this product type.</p>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-cream-border">
          <Layers className="w-10 h-10 text-charcoal-light mx-auto mb-3" />
          <p className="text-sm font-semibold text-charcoal">No active templates</p>
          <p className="text-xs text-charcoal-muted mt-1">Create a template in the Templates section first.</p>
          <Link href="/admin/templates" className="mt-4 inline-block text-xs text-accent font-semibold hover:underline">Go to Templates →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => router.push(`/admin/generate/${template.id}?productId=${productId}`)}
              className="group text-left rounded-2xl bg-white border border-cream-border hover:border-accent/50 hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer"
            >
              {/* Cover */}
              <div className="aspect-[16/9] bg-gradient-to-br from-cream-dark to-cream overflow-hidden relative">
                {template.coverImage ? (
                  <img src={template.coverImage} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-8 h-8 text-charcoal-light/30" />
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="font-display text-sm font-bold text-charcoal group-hover:text-accent transition-colors">{template.name}</h3>
                {template.tagline && <p className="text-xs text-charcoal-muted mt-0.5 line-clamp-1">{template.tagline}</p>}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream text-charcoal-soft border border-cream-border">
                      {template.imageSlots?.length || 0} slots
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cream text-charcoal-soft border border-cream-border">
                      {template.poses?.length || 0} poses
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminGeneratePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GeneratePickerContent />
    </Suspense>
  );
}
