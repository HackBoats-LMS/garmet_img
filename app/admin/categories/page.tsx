'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Layers, Tag, Package } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Input } from '@/app/components/ui/Input';

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { products: number };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New category
  const [newCatName, setNewCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);

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
      await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      setNewCatName('');
      setShowAddCat(false);
      await fetchCategories();
    } finally {
      setAddingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? All products will lose this classification.`)) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
    await fetchCategories();
  };

  // Pre-filled suggested categories
  const SUGGESTED_CATEGORIES = [
    { name: 'Saree' },
    { name: 'Kurthi' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Categories</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Manage garment categories for your inventory
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
                </div>
                <button
                  onClick={async () => {
                    await fetch('/api/admin/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name: s.name,
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
          {categories.map(cat => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-5 hover:bg-cream-light/50 transition-colors">
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
                        <Package className="w-3 h-3" />
                        {cat._count?.products || 0} products
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="p-2 rounded-lg text-charcoal-light hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
