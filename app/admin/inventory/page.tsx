'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus, Search, Filter, Package, RefreshCw, Archive, Camera,
  ChevronUp, ChevronDown, AlertCircle, CheckCircle2,
  XCircle, Layers, Edit2, MoreHorizontal, Tag,
  Upload, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import * as XLSX from 'xlsx';
import { parseSheetSmart, mapSpreadsheetRow } from '@/lib/spreadsheet-mapper';

interface Category { id: string; name: string; slug: string; subCategories: { id: string; name: string; slug: string }[] }
interface Product {
  id: string;
  stockCode: string;
  code1?: string | null;
  friendlyCode?: string | null;
  productName?: string;
  title?: string;
  color: string | null;
  clothType: string | null;
  price?: number | null;
  unitPrice?: number | null;
  retailPrice?: number | null;
  dealerPrice?: number | null;
  mrp?: number | null;
  quantity: number;
  reservedQty: number;
  soldQty: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED' | 'DRAFT';
  coverImageUrl: string | null;
  category: { id: string; name: string; slug: string } | null;
  subCategory: { id: string; name: string; slug: string } | null;
  updatedAt: string;
  _count?: { inventoryLogs: number };
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'In Stock', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Archive },
  DRAFT: { label: 'Draft', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertCircle },
};

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Quick qty edit
  const [editingQty, setEditingQty] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');

  // XLSX Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ message: string; success: boolean } | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress('Reading and preparing file on your PC...');
    setImportResult(null);

    try {
      // 1. Parse spreadsheet entirely on the user's PC using local CPU
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      let targetSheet: XLSX.WorkSheet | null = null;
      for (const name of workbook.SheetNames) {
        const s = workbook.Sheets[name];
        if (s && s['!ref']) {
          targetSheet = s;
          break;
        }
      }

      if (!targetSheet) {
        throw new Error('Spreadsheet has no data sheets');
      }

      // Detect header row and extract rows locally on client
      const rawRows = parseSheetSmart(targetSheet);
      if (!rawRows || rawRows.length === 0) {
        throw new Error('No rows found in spreadsheet');
      }

      // Map, normalize, clean, and validate all fields locally on the user's PC
      const allMapped = rawRows.map(mapSpreadsheetRow);
      const validProducts = allMapped.filter(p => p.stockCode && p.stockCode !== '0' && p.stockCode !== '-');
      const skippedLocally = allMapped.length - validProducts.length;

      if (validProducts.length === 0) {
        throw new Error('No valid products found in the sheet. Please ensure a Stock Code, Code, or Product Code column exists.');
      }

      const total = validProducts.length;

      // 2. Pre-check existence of IDs / barcodes to reduce database strain
      setImportProgress('Verifying product IDs and barcodes with database...');
      let preCheckSummary = '';
      try {
        const verifyRes = await fetch('/api/admin/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifyOnly: true,
            products: validProducts.map(p => ({ id: p.id, stockCode: p.stockCode, code1: p.code1 })),
          }),
        });
        if (verifyRes.ok) {
          const vData = await verifyRes.json();
          if (vData.verified) {
            preCheckSummary = `${vData.newCount} new, ${vData.existingCount} existing`;
          }
        }
      } catch {
        // Non-blocking pre-check
      }

      // 3. Stream in low-load batches of 25 items with live progress and pool-friendly throttling
      const BATCH_SIZE = 25;
      const totalBatches = Math.ceil(total / BATCH_SIZE);
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalSkipped = skippedLocally;
      const allErrors: string[] = [];

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const batch = validProducts.slice(i, i + BATCH_SIZE);
        const processedSoFar = Math.min(i + BATCH_SIZE, total);
        const percent = Math.round((processedSoFar / total) * 100);

        setImportProgress(
          `Batch ${batchNum}/${totalBatches}: ${processedSoFar} of ${total} products (${percent}%)${preCheckSummary ? ` [${preCheckSummary}]` : ''}...`
        );

        const res = await fetch('/api/admin/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: batch }),
        });

        const rawText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(rawText && rawText.length < 300 ? rawText : `Server returned status ${res.status}`);
        }

        if (!res.ok) {
          throw new Error(data.error || data.message || `Server error ${res.status}`);
        }

        totalCreated += data.created || 0;
        totalUpdated += data.updated || 0;
        totalSkipped += data.skipped || 0;
        if (Array.isArray(data.errors)) {
          allErrors.push(...data.errors);
        }

        // 50ms pause between batches to keep DB connection pool healthy and avoid CPU spikes
        if (processedSoFar < total) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setImportResult({
        message: `Import complete — ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped${allErrors.length > 0 ? ` (${allErrors.length} warnings)` : ''}`,
        success: true,
      });
      fetchProducts();
    } catch (err: any) {
      console.error('Import error:', err);
      setImportResult({ message: err.message || 'Import failed', success: false });
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryId) params.set('categoryId', categoryId);
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, statusFilter, page]);

  useEffect(() => {
    fetch('/api/admin/categories').then(async r => {
      if (!r.ok) return { categories: [] };
      const text = await r.text();
      return text ? JSON.parse(text) : { categories: [] };
    }).then(d => setCategories(d.categories || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  const handleQuickQtyUpdate = async (productId: string, newQty: number) => {
    await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty, adjustmentNote: 'Quick quantity edit' }),
    });
    setEditingQty(null);
    fetchProducts();
  };

  const handleAdjustQty = async (productId: string, delta: number) => {
    await fetch(`/api/admin/products/${productId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantityAdjustment: delta, adjustmentNote: delta > 0 ? 'Quick +1' : 'Quick -1' }),
    });
    fetchProducts();
  };

  const stats = {
    total: total,
    inStock: products.filter(p => p.status === 'ACTIVE').length,
    outOfStock: products.filter(p => p.status === 'OUT_OF_STOCK').length,
    lowStock: products.filter(p => p.status === 'ACTIVE' && p.quantity <= 3).length,
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-charcoal">Inventory</h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Manage products, stock levels, pricing and platform integrations
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-cream-border bg-white text-sm font-semibold text-charcoal hover:border-emerald-500 hover:text-emerald-700 transition-all disabled:opacity-60 cursor-pointer"
          >
            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            {importing ? (importProgress || 'Importing...') : 'Import Excel'}
          </button>
          <Link href="/admin/categories">
            <Button variant="secondary" size="md">
              <Layers className="w-4 h-4" />
              Categories
            </Button>
          </Link>
          <Link href="/admin/inventory/new">
            <Button size="md">
              <Plus className="w-4 h-4" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Live Import Progress Banner */}
      {importing && importProgress && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium border bg-blue-50 border-blue-200 text-blue-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-semibold">{importProgress}</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
            Client-Side Fast Processing
          </span>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium border ${
          importResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {importResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {importResult.message}
          </div>
          <button onClick={() => setImportResult(null)} className="cursor-pointer opacity-60 hover:opacity-100">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: total, color: 'text-charcoal', icon: Package },
          { label: 'In Stock', value: stats.inStock, color: 'text-emerald-600', icon: CheckCircle2 },
          { label: 'Out of Stock', value: stats.outOfStock, color: 'text-red-600', icon: XCircle },
          { label: 'Low Stock (≤3)', value: stats.lowStock, color: 'text-amber-600', icon: AlertCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`font-display text-3xl font-extrabold mt-2 ${s.color}`}>
                {loading ? '—' : s.value}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-muted" />
          <input
            suppressHydrationWarning
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="Search by code, title, tag, colour..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">In Stock</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <button
          onClick={fetchProducts}
          className="p-2.5 rounded-xl border border-cream-border bg-white text-charcoal-muted hover:text-charcoal hover:border-accent/40 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Product Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-charcoal-muted">Loading products...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <Package className="w-12 h-12 text-charcoal-light/30 mx-auto" />
            <div>
              <p className="font-display text-base font-bold text-charcoal">No products found</p>
              <p className="text-xs text-charcoal-muted mt-1">
                {search || categoryId || statusFilter
                  ? 'Try clearing filters'
                  : 'Add your first product to get started'}
              </p>
            </div>
            {!search && !categoryId && !statusFilter && (
              <Link href="/admin/inventory/new">
                <Button size="md" className="mt-2">
                  <Plus className="w-4 h-4" /> Add First Product
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-border bg-cream-light">
                  <th className="text-left px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted whitespace-nowrap">Product</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Stock Code</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Category</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Price</th>
                  <th className="text-center px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Qty</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Status</th>
                  <th className="text-right px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-border/50">
                {products.map((product) => {
                  const statusCfg = STATUS_CONFIG[product.status] || STATUS_CONFIG.ACTIVE;
                  const StatusIcon = statusCfg.icon;
                  const isLowStock = product.status === 'ACTIVE' && product.quantity <= 3 && product.quantity > 0;

                  return (
                    <tr key={product.id} className="hover:bg-cream-light/50 transition-colors group">
                      {/* Product */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-cream-dark/40 border border-cream-border shrink-0">
                            {product.coverImageUrl ? (
                              <img src={product.coverImageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-charcoal-light/30" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-charcoal text-sm truncate max-w-[200px]" title={product.productName || product.title || product.stockCode}>
                              {product.productName || product.title || product.stockCode}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {product.color && (
                                <span className="text-[10px] text-charcoal-muted">{product.color}</span>
                              )}
                              {product.clothType && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent font-semibold">{product.clothType}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stock Code */}
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs font-bold text-charcoal">{product.stockCode}</p>
                        {(product.code1 || product.friendlyCode) && (
                          <p className="font-mono text-[10px] text-charcoal-muted mt-0.5 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {product.code1 || product.friendlyCode}
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-4">
                        {product.category ? (
                          <div>
                            <p className="text-xs font-semibold text-charcoal">{product.category.name}</p>
                            {product.subCategory && (
                              <p className="text-[10px] text-charcoal-muted mt-0.5">{product.subCategory.name}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-charcoal-light italic">—</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4">
                        {(product.retailPrice != null || product.price != null || product.unitPrice != null) ? (
                          <div>
                            <p className="text-sm font-bold text-charcoal">
                              ₹{(product.retailPrice ?? product.price ?? product.unitPrice)?.toLocaleString('en-IN')}
                            </p>
                            {product.unitPrice != null && (product.retailPrice ?? product.price) != null && product.unitPrice !== (product.retailPrice ?? product.price) && (
                              <p className="text-[10px] text-charcoal-muted">Cost: ₹{product.unitPrice.toLocaleString('en-IN')}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-charcoal-light italic">—</span>
                        )}
                      </td>

                      {/* Quantity — inline edit */}
                      <td className="px-4 py-4 text-center">
                        {editingQty === product.id ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              value={qtyInput}
                              onChange={e => setQtyInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleQuickQtyUpdate(product.id, parseInt(qtyInput) || 0);
                                if (e.key === 'Escape') setEditingQty(null);
                              }}
                              className="w-14 px-2 py-1 text-center text-xs border border-accent rounded-lg focus:outline-none"
                            />
                            <button
                              onClick={() => handleQuickQtyUpdate(product.id, parseInt(qtyInput) || 0)}
                              className="p-1 rounded bg-accent text-white cursor-pointer"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleAdjustQty(product.id, -1)}
                              disabled={product.quantity === 0}
                              className="p-1 rounded text-charcoal-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingQty(product.id); setQtyInput(String(product.quantity)); }}
                              className={`w-10 text-center font-bold text-sm rounded-lg px-1.5 py-0.5 cursor-pointer transition-colors ${
                                isLowStock ? 'text-amber-700 bg-amber-50 border border-amber-200' :
                                product.quantity === 0 ? 'text-red-700 bg-red-50 border border-red-200' :
                                'text-charcoal hover:bg-cream-light'
                              }`}
                              title="Click to edit"
                            >
                              {product.quantity}
                            </button>
                            <button
                              onClick={() => handleAdjustQty(product.id, 1)}
                              className="p-1 rounded text-charcoal-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {product.soldQty > 0 && (
                          <p className="text-[9px] text-charcoal-muted mt-0.5">{product.soldQty} sold</p>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${statusCfg.color}`}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {statusCfg.label}
                        </span>
                        {isLowStock && (
                          <p className="text-[9px] text-amber-600 font-semibold mt-0.5">Low stock</p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/admin/generate?productId=${product.id}`}>
                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white border border-transparent bg-accent hover:bg-accent/90 transition-all cursor-pointer shadow-sm">
                              <Camera className="w-3 h-3" />
                              Generate AI
                            </button>
                          </Link>
                          <Link href={`/admin/inventory/${product.id}`}>
                            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-charcoal border border-cream-border hover:border-accent hover:text-accent transition-all cursor-pointer bg-white">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-5 py-4 border-t border-cream-border flex items-center justify-between text-sm">
            <p className="text-charcoal-muted text-xs">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} products
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-cream-border text-xs font-semibold disabled:opacity-40 hover:border-accent transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= total}
                className="px-3 py-1.5 rounded-lg border border-cream-border text-xs font-semibold disabled:opacity-40 hover:border-accent transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
