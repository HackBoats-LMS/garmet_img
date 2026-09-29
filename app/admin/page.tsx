'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Layers, Users, ShoppingBag, Plus, ArrowRight, TrendingUp, Cpu } from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';

interface Stats {
  templateCount: number;
  modelCount: number;
  orderCount: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ templateCount: 0, modelCount: 0, orderCount: 0 });
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        fetch('/api/admin/templates'),
        fetch('/api/admin/models'),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();

      const templateList = tData.templates || [];
      const modelList = mData.models || [];

      setTemplates(templateList);
      setStats({
        templateCount: templateList.length,
        modelCount: modelList.length,
        orderCount: 12,
      });
    } catch (e) {
      console.error('Failed to load admin dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Active Templates', value: stats.templateCount, icon: Layers, href: '/admin/templates', color: 'text-accent' },
    { label: 'AI Engine & Models', value: 'Active', icon: Cpu, href: '/admin/model-selection', color: 'text-purple-500' },
    { label: 'Model Personas', value: stats.modelCount, icon: Users, href: '/admin/models', color: 'text-blue-500' },
    { label: 'Total Photoshoots', value: stats.orderCount, icon: ShoppingBag, href: '/admin', color: 'text-emerald-500' },
  ];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Studio Dashboard</h1>
          <p className="mt-1 text-sm text-charcoal-muted font-normal">
            Manage your garment photoshoot pipeline, AI models, and category templates
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/model-selection">
            <Button variant="secondary" size="md">
              <Cpu className="w-4 h-4 text-accent" />
              AI Engine Hub
            </Button>
          </Link>
          <Link href="/admin/templates/new">
            <Button size="md">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="p-6 hover:border-accent/40 hover:shadow-md transition-all duration-200 group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">{stat.label}</span>
                  <div className="w-10 h-10 rounded-xl bg-cream flex items-center justify-center group-hover:bg-accent-bg transition-colors">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-charcoal">
                    {loading ? '—' : stat.value}
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Templates Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-charcoal">Garment Templates</h2>
          <Link
            href="/admin/templates"
            className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
          >
            View All ({templates.length})
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {templates.length === 0 && !loading ? (
          <Card className="p-12 text-center">
            <Layers className="w-12 h-12 text-charcoal-light/40 mx-auto" />
            <h3 className="mt-4 font-display text-lg font-bold text-charcoal">No templates created yet</h3>
            <p className="mt-2 text-sm text-charcoal-muted">Create your first garment photoshoot template (e.g. Saree, Kurti)</p>
            <Link href="/admin/templates/new" className="inline-block mt-6">
              <Button>
                <Plus className="w-4 h-4" /> Create Template
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {templates.slice(0, 4).map((template) => (
              <Link key={template.id} href={`/admin/templates/${template.id}`}>
                <Card className="p-6 hover:border-accent/40 hover:shadow-md transition-all duration-200 group flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-cream-dark/60 flex items-center justify-center shrink-0 overflow-hidden">
                    {template.coverImage ? (
                      <img src={template.coverImage} alt={template.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-xl font-bold text-charcoal/20">{template.name?.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-charcoal truncate">{template.name}</h3>
                      <Badge variant={template.isActive ? 'success' : 'muted'}>
                        {template.isActive ? 'Active' : 'Draft'}
                      </Badge>
                    </div>
                    <p className="text-xs text-charcoal-muted mt-1 truncate">{template.tagline || 'No tagline'}</p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-charcoal-light font-medium">
                      <span>{template.imageSlots?.length || 0} Slots</span>
                      <span>•</span>
                      <span>{template.poses?.length || 0} Poses</span>
                      <span>•</span>
                      <span className={template.allowModelSelection ? 'text-accent' : 'text-charcoal-muted'}>
                        {template.allowModelSelection ? 'Model Selection ON' : 'Model Selection OFF'}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
