'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Layers, Tag, Package } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';

interface SubCategory { id: string; name: string; slug: string; sortOrder: number }
interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  subCategories: SubCategory[];
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // New category
  const [newCatName, setNewCatName] = useState('');
  const [newCatSubs, setNewCatSubs] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

  // New sub-category per category
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const subs = newCatSubs
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), subCategories: subs }),
      });
      setNewCatName('');
      setNewCatSubs('');
      setShowAddCat(false);
      await fetchCategories();
    } finally {
      setAddingCat(false);
    }
  };

  const handleAddSub = async (categoryId: string) => {
    if (!newSubName.trim()) return;
    await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-sub', categoryId, subCategoryName: newSubName.trim() }),
    });
    setNewSubName('');
    setAddingSubFor(null);
    await fetchCategories();
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? All products will lose this classification.`)) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
    await fetchCategories();
  };

  const handleDeleteSub = async (subId: string, subName: string) => {
    if (!confirm(`Remove sub-category "${subName}"?`)) return;
    await fetch(`/api/admin/categories?subId=${subId}`, { method: 'DELETE' });
    await fetchCategories();
  };

  // Pre-filled suggested categories for saree brands
  const SUGGESTED_CATEGORIES = [
    { name: 'Saree', subs: 'Silk, Cotton, Linen, Tussar, Georgette, Chiffon, Ajrakh, Kanjivaram, Banarasi, Chanderi' },
    { name: 'Kurti', subs: 'Cotton, Silk, Rayon, Linen, Embroidered, Printed' },
    { name: 'Lehenga', subs: 'Bridal, Party Wear, Casual, Festive' },
    { name: 'Dupatta', subs: 'Silk, Chiffon, Cotton, Net' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Categories</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Manage garment categories and sub-categories for your inventory
          </p>
        </div>
        <Button onClick={() => setShowAddCat(v => !v)}>
          <Plus className="w-4 h-4" />
          New Category
        </Button>
      </div>

      {/* Add Category Form */}
      {showAddCat && (
        <Card className="p-6 border-accent/30 bg-accent-bg/20 space-y-4 animate-fade-in">
          <h3 className="font-display text-base font-bold text-charcoal">Add New Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Category Name *"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="e.g. Saree"
            />
            <Input
              label="Sub-categories (comma separated)"
              value={newCatSubs}
              onChange={e => setNewCatSubs(e.target.value)}
              placeholder="e.g. Silk, Cotton, Linen"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleAddCategory} loading={addingCat} disabled={!newCatName.trim()}>
              <Plus className="w-4 h-4" /> Create Category
            </Button>
            <button onClick={() => setShowAddCat(false)} className="text-sm text-charcoal-muted hover:text-charcoal cursor-pointer">
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Quick Add Suggestions */}
      {categories.length === 0 && !loading && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Tag className="w-4 h-4 text-accent" />
            Quick-start with suggested categories
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUGGESTED_CATEGORIES.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-4 rounded-xl border border-cream-border bg-cream-light hover:border-accent/40 transition-colors">
                <div>
                  <p className="text-sm font-bold text-charcoal">{s.name}</p>
                  <p className="text-[10px] text-charcoal-muted mt-0.5">{s.subs}</p>
                </div>
                <button
                  onClick={async () => {
                    await fetch('/api/admin/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: s.name,
                        subCategories: s.subs.split(',').map(x => x.trim()),
                      }),
                    });
                    fetchCategories();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold cursor-pointer hover:bg-accent-hover transition-colors"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-charcoal-muted">Loading categories...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => {
            const isExpanded = expanded === cat.id;
            return (
              <Card key={cat.id} className="overflow-hidden">
                {/* Category Row */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-cream-light/50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent-bg border border-accent-border flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-charcoal text-sm">{cat.name}</p>
                        <span className="text-[10px] font-mono text-charcoal-muted bg-cream-dark px-1.5 py-0.5 rounded">{cat.slug}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-charcoal-muted">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {cat.subCategories.length} sub-categories
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {cat._count?.products || 0} products
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                      className="p-2 rounded-lg text-charcoal-light hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-charcoal-muted" />
                      : <ChevronRight className="w-4 h-4 text-charcoal-muted" />
                    }
                  </div>
                </div>

                {/* Sub-categories (expanded) */}
                {isExpanded && (
                  <div className="border-t border-cream-border px-5 pb-5 pt-4 space-y-3 bg-cream-light/30">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Sub-categories</p>
                    <div className="flex flex-wrap gap-2">
                      {cat.subCategories.map(sub => (
                        <div key={sub.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-cream-border text-xs font-semibold text-charcoal group">
                          {sub.name}
                          <span className="font-mono text-[9px] text-charcoal-muted">({sub.slug})</span>
                          <button
                            onClick={() => handleDeleteSub(sub.id, sub.name)}
                            className="opacity-0 group-hover:opacity-100 text-charcoal-muted hover:text-red-600 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {cat.subCategories.length === 0 && (
                        <p className="text-xs text-charcoal-muted italic">No sub-categories yet</p>
                      )}
                    </div>

                    {/* Add sub-category inline */}
                    {addingSubFor === cat.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          autoFocus
                          suppressHydrationWarning
                          value={newSubName}
                          onChange={e => setNewSubName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddSub(cat.id); if (e.key === 'Escape') setAddingSubFor(null); }}
                          placeholder="Sub-category name (Enter to save)"
                          className="flex-1 px-3 py-2 rounded-xl border border-accent bg-white text-sm text-charcoal focus:outline-none"
                        />
                        <button
                          onClick={() => handleAddSub(cat.id)}
                          className="px-3 py-2 rounded-xl bg-accent text-white text-xs font-bold cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingSubFor(null)}
                          className="text-sm text-charcoal-muted cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingSubFor(cat.id); setNewSubName(''); }}
                        className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-hover cursor-pointer mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Sub-category
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
