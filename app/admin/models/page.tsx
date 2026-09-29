'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Edit3, X, Upload, Users, Sparkles, Check } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Input, Textarea } from '@/app/components/ui/Input';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Toggle } from '@/app/components/ui/Toggle';

interface AIModelData {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  skinTone: string;
  features: string;
  promptAnchor: string;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<AIModelData[]>([]);
  const [editingModel, setEditingModel] = useState<Partial<AIModelData> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/models');
      const data = await res.json();
      if (data?.models) {
        setModels(data.models);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setIsNew(true);
    setEditingModel({
      name: '',
      tagline: '',
      imageUrl: '',
      skinTone: '',
      features: '',
      promptAnchor: '',
      isActive: true,
    });
  };

  const handleEdit = (model: AIModelData) => {
    setIsNew(false);
    setEditingModel({ ...model });
  };

  const handleSave = async () => {
    if (!editingModel?.name) return;
    setSaving(true);

    try {
      const payload = {
        ...editingModel,
        promptAnchor: editingModel.promptAnchor || `${editingModel.name}, Indian female fashion model with natural skin tone`,
      };

      const url = isNew ? '/api/admin/models' : `/api/admin/models/${editingModel.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Failed to save model');
        setSaving(false);
        return;
      }

      setEditingModel(null);
      await fetchModels();
    } catch (err: any) {
      alert(err.message || 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI model persona?')) return;
    await fetch(`/api/admin/models/${id}`, { method: 'DELETE' });
    fetchModels();
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await fetch(`/api/admin/models/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    fetchModels();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEditingModel((prev) => prev ? { ...prev, imageUrl: ev.target?.result as string } : prev);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">AI Model Personas</h1>
          <p className="mt-1 text-sm text-charcoal-muted font-normal">
            Manage the model faces, identities, and prompt anchors available in photoshoots
          </p>
        </div>
        <Button onClick={handleNew} size="md">
          <Plus className="w-4 h-4" />
          Add Model Persona
        </Button>
      </div>

      {/* Edit/Create Modal rendered directly to body */}
      {mounted && editingModel && createPortal(
        <div className="fixed inset-0 z-[100] bg-charcoal/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="w-full max-w-xl max-h-[88vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-cream-border overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 px-6 border-b border-cream-border/60 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-charcoal">
                  {isNew ? 'Add New Model Persona' : 'Edit Model Persona'}
                </h3>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  The model face photo is used as the primary likeness reference
                </p>
              </div>
              <button
                onClick={() => setEditingModel(null)}
                className="p-2 rounded-xl hover:bg-cream text-charcoal-muted hover:text-charcoal transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Portrait Upload */}
              <div className="flex items-center gap-5 p-4 rounded-2xl bg-cream-light border border-cream-border/60">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setEditingModel((prev) => prev ? { ...prev, imageUrl: ev.target?.result as string } : prev);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-cream-border hover:border-accent flex items-center justify-center cursor-pointer overflow-hidden transition-colors shrink-0 shadow-xs"
                >
                  {editingModel.imageUrl ? (
                    <img src={editingModel.imageUrl} alt="Model" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="w-6 h-6 text-charcoal-light" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-charcoal">Model Portrait Photo</p>
                  <p className="text-xs text-charcoal-muted mt-0.5">High-quality face shot (Click or drag & drop)</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-accent hover:underline mt-2 inline-block cursor-pointer"
                  >
                    {editingModel.imageUrl ? 'Change photo' : 'Upload or drop photo'}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Model Name"
                  value={editingModel.name || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                  placeholder="e.g. Ananya"
                  required
                />
                <Input
                  label="Tagline / Style"
                  value={editingModel.tagline || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, tagline: e.target.value })}
                  placeholder="e.g. South Indian Traditional"
                />
              </div>

              <Input
                label="Skin Tone & Demographics"
                value={editingModel.skinTone || ''}
                onChange={(e) => setEditingModel({ ...editingModel, skinTone: e.target.value })}
                placeholder="e.g. Warm Golden Wheatish / Amber"
              />

              <Textarea
                label="Physical Features & Jewelry Style"
                value={editingModel.features || ''}
                onChange={(e) => setEditingModel({ ...editingModel, features: e.target.value })}
                placeholder="e.g. Symmetrical almond eyes, neat bun with jasmine gajra, antique ruby choker..."
                rows={2}
              />

              <div>
                <label className="block text-xs font-bold text-charcoal uppercase tracking-wider mb-1.5">
                  AI Prompt Consistency Anchor (Optional)
                </label>
                <Textarea
                  value={editingModel.promptAnchor || ''}
                  onChange={(e) => setEditingModel({ ...editingModel, promptAnchor: e.target.value })}
                  placeholder="Optional styling prompt notes (e.g. 24-year-old Indian female model, radiant natural skin)"
                  rows={2}
                />
                <p className="text-[11px] text-charcoal-muted mt-1">
                  ✨ The AI uses the portrait photo above as the primary 1:1 facial identity reference.
                </p>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="p-4 px-6 border-t border-cream-border/60 flex items-center justify-end gap-3 bg-cream-light shrink-0">
              <Button variant="ghost" onClick={() => setEditingModel(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {isNew ? 'Create Model Persona' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Models Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-charcoal">Loading model personas...</p>
        </div>
      ) : models.length === 0 ? (
        <Card className="p-16 text-center">
          <Users className="w-14 h-14 text-charcoal-light/30 mx-auto" />
          <h3 className="mt-4 font-display text-xl font-bold text-charcoal">No AI models added yet</h3>
          <p className="mt-2 text-sm text-charcoal-muted max-w-sm mx-auto">Add your first model persona for customer photoshoot selections.</p>
          <Button className="mt-6" onClick={handleNew}>
            <Plus className="w-4 h-4" /> Add Model
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <Card key={model.id} className="overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
              {/* Portrait */}
              <div className="h-56 bg-gradient-to-br from-cream-dark to-cream flex items-center justify-center relative overflow-hidden">
                {model.imageUrl ? (
                  <img src={model.imageUrl} alt={model.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <span className="font-display text-6xl font-bold text-charcoal/10">{model.name?.charAt(0)}</span>
                )}
                <div className="absolute top-3 right-3">
                  <Badge variant={model.isActive ? 'success' : 'muted'}>
                    {model.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Info */}
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-charcoal">{model.name}</h3>
                  {model.tagline && <p className="text-xs text-charcoal-muted mt-1">{model.tagline}</p>}
                  {model.skinTone && (
                    <p className="text-xs text-charcoal-light mt-3 bg-cream px-2.5 py-1 rounded-lg inline-block font-medium">
                      Tone: {model.skinTone}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-cream-border/60 flex items-center justify-between">
                  <Toggle
                    checked={model.isActive}
                    onChange={(val) => handleToggleActive(model.id, val)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(model)}
                      className="p-2 rounded-xl text-charcoal-muted hover:text-accent hover:bg-accent-bg transition-colors cursor-pointer border border-cream-border shadow-xs"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="p-2 rounded-xl text-charcoal-muted hover:text-error hover:bg-red-50 transition-colors cursor-pointer border border-cream-border shadow-xs"
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
