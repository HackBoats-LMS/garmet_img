'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Plus, Search, Filter, Package, RefreshCw, Archive, Camera,
  ChevronUp, ChevronDown, AlertCircle, CheckCircle2,
  XCircle, Layers, Edit2, MoreHorizontal, Tag,
  Upload, FileSpreadsheet, Play, Pause, Square, Sparkles, Check, X, Globe, ShoppingBag, Trash, Trash2,
  RotateCcw, Download, SlidersHorizontal, ArrowUpDown, ImageOff, IndianRupee
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import * as XLSX from 'xlsx';
import { parseSheetSmart, mapSpreadsheetRow } from '@/lib/spreadsheet-mapper';
import { consolidateSpreadsheetRows } from '@/lib/size-inventory';

interface Category {
  id: string;
  name: string;
  slug: string;
  subCategories: { id: string; name: string; slug: string }[];
  _count?: { products: number };
}
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
  length_Size?: string | null;
  sizeInventory?: Record<string, any> | null;
  reservedQty: number;
  soldQty: number;
  status: 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED' | 'DRAFT';
  coverImageUrl: string | null;
  hasAi?: boolean;
  syncedAt?: string | null;
  category: { id: string; name: string; slug: string } | null;
  subCategory: { id: string; name: string; slug: string } | null;
  updatedAt: string;
  _count?: { inventoryLogs: number };
}
interface InventoryStats {
  total: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  categorized: number;
  uncategorized: number;
  synced: number;
  modified: number;
  unsynced: number;
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'In Stock', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  OUT_OF_STOCK: { label: 'Out of Stock', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  ARCHIVED: { label: 'Archived', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Archive },
  DRAFT: { label: 'Draft', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertCircle },
};

export default function AdminInventoryPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters (hydrated from URL query params on mount)
  const [filtersReady, setFiltersReady] = useState(false);
  const [search, setSearch] = useState('');
  const [categorizedFilter, setCategorizedFilter] = useState<'' | 'true' | 'false'>('');
  const [categoryId, setCategoryId] = useState('');
  const [subCategoryId, setSubCategoryId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [syncFilter, setSyncFilter] = useState<'' | 'synced' | 'modified' | 'unsynced'>('');
  const [missingImage, setMissingImage] = useState<'' | 'true' | 'false'>('');
  const [missingPrice, setMissingPrice] = useState<'' | 'true' | 'false'>('');
  const [missingAi, setMissingAi] = useState<'' | 'true' | 'false'>('');
  const [clothTypeFilter, setClothTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [globalStats, setGlobalStats] = useState<InventoryStats | null>(null);
  const [facets, setFacets] = useState<{ clothTypes: string[]; colors: string[] }>({ clothTypes: [], colors: [] });
  const [uncategorizedCount, setUncategorizedCount] = useState<number | null>(null);

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
      // Consolidate rows sharing same Code1 / Product with different sizes & quantities
      const consolidated = consolidateSpreadsheetRows(allMapped);
      const validProducts = consolidated.filter(p => p.stockCode && p.stockCode !== '0' && p.stockCode !== '-');
      const skippedLocally = allMapped.length - validProducts.length;

      if (validProducts.length === 0) {
        throw new Error('No valid products found in the sheet. Please ensure a Stock Code, Code, or Product Code column exists.');
      }

      const total = validProducts.length;

      // 2. Pre-check existence of IDs / stockCodes to reduce database strain
      setImportProgress('Verifying product stockCodes with database...');
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

  // Hydrate filters from URL on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('search')) setSearch(sp.get('search') || '');
    const catFlag = sp.get('categorized');
    if (catFlag === 'true' || catFlag === 'false') setCategorizedFilter(catFlag);
    const catId = sp.get('categoryId') || '';
    if (catId === 'uncategorized') {
      setCategorizedFilter('false');
    } else if (catId) {
      setCategoryId(catId);
    }
    if (sp.get('subCategoryId')) setSubCategoryId(sp.get('subCategoryId') || '');
    if (sp.get('status')) setStatusFilter(sp.get('status') || '');
    const sync = sp.get('syncStatus');
    if (sync === 'synced' || sync === 'modified' || sync === 'unsynced') setSyncFilter(sync);
    const mi = sp.get('missingImage');
    if (mi === 'true' || mi === 'false') setMissingImage(mi);
    const mp = sp.get('missingPrice');
    if (mp === 'true' || mp === 'false') setMissingPrice(mp);
    const ma = sp.get('missingAi');
    if (ma === 'true' || ma === 'false') setMissingAi(ma);
    if (sp.get('clothType')) setClothTypeFilter(sp.get('clothType') || '');
    if (sp.get('color')) setColorFilter(sp.get('color') || '');
    if (sp.get('sort')) setSort(sp.get('sort') || 'newest');
    if (sp.get('page')) setPage(Math.max(1, parseInt(sp.get('page') || '1') || 1));
    if (sp.get('limit')) {
      const parsedLimit = parseInt(sp.get('limit') || '20') || 20;
      if ([20, 50, 100].includes(parsedLimit)) setLimit(parsedLimit);
    }
    if (mi || mp || ma || sp.get('clothType') || sp.get('color')) {
      setShowMoreFilters(true);
    }
    setFiltersReady(true);
  }, []);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categorizedFilter) params.set('categorized', categorizedFilter);
    if (categoryId) params.set('categoryId', categoryId);
    if (subCategoryId) params.set('subCategoryId', subCategoryId);
    if (statusFilter) params.set('status', statusFilter);
    if (syncFilter) params.set('syncStatus', syncFilter);
    if (missingImage) params.set('missingImage', missingImage);
    if (missingPrice) params.set('missingPrice', missingPrice);
    if (missingAi) params.set('missingAi', missingAi);
    if (clothTypeFilter) params.set('clothType', clothTypeFilter);
    if (colorFilter) params.set('color', colorFilter);
    if (sort && sort !== 'newest') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    return params;
  }, [
    search, categorizedFilter, categoryId, subCategoryId, statusFilter,
    syncFilter, missingImage, missingPrice, missingAi, clothTypeFilter,
    colorFilter, sort, page, limit,
  ]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQueryParams();
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setFetchError(null);
      setProducts(data.products || []);
      setTotal(data.total || 0);
      if (data.stats) {
        setGlobalStats(data.stats);
        setUncategorizedCount(data.stats.uncategorized);
      } else if (typeof data.uncategorizedCount === 'number') {
        setUncategorizedCount(data.uncategorizedCount);
      }
      if (data.facets) {
        setFacets({
          clothTypes: data.facets.clothTypes || [],
          colors: data.facets.colors || [],
        });
      }
    } catch (err: any) {
      console.error('Fetch products error:', err);
      setFetchError(err.message || 'Failed to load products');
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, page, limit]);

  useEffect(() => {
    fetch('/api/admin/categories').then(async r => {
      if (!r.ok) return { categories: [] };
      const text = await r.text();
      return text ? JSON.parse(text) : { categories: [] };
    }).then(d => setCategories(d.categories || [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    if (typeof window !== 'undefined') {
      const params = buildQueryParams();
      const qs = params.toString();
      const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(null, '', nextUrl);
    }
    const t = setTimeout(fetchProducts, 250);
    return () => clearTimeout(t);
  }, [filtersReady, buildQueryParams, fetchProducts]);

  const resetAllFilters = () => {
    setSearch('');
    setCategorizedFilter('');
    setCategoryId('');
    setSubCategoryId('');
    setStatusFilter('');
    setSyncFilter('');
    setMissingImage('');
    setMissingPrice('');
    setMissingAi('');
    setClothTypeFilter('');
    setColorFilter('');
    setSort('newest');
    setPage(1);
  };

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

  // Quick category update for each product row
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);

  const handleQuickCategoryUpdate = async (productId: string, newCategoryId: string) => {
    setUpdatingCatId(productId);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: newCategoryId }),
      });
      if (res.ok) {
        const updatedCat = categories.find((c) => c.id === newCategoryId) || null;
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === productId) {
              const wasUncat = !p.category;
              if (wasUncat && updatedCat) {
                setUncategorizedCount((prevCount) => (prevCount !== null && prevCount > 0 ? prevCount - 1 : 0));
                setGlobalStats((prevStats) =>
                  prevStats
                    ? {
                        ...prevStats,
                        categorized: prevStats.categorized + 1,
                        uncategorized: Math.max(0, prevStats.uncategorized - 1),
                      }
                    : prevStats
                );
              } else if (!wasUncat && !updatedCat) {
                setUncategorizedCount((prevCount) => (prevCount !== null ? prevCount + 1 : 1));
                setGlobalStats((prevStats) =>
                  prevStats
                    ? {
                        ...prevStats,
                        categorized: Math.max(0, prevStats.categorized - 1),
                        uncategorized: prevStats.uncategorized + 1,
                      }
                    : prevStats
                );
              }
              return { ...p, category: updatedCat, subCategory: null };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.error('Quick category update failed:', err);
    } finally {
      setUpdatingCatId(null);
    }
  };

  const handleInlineAddCategory = async (productId: string) => {
    const newName = prompt('Enter new Garment Type / Category name (e.g. Lehenga, Dupatta, Lungi):');
    if (!newName || !newName.trim()) return;
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => [...prev, data.category]);
        await handleQuickCategoryUpdate(productId, data.category.id);
      }
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  // Picky Assist Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<{
    id: string;
    success: boolean;
    actionTaken?: string;
    message: string;
    diff?: any;
  } | null>(null);

  // Picky Assist Smart Sync All Modal State
  const [showSyncAllModal, setShowSyncAllModal] = useState(false);
  const [syncCandidatesLoading, setSyncCandidatesLoading] = useState(false);
  const [syncCandidateStats, setSyncCandidateStats] = useState<{ total: number; unsyncedCount: number; modifiedCount: number }>({
    total: 0,
    unsyncedCount: 0,
    modifiedCount: 0,
  });
  const [syncCandidateList, setSyncCandidateList] = useState<any[]>([]);
  const [syncFilterMode, setSyncFilterMode] = useState<'all' | 'unsynced'>('all');
  const [syncQueueActive, setSyncQueueActive] = useState(false);
  const [syncQueuePaused, setSyncQueuePaused] = useState(false);
  const [syncQueueProgress, setSyncQueueProgress] = useState({ current: 0, total: 0 });
  const [syncQueueStats, setSyncQueueStats] = useState({ updated: 0, added: 0, failed: 0 });
  const [syncLogs, setSyncLogs] = useState<Array<{ id: string; time: string; text: string; type: 'updated' | 'added' | 'failed' | 'info' }>>([]);
  const [syncAuditList, setSyncAuditList] = useState<Array<{
    id: string;
    stockCode: string;
    code1?: string;
    productName: string;
    status: 'success' | 'failed';
    actionTaken?: 'updated' | 'added' | 'deleted' | 'no_change';
    message: string;
    error?: string;
    time: string;
  }>>([]);
  const [syncModalTab, setSyncModalTab] = useState<'feed' | 'failed' | 'success'>('feed');
  const abortSyncRef = useRef(false);
  const pausedSyncRef = useRef(false);

  // Picky Assist Bulk Delete All Modal State
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteFilterMode, setDeleteFilterMode] = useState<'all' | 'syncedOnly'>('all');
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleteQueueActive, setDeleteQueueActive] = useState(false);
  const [deleteQueuePaused, setDeleteQueuePaused] = useState(false);
  const [deleteQueueProgress, setDeleteQueueProgress] = useState({ current: 0, total: 0 });
  const [deleteQueueStats, setDeleteQueueStats] = useState({ deleted: 0, failed: 0 });
  const [deleteLogs, setDeleteLogs] = useState<Array<{ id: string; time: string; text: string; type: 'deleted' | 'failed' | 'info' }>>([]);
  const [deleteAuditList, setDeleteAuditList] = useState<Array<{
    id: string;
    stockCode: string;
    code1?: string;
    productName: string;
    status: 'success' | 'failed';
    actionTaken?: 'updated' | 'added' | 'deleted' | 'no_change';
    message: string;
    error?: string;
    time: string;
  }>>([]);
  const [deleteModalTab, setDeleteModalTab] = useState<'feed' | 'failed' | 'success'>('feed');
  const abortDeleteRef = useRef(false);
  const pausedDeleteRef = useRef(false);

  const exportQueueAuditCsv = (items: any[], prefix: string) => {
    if (!items || items.length === 0) {
      alert('No audit logs to export yet.');
      return;
    }
    const headers = ['Stock Code', 'Product Code', 'Product Name', 'Status', 'Action Taken', 'Message / Error', 'Timestamp'];
    const rows = items.map((item) => [
      `"${item.stockCode || ''}"`,
      `"${item.code1 || ''}"`,
      `"${(item.productName || '').replace(/"/g, '""')}"`,
      `"${item.status}"`,
      `"${item.actionTaken || ''}"`,
      `"${(item.error || item.message || '').replace(/"/g, '""')}"`,
      `"${item.time}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${prefix}-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchSyncCandidates = async () => {
    setSyncCandidatesLoading(true);
    try {
      const res = await fetch('/api/admin/picky-assist/sync?action=candidates');
      const data = await res.json();
      if (data.success) {
        setSyncCandidateStats({
          total: data.total || 0,
          unsyncedCount: data.unsyncedCount || 0,
          modifiedCount: data.modifiedCount || 0,
        });
        setSyncCandidateList(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load sync candidates:', err);
    } finally {
      setSyncCandidatesLoading(false);
    }
  };

  const openSyncAllModal = () => {
    setShowSyncAllModal(true);
    fetchSyncCandidates();
  };

  const handleSyncProduct = async (product: Product) => {
    setSyncingId(product.id);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/admin/picky-assist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setSyncNotice({
        id: product.id,
        success: data.success,
        actionTaken: data.actionTaken,
        message: data.message || `Successfully synced ${product.stockCode} with Picky Assist`,
        diff: data.diff,
      });
      fetchProducts();
    } catch (err: any) {
      console.error('Picky Assist sync error:', err);
      setSyncNotice({
        id: product.id,
        success: false,
        message: err.message || 'Failed to sync with Picky Assist',
      });
    } finally {
      setSyncingId(null);
      setTimeout(() => {
        setSyncNotice((prev) => (prev?.id === product.id ? null : prev));
      }, 7000);
    }
  };

  const handleDeleteFromPicky = async (product: any) => {
    if (!confirm(`Are you sure you want to delete "${product.productName || product.stockCode}" from Picky Assist?\n(This removes the catalog entry from Picky Assist without deleting it from your local database)`)) {
      return;
    }
    setSyncingId(product.id);
    setSyncNotice(null);
    try {
      const res = await fetch('/api/admin/picky-assist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, action: 'delete' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setSyncNotice({
        id: product.id,
        success: data.success,
        actionTaken: 'deleted',
        message: data.message || `Deleted ${product.stockCode} from Picky Assist`,
      });
      fetchProducts();
    } catch (err: any) {
      console.error('Picky delete error:', err);
      setSyncNotice({
        id: product.id,
        success: false,
        message: err.message || 'Failed to delete from Picky Assist',
      });
    } finally {
      setSyncingId(null);
      setTimeout(() => {
        setSyncNotice((prev) => (prev?.id === product.id ? null : prev));
      }, 7000);
    }
  };

  const startSyncQueue = async (overrideItems?: any[]) => {
    let itemsToProcess = overrideItems || [...syncCandidateList];
    if (!overrideItems && syncFilterMode === 'unsynced') {
      itemsToProcess = syncCandidateList.filter(
        (p) => !p.syncedAt || (p.updatedAt && new Date(p.updatedAt).getTime() > new Date(p.syncedAt).getTime() + 1000)
      );
    }

    if (itemsToProcess.length === 0) {
      alert('No products to sync.');
      return;
    }

    abortSyncRef.current = false;
    pausedSyncRef.current = false;
    setSyncQueueActive(true);
    setSyncQueuePaused(false);
    setSyncQueueProgress({ current: 0, total: itemsToProcess.length });

    if (overrideItems) {
      setSyncAuditList((prev) => prev.filter((item) => item.status === 'success'));
      setSyncQueueStats((prev) => ({ updated: prev.updated, added: prev.added, failed: 0 }));
    } else {
      setSyncAuditList([]);
      setSyncQueueStats({ updated: 0, added: 0, failed: 0 });
    }

    setSyncLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        text: `Starting Smart Sync for ${itemsToProcess.length} products (2 concurrent workers, auto-retry on 429/503)...`,
        type: 'info',
      },
      ...prev.slice(0, 50),
    ]);

    let currentIndex = 0;
    let completedCount = 0;
    let updatedCount = overrideItems ? syncQueueStats.updated : 0;
    let addedCount = overrideItems ? syncQueueStats.added : 0;
    let failedCount = 0;

    const executeItemWithRetry = async (item: any): Promise<{ success: boolean; actionTaken?: string; message: string; error?: string }> => {
      let attempts = 0;
      const maxAttempts = 2;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          const res = await fetch('/api/admin/picky-assist/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.id, action: 'sync' }),
          });

          if (res.status === 429 || res.status === 503) {
            if (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1800));
              continue;
            }
          }

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            return {
              success: true,
              actionTaken: data.actionTaken || 'updated',
              message: data.message || `Successfully synced ${item.stockCode}`,
            };
          } else {
            return {
              success: false,
              actionTaken: 'no_change',
              message: data.message || data.error || `HTTP ${res.status}`,
              error: data.error || data.message || `HTTP ${res.status}`,
            };
          }
        } catch (err: any) {
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          return {
            success: false,
            actionTaken: 'no_change',
            message: err.message || 'Network error',
            error: err.message || 'Network error',
          };
        }
      }
      return { success: false, actionTaken: 'no_change', message: 'Unknown error', error: 'Unknown error' };
    };

    const worker = async () => {
      while (currentIndex < itemsToProcess.length && !abortSyncRef.current) {
        while (pausedSyncRef.current && !abortSyncRef.current) {
          await new Promise((r) => setTimeout(r, 300));
        }
        if (abortSyncRef.current) break;

        const idx = currentIndex++;
        if (idx >= itemsToProcess.length) break;

        const item = itemsToProcess[idx];
        const code = item.code1 || item.stockCode;
        const result = await executeItemWithRetry(item);

        completedCount++;
        const auditEntry = {
          id: item.id,
          stockCode: item.stockCode,
          code1: item.code1,
          productName: item.productName || item.title || item.stockCode,
          status: result.success ? ('success' as const) : ('failed' as const),
          actionTaken: (result.actionTaken as any) || 'no_change',
          message: result.message,
          error: result.error,
          time: new Date().toLocaleTimeString(),
        };

        setSyncAuditList((prev) => [auditEntry, ...prev.filter((p) => p.id !== item.id)]);

        if (result.success) {
          if (result.actionTaken === 'updated') {
            updatedCount++;
            setSyncLogs((prev) => [
              {
                id: `log_${Date.now()}_${idx}`,
                time: new Date().toLocaleTimeString(),
                text: `✅ [UPDATED] ${code}: Found in Picky Assist ➔ Updated details`,
                type: 'updated',
              },
              ...prev.slice(0, 99),
            ]);
          } else {
            addedCount++;
            setSyncLogs((prev) => [
              {
                id: `log_${Date.now()}_${idx}`,
                time: new Date().toLocaleTimeString(),
                text: `➕ [CREATED] ${code}: Not in Picky Assist ➔ Added as new product`,
                type: 'added',
              },
              ...prev.slice(0, 99),
            ]);
          }
        } else {
          failedCount++;
          setSyncLogs((prev) => [
            {
              id: `log_${Date.now()}_${idx}`,
              time: new Date().toLocaleTimeString(),
              text: `⚠️ [FAILED] ${code}: ${result.error || result.message}`,
              type: 'failed',
            },
            ...prev.slice(0, 99),
          ]);
        }

        setSyncQueueProgress({ current: completedCount, total: itemsToProcess.length });
        setSyncQueueStats({ updated: updatedCount, added: addedCount, failed: failedCount });

        // Polite pacing delay
        await new Promise((r) => setTimeout(r, 250));
      }
    };

    const concurrency = Math.min(2, itemsToProcess.length);
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    if (abortSyncRef.current) {
      setSyncLogs((prev) => [
        {
          id: `log_${Date.now()}_abort`,
          time: new Date().toLocaleTimeString(),
          text: '🛑 Sync was stopped by user.',
          type: 'info',
        },
        ...prev,
      ]);
    } else {
      setSyncLogs((prev) => [
        {
          id: `log_${Date.now()}_complete`,
          time: new Date().toLocaleTimeString(),
          text: `🎉 Smart Sync complete! ${updatedCount} updated, ${addedCount} created, ${failedCount} failed.`,
          type: 'info',
        },
        ...prev,
      ]);
    }

    setSyncQueueActive(false);
    fetchProducts();
    fetchSyncCandidates();
  };

  const togglePauseSync = () => {
    pausedSyncRef.current = !pausedSyncRef.current;
    setSyncQueuePaused(pausedSyncRef.current);
    setSyncLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        text: pausedSyncRef.current ? '⏸️ Sync queue paused.' : '▶️ Sync queue resumed.',
        type: 'info',
      },
      ...prev,
    ]);
  };

  const stopSyncQueue = () => {
    abortSyncRef.current = true;
    pausedSyncRef.current = false;
    setSyncQueuePaused(false);
  };

  const openDeleteAllModal = () => {
    setShowDeleteAllModal(true);
    setDeleteConfirmChecked(false);
    fetchSyncCandidates();
  };

  const startDeleteQueue = async (overrideItems?: any[]) => {
    if (!deleteConfirmChecked && !overrideItems) {
      alert('Please check the confirmation box to proceed.');
      return;
    }

    let itemsToProcess = overrideItems || [...syncCandidateList];
    if (!overrideItems && deleteFilterMode === 'syncedOnly') {
      itemsToProcess = syncCandidateList.filter((p) => p.syncedAt);
    }

    if (itemsToProcess.length === 0) {
      alert('No products match the selected delete filter.');
      return;
    }

    abortDeleteRef.current = false;
    pausedDeleteRef.current = false;
    setDeleteQueueActive(true);
    setDeleteQueuePaused(false);
    setDeleteQueueProgress({ current: 0, total: itemsToProcess.length });

    if (overrideItems) {
      setDeleteAuditList((prev) => prev.filter((item) => item.status === 'success'));
      setDeleteQueueStats((prev) => ({ deleted: prev.deleted, failed: 0 }));
    } else {
      setDeleteAuditList([]);
      setDeleteQueueStats({ deleted: 0, failed: 0 });
    }

    setDeleteLogs((prev) => [
      {
        id: `del_log_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        text: `Starting Bulk Delete for ${itemsToProcess.length} products from Picky Assist (2 workers, preserving local database)...`,
        type: 'info',
      },
      ...prev.slice(0, 50),
    ]);

    let currentIndex = 0;
    let completedCount = 0;
    let deletedCount = overrideItems ? deleteQueueStats.deleted : 0;
    let failedCount = 0;

    const executeItemWithRetry = async (item: any): Promise<{ success: boolean; message: string; error?: string }> => {
      let attempts = 0;
      const maxAttempts = 2;
      while (attempts < maxAttempts) {
        attempts++;
        try {
          const res = await fetch('/api/admin/picky-assist/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.id, action: 'delete' }),
          });

          if (res.status === 429 || res.status === 503) {
            if (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 1800));
              continue;
            }
          }

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.success) {
            return {
              success: true,
              message: data.message || `Deleted ${item.stockCode} from Picky Assist`,
            };
          } else {
            return {
              success: false,
              message: data.message || data.error || `HTTP ${res.status}`,
              error: data.error || data.message || `HTTP ${res.status}`,
            };
          }
        } catch (err: any) {
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          return {
            success: false,
            message: err.message || 'Network error',
            error: err.message || 'Network error',
          };
        }
      }
      return { success: false, message: 'Unknown error', error: 'Unknown error' };
    };

    const worker = async () => {
      while (currentIndex < itemsToProcess.length && !abortDeleteRef.current) {
        while (pausedDeleteRef.current && !abortDeleteRef.current) {
          await new Promise((r) => setTimeout(r, 300));
        }
        if (abortDeleteRef.current) break;

        const idx = currentIndex++;
        if (idx >= itemsToProcess.length) break;

        const item = itemsToProcess[idx];
        const code = item.code1 || item.stockCode;
        const result = await executeItemWithRetry(item);

        completedCount++;
        const auditEntry = {
          id: item.id,
          stockCode: item.stockCode,
          code1: item.code1,
          productName: item.productName || item.title || item.stockCode,
          status: result.success ? ('success' as const) : ('failed' as const),
          actionTaken: result.success ? ('deleted' as const) : ('no_change' as const),
          message: result.message,
          error: result.error,
          time: new Date().toLocaleTimeString(),
        };

        setDeleteAuditList((prev) => [auditEntry, ...prev.filter((p) => p.id !== item.id)]);

        if (result.success) {
          deletedCount++;
          setDeleteLogs((prev) => [
            {
              id: `del_log_${Date.now()}_${idx}`,
              time: new Date().toLocaleTimeString(),
              text: `🗑️ [DELETED] ${code}: Successfully removed from Picky Assist`,
              type: 'deleted',
            },
            ...prev.slice(0, 99),
          ]);
        } else {
          failedCount++;
          setDeleteLogs((prev) => [
            {
              id: `del_log_${Date.now()}_${idx}`,
              time: new Date().toLocaleTimeString(),
              text: `⚠️ [FAILED] ${code}: ${result.error || result.message}`,
              type: 'failed',
            },
            ...prev.slice(0, 99),
          ]);
        }

        setDeleteQueueProgress({ current: completedCount, total: itemsToProcess.length });
        setDeleteQueueStats({ deleted: deletedCount, failed: failedCount });

        await new Promise((r) => setTimeout(r, 200));
      }
    };

    const concurrency = Math.min(2, itemsToProcess.length);
    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    if (abortDeleteRef.current) {
      setDeleteLogs((prev) => [
        {
          id: `del_log_${Date.now()}_abort`,
          time: new Date().toLocaleTimeString(),
          text: '🛑 Bulk delete was stopped by user.',
          type: 'info',
        },
        ...prev,
      ]);
    } else {
      setDeleteLogs((prev) => [
        {
          id: `del_log_${Date.now()}_complete`,
          time: new Date().toLocaleTimeString(),
          text: `🎉 Bulk delete complete! ${deletedCount} removed from Picky Assist, ${failedCount} failed.`,
          type: 'info',
        },
        ...prev,
      ]);
    }

    setDeleteQueueActive(false);
    fetchProducts();
    fetchSyncCandidates();
  };

  const togglePauseDelete = () => {
    pausedDeleteRef.current = !pausedDeleteRef.current;
    setDeleteQueuePaused(pausedDeleteRef.current);
    setDeleteLogs((prev) => [
      {
        id: `del_log_${Date.now()}`,
        time: new Date().toLocaleTimeString(),
        text: pausedDeleteRef.current ? '⏸️ Delete queue paused.' : '▶️ Delete queue resumed.',
        type: 'info',
      },
      ...prev,
    ]);
  };

  const stopDeleteQueue = () => {
    abortDeleteRef.current = true;
    pausedDeleteRef.current = false;
    setDeleteQueuePaused(false);
  };

  const [customDeleteCode, setCustomDeleteCode] = useState('');
  const [customDeleteLoading, setCustomDeleteLoading] = useState(false);

  const handleCustomCodeDelete = async () => {
    const code = customDeleteCode.trim();
    if (!code) return;
    setCustomDeleteLoading(true);
    try {
      const res = await fetch('/api/admin/picky-assist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCode: code, action: 'delete' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteLogs((prev) => [
          {
            id: `del_log_custom_${Date.now()}`,
            time: new Date().toLocaleTimeString(),
            text: `🗑️ [MANUAL DELETE] ${code}: Successfully sent delete command to Picky Assist!`,
            type: 'deleted',
          },
          ...prev,
        ]);
        setCustomDeleteCode('');
        fetchProducts();
      } else {
        alert(data.message || data.error || 'Failed to delete SKU from Picky Assist');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setCustomDeleteLoading(false);
    }
  };

  const stats = globalStats ?? {
    total,
    inStock: 0,
    outOfStock: 0,
    lowStock: 0,
    categorized: 0,
    uncategorized: uncategorizedCount ?? 0,
    synced: 0,
    modified: 0,
    unsynced: 0,
  };

  const selectedCategory = categories.find((c) => c.id === categoryId) || null;
  const advancedFilterCount = [missingImage, missingPrice, missingAi, clothTypeFilter, colorFilter].filter(Boolean).length;
  const hasAnyFilter = Boolean(
    search || categorizedFilter || categoryId || subCategoryId || statusFilter || syncFilter || advancedFilterCount > 0
  );

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
          {/* Sync All with Picky Assist (Opens Smart Sync Queue Modal) */}
          <button
            type="button"
            onClick={openSyncAllModal}
            title="Sync products with Picky Assist (searches Picky first to prevent duplicates)"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-500 transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <span>Sync All to Picky</span>
          </button>
          {/* Delete All from Picky Assist (Opens Bulk Delete Queue Modal) */}
          <button
            type="button"
            onClick={openDeleteAllModal}
            title="Delete all products from Picky Assist catalog (does NOT delete products from your database)"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-800 hover:bg-rose-100 hover:border-rose-500 transition-all cursor-pointer shadow-xs"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Delete All in Picky</span>
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

      {/* Fetch / Auth Error Banner */}
      {fetchError && (
        <div className="p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-medium border bg-amber-50 border-amber-200 text-amber-900 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Database / Session Notice</p>
              <p className="text-xs text-amber-800">
                {fetchError.includes('401') || fetchError.toLowerCase().includes('unauthorized')
                  ? 'Your login session expired. Please sign out and sign in again with your Google account.'
                  : fetchError}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchProducts()}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Stats (Global DB Counts — Clickable Quick Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Products',
            value: stats.total,
            color: 'text-charcoal',
            activeBorder: 'border-charcoal/40 ring-2 ring-charcoal/10',
            icon: Package,
            active: !statusFilter,
            onClick: () => { setStatusFilter(''); setPage(1); },
          },
          {
            label: 'In Stock',
            value: stats.inStock,
            color: 'text-emerald-600',
            activeBorder: 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/30',
            icon: CheckCircle2,
            active: statusFilter === 'ACTIVE',
            onClick: () => { setStatusFilter(statusFilter === 'ACTIVE' ? '' : 'ACTIVE'); setPage(1); },
          },
          {
            label: 'Out of Stock',
            value: stats.outOfStock,
            color: 'text-red-600',
            activeBorder: 'border-red-400 ring-2 ring-red-500/20 bg-red-50/30',
            icon: XCircle,
            active: statusFilter === 'OUT_OF_STOCK',
            onClick: () => { setStatusFilter(statusFilter === 'OUT_OF_STOCK' ? '' : 'OUT_OF_STOCK'); setPage(1); },
          },
          {
            label: 'Low Stock (≤3)',
            value: stats.lowStock,
            color: 'text-amber-600',
            activeBorder: 'border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/30',
            icon: AlertCircle,
            active: statusFilter === 'LOW_STOCK',
            onClick: () => { setStatusFilter(statusFilter === 'LOW_STOCK' ? '' : 'LOW_STOCK'); setPage(1); },
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              onClick={s.onClick}
              className={`text-left rounded-2xl border bg-white p-5 transition-all cursor-pointer hover:shadow-sm ${
                s.active && s.label !== 'Total Products' ? s.activeBorder : 'border-cream-border hover:border-charcoal/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`font-display text-3xl font-extrabold mt-2 ${s.color}`}>
                {loading && !globalStats ? '—' : s.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Catalog Health & Picky Sync Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white border border-cream-border">
        {/* Categorization Breakdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mr-1">
            Categorization:
          </span>
          <button
            type="button"
            onClick={() => { setCategorizedFilter(''); setCategoryId(''); setSubCategoryId(''); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !categorizedFilter && !categoryId
                ? 'bg-charcoal text-white'
                : 'bg-cream-light text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategorizedFilter(categorizedFilter === 'true' ? '' : 'true');
              setCategoryId('');
              setSubCategoryId('');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categorizedFilter === 'true'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Categorized ({stats.categorized})
          </button>
          <button
            type="button"
            onClick={() => {
              setCategorizedFilter(categorizedFilter === 'false' ? '' : 'false');
              setCategoryId('');
              setSubCategoryId('');
              setPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              categorizedFilter === 'false'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Uncategorized ({stats.uncategorized})
          </button>
        </div>

        {/* Picky Assist Sync Breakdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mr-1">
            Picky Sync:
          </span>
          <button
            type="button"
            onClick={() => { setSyncFilter(''); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !syncFilter
                ? 'bg-charcoal text-white'
                : 'bg-cream-light text-charcoal-muted hover:text-charcoal'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setSyncFilter(syncFilter === 'synced' ? '' : 'synced'); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              syncFilter === 'synced'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Synced ({stats.synced})
          </button>
          <button
            type="button"
            onClick={() => { setSyncFilter(syncFilter === 'modified' ? '' : 'modified'); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              syncFilter === 'modified'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            Needs Re-sync ({stats.modified})
          </button>
          <button
            type="button"
            onClick={() => { setSyncFilter(syncFilter === 'unsynced' ? '' : 'unsynced'); setPage(1); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              syncFilter === 'unsynced'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            Not Synced ({stats.unsynced})
          </button>
        </div>
      </div>

      {/* Primary Search + Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-muted" />
            <input
              suppressHydrationWarning
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="Search code, title, tag, colour..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-muted hover:text-charcoal cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Garment Type (Category) */}
          <select
            value={categoryId}
            onChange={e => {
              const val = e.target.value;
              setCategoryId(val);
              setSubCategoryId('');
              if (val) setCategorizedFilter('');
              setPage(1);
            }}
            className={`px-3 py-2.5 rounded-xl border text-sm cursor-pointer transition-colors focus:outline-none focus:border-accent ${
              categoryId
                ? 'border-accent bg-accent-bg/30 text-charcoal font-semibold'
                : 'border-cream-border bg-white text-charcoal'
            }`}
          >
            <option value="">All Garment Types</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{typeof c._count?.products === 'number' ? ` (${c._count.products})` : ''}
              </option>
            ))}
          </select>

          {/* Dynamic Sub-Category (only when selected category has subCategories) */}
          {selectedCategory && selectedCategory.subCategories.length > 0 && (
            <select
              value={subCategoryId}
              onChange={e => { setSubCategoryId(e.target.value); setPage(1); }}
              className="px-3 py-2.5 rounded-xl border border-accent/40 bg-white text-sm text-charcoal focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">All Sub-Categories</option>
              {selectedCategory.subCategories.map(sc => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          )}

          {/* Stock & Status */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className={`px-3 py-2.5 rounded-xl border text-sm cursor-pointer focus:outline-none focus:border-accent ${
              statusFilter
                ? 'border-accent bg-accent-bg/30 text-charcoal font-semibold'
                : 'border-cream-border bg-white text-charcoal'
            }`}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">In Stock</option>
            <option value="LOW_STOCK">Low Stock (≤3)</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Sort */}
          <div className="relative inline-flex items-center">
            <ArrowUpDown className="w-3.5 h-3.5 text-charcoal-muted absolute left-3 pointer-events-none" />
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-2.5 rounded-xl border border-cream-border bg-white text-sm text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              title="Sort products"
            >
              <option value="newest">Newest Added</option>
              <option value="updated">Recently Updated</option>
              <option value="qty_asc">Qty: Low → High</option>
              <option value="qty_desc">Qty: High → Low</option>
              <option value="price_asc">Price: Low → High</option>
              <option value="price_desc">Price: High → Low</option>
              <option value="code_asc">Stock Code (A–Z)</option>
            </select>
          </div>

          {/* More Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
              showMoreFilters || advancedFilterCount > 0
                ? 'border-accent bg-accent-bg text-accent'
                : 'border-cream-border bg-white text-charcoal hover:border-accent/40'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>More Filters</span>
            {advancedFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-accent text-white text-[10px] font-bold">
                {advancedFilterCount}
              </span>
            )}
          </button>

          {hasAnyFilter && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}

          <button
            onClick={fetchProducts}
            className="p-2.5 rounded-xl border border-cream-border bg-white text-charcoal-muted hover:text-charcoal hover:border-accent/40 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Collapsible Advanced / Catalog-Audit Filters */}
        {showMoreFilters && (
          <div className="p-4 rounded-2xl bg-white border border-cream-border grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-in">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">
                Product Image
              </label>
              <select
                value={missingImage}
                onChange={e => { setMissingImage(e.target.value as any); setPage(1); }}
                className="w-full px-2.5 py-2 rounded-lg border border-cream-border bg-cream-light/40 text-xs text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All</option>
                <option value="true">Missing Image</option>
                <option value="false">Has Image</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">
                Pricing
              </label>
              <select
                value={missingPrice}
                onChange={e => { setMissingPrice(e.target.value as any); setPage(1); }}
                className="w-full px-2.5 py-2 rounded-lg border border-cream-border bg-cream-light/40 text-xs text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All</option>
                <option value="true">Missing Price</option>
                <option value="false">Has Price</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">
                AI Images
              </label>
              <select
                value={missingAi}
                onChange={e => { setMissingAi(e.target.value as any); setPage(1); }}
                className="w-full px-2.5 py-2 rounded-lg border border-cream-border bg-cream-light/40 text-xs text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All</option>
                <option value="true">Pending AI</option>
                <option value="false">Has AI Images</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">
                Cloth Type
              </label>
              <select
                value={clothTypeFilter}
                onChange={e => { setClothTypeFilter(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 rounded-lg border border-cream-border bg-cream-light/40 text-xs text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All Fabrics</option>
                {facets.clothTypes.map(ct => (
                  <option key={ct} value={ct}>{ct}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-charcoal-muted mb-1">
                Color
              </label>
              <select
                value={colorFilter}
                onChange={e => { setColorFilter(e.target.value); setPage(1); }}
                className="w-full px-2.5 py-2 rounded-lg border border-cream-border bg-cream-light/40 text-xs text-charcoal focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">All Colors</option>
                {facets.colors.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          </div>
        )}
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
                {hasAnyFilter
                  ? 'Try adjusting or resetting your filters'
                  : 'Add your first product to get started'}
              </p>
            </div>
            {hasAnyFilter ? (
              <Button variant="secondary" size="md" className="mt-2" onClick={resetAllFilters}>
                <X className="w-4 h-4" /> Reset Filters
              </Button>
            ) : (
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
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted whitespace-nowrap">Product</th>
                  <th className="text-left px-3 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted whitespace-nowrap">Stock Code</th>
                  <th className="text-left px-3 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Garment Type</th>
                  <th className="text-left px-3 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Price</th>
                  <th className="text-center px-2 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Qty</th>
                  <th className="text-center px-2 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Status</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">Actions</th>
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
                              {product.length_Size && product.length_Size !== '-' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium" title={product.sizeInventory ? JSON.stringify(product.sizeInventory) : product.length_Size}>
                                  Sizes: {product.length_Size}
                                </span>
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
                        {/* Picky Assist Sync Status Badge */}
                        <div className="mt-1 flex items-center">
                          {product.syncedAt ? (
                            new Date(product.updatedAt).getTime() > new Date(product.syncedAt).getTime() + 1000 ? (
                              <span
                                title={`Modified locally (${new Date(product.updatedAt).toLocaleDateString()}) - Picky Assist needs update`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Picky: Modified
                              </span>
                            ) : (
                              <span
                                title={`Synced to Picky Assist on ${new Date(product.syncedAt).toLocaleString()}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Picky: Synced
                              </span>
                            )
                          ) : (
                            <span
                              title="Never synced to Picky Assist"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Picky: Not Synced
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category / Garment Type Quick Selector */}
                      <td className="px-3 py-4">
                        <div className="relative inline-flex items-center">
                          <select
                            value={product.category?.id || ''}
                            disabled={updatingCatId === product.id}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__new__') {
                                handleInlineAddCategory(product.id);
                              } else {
                                handleQuickCategoryUpdate(product.id, val);
                              }
                            }}
                            className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                              updatingCatId === product.id
                                ? 'opacity-50 pointer-events-none'
                                : product.category
                                ? 'bg-amber-50/80 border-amber-300 text-amber-950 hover:bg-amber-100 font-bold'
                                : 'bg-white border-dashed border-amber-400 text-amber-800 hover:border-amber-600 hover:bg-amber-50/50'
                            }`}
                          >
                            <option value="" disabled className="text-gray-400">
                              ⚠️ Select Type...
                            </option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id} className="text-charcoal font-semibold">
                                {c.name}
                              </option>
                            ))}
                            <option value="__new__" className="text-accent font-bold">
                              + Add New Type...
                            </option>
                          </select>
                          {updatingCatId === product.id && (
                            <RefreshCw className="w-3 h-3 animate-spin text-accent ml-1.5 shrink-0" />
                          )}
                        </div>
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
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center justify-center">
                          <span
                            className={`w-3 h-3 rounded-full transition-transform hover:scale-125 inline-block ${
                              product.status === 'ACTIVE'
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ring-2 ring-emerald-200'
                                : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] ring-2 ring-red-200'
                            }`}
                            title={`${statusCfg.label}${isLowStock ? ' (Low stock)' : ''}`}
                          />
                        </div>
                        {isLowStock && (
                          <p className="text-[9px] text-amber-600 font-semibold mt-0.5 whitespace-nowrap">Low</p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                          {/* Picky Assist Sync Button */}
                          <button
                            type="button"
                            onClick={() => handleSyncProduct(product)}
                            disabled={syncingId === product.id}
                            title="Sync with Picky Assist (Searches webhook, adds if new, updates diff if changed)"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
                              syncingId === product.id
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : syncNotice?.id === product.id && syncNotice.success && syncNotice.actionTaken !== 'deleted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : syncNotice?.id === product.id && !syncNotice.success
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-white text-charcoal border-cream-border hover:border-emerald-600 hover:text-emerald-700'
                            }`}
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === product.id ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
                            <span>{syncingId === product.id ? 'Syncing...' : 'Sync'}</span>
                          </button>

                          {/* Delete from Picky Assist Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFromPicky(product)}
                            disabled={syncingId === product.id}
                            title="Delete this product from Picky Assist catalog"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-charcoal border border-cream-border hover:border-red-400 hover:text-red-600 transition-all cursor-pointer bg-white"
                          >
                            <Trash className="w-3 h-3 text-red-500" />
                          </button>

                          <Link href={`/admin/generate?productId=${product.id}`}>
                            <button
                              title="Generate AI"
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white border border-transparent bg-accent hover:bg-accent/90 transition-all cursor-pointer shadow-sm"
                            >
                              AI
                            </button>
                          </Link>
                          <Link href={`/admin/inventory/${product.id}`}>
                            <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-charcoal border border-cream-border hover:border-accent hover:text-accent transition-all cursor-pointer bg-white">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          </Link>
                        </div>
                        {syncNotice?.id === product.id && (
                          <div className={`mt-1.5 text-[11px] font-medium text-left px-2 py-1 rounded-lg border flex items-start gap-1 max-w-[290px] ml-auto animate-fade-in ${
                            syncNotice.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {syncNotice.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />}
                            <div className="min-w-0">
                              {syncNotice.actionTaken && (
                                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded uppercase mr-1 ${
                                  syncNotice.actionTaken === 'updated'
                                    ? 'bg-emerald-600 text-white'
                                    : syncNotice.actionTaken === 'deleted'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}>
                                  {syncNotice.actionTaken === 'updated' ? 'Updated Existing' : syncNotice.actionTaken === 'deleted' ? 'Deleted Picky' : 'Added New'}
                                </span>
                              )}
                              <span className="truncate block" title={syncNotice.message}>{syncNotice.message}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="px-5 py-4 border-t border-cream-border flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <p className="text-charcoal-muted text-xs">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} products
              </p>
              <select
                value={limit}
                onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 rounded-lg border border-cream-border bg-white text-xs text-charcoal cursor-pointer"
                title="Rows per page"
              >
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            {total > limit && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-charcoal-muted mr-1">
                  Page {page} of {Math.max(1, Math.ceil(total / limit))}
                </span>
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
            )}
          </div>
        )}
      </Card>

      {/* ── PICKY ASSIST SMART SYNC ALL QUEUE MODAL ── */}
      {mounted && showSyncAllModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-cream-border max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-900 via-slate-900 to-charcoal text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                  <RefreshCw className={`w-5 h-5 text-emerald-400 ${syncQueueActive && !syncQueuePaused ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base flex items-center gap-2">
                    Picky Assist Smart Sync
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SEARCH-BEFORE-CREATE
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    Checks Picky Assist catalog first: updates existing products, creates only new ones.
                  </p>
                </div>
              </div>
              {!syncQueueActive && (
                <button
                  type="button"
                  onClick={() => setShowSyncAllModal(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Filter Selector (When not running) */}
              {!syncQueueActive && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Select Products to Sync
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSyncFilterMode('all')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        syncFilterMode === 'all'
                          ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                          : 'border-cream-border bg-white hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-charcoal flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-emerald-600" /> All Products
                        </span>
                        <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          {syncCandidateStats.total}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-muted">
                        Full catalog audit. Checks every product and size variant in Picky Assist.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncFilterMode('unsynced')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        syncFilterMode === 'unsynced'
                          ? 'border-accent bg-accent-bg/40 ring-2 ring-accent/20'
                          : 'border-cream-border bg-white hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-charcoal flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-accent" /> Unsynced & Modified
                        </span>
                        <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {syncCandidateStats.unsyncedCount + syncCandidateStats.modifiedCount}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-muted">
                        Only syncs new arrivals ({syncCandidateStats.unsyncedCount}) or edited stock ({syncCandidateStats.modifiedCount}).
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Progress Bar & Counters */}
              {(syncQueueActive || syncQueueProgress.current > 0) && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-charcoal flex items-center gap-1.5">
                      {syncQueueActive ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          <span>Sync in progress...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sync complete!</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono font-bold text-charcoal">
                      {syncQueueProgress.current} / {syncQueueProgress.total} ({syncQueueProgress.total > 0 ? Math.round((syncQueueProgress.current / syncQueueProgress.total) * 100) : 0}%)
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${syncQueueProgress.total > 0 ? (syncQueueProgress.current / syncQueueProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Stat Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-300">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Updated Existing</span>
                      <span className="text-sm font-bold text-emerald-950 font-mono">{syncQueueStats.updated}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-100/70 border border-blue-300">
                      <span className="text-[10px] uppercase font-bold text-blue-800 block">Created New</span>
                      <span className="text-sm font-bold text-blue-950 font-mono">{syncQueueStats.added}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-red-100/70 border border-red-300">
                      <span className="text-[10px] uppercase font-bold text-red-800 block">Failed</span>
                      <span className="text-sm font-bold text-red-950 font-mono">{syncQueueStats.failed}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal View Tabs */}
              {(syncQueueActive || syncQueueProgress.current > 0 || syncLogs.length > 0) && (
                <div className="flex items-center gap-1.5 border-b border-cream-border pb-2.5">
                  <button
                    type="button"
                    onClick={() => setSyncModalTab('feed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      syncModalTab === 'feed'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-charcoal-muted hover:text-charcoal hover:bg-cream-light'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Live Feed</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                      {syncLogs.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncModalTab('success')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      syncModalTab === 'success'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-charcoal-muted hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Successful</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                      {syncAuditList.filter((a) => a.status === 'success').length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncModalTab('failed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      syncModalTab === 'failed'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : syncAuditList.some((a) => a.status === 'failed')
                        ? 'text-rose-700 bg-rose-50 border border-rose-200'
                        : 'text-charcoal-muted hover:text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                    {syncAuditList.filter((a) => a.status === 'failed').length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-200 text-rose-950 font-bold">
                        {syncAuditList.filter((a) => a.status === 'failed').length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Tab 1: Monospace Terminal Live Feed */}
              {syncModalTab === 'feed' && syncLogs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-charcoal-muted">
                    <span className="font-bold uppercase tracking-wider">Live Activity Feed</span>
                    <span>{syncLogs.length} events logged</span>
                  </div>
                  <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-xl border border-slate-800 h-48 overflow-y-auto space-y-1.5 select-text shadow-inner">
                    {syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`leading-relaxed flex items-start gap-2 ${
                          log.type === 'updated'
                            ? 'text-emerald-400'
                            : log.type === 'added'
                            ? 'text-blue-400'
                            : log.type === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-300'
                        }`}
                      >
                        <span className="text-slate-500 text-[10px] shrink-0">[{log.time}]</span>
                        <span className="flex-1 break-words">{log.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Successful Audit List */}
              {syncModalTab === 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-charcoal-muted">
                    <span className="font-bold uppercase tracking-wider">Successfully Synced Products</span>
                    <span>{syncAuditList.filter((a) => a.status === 'success').length} products</span>
                  </div>
                  <div className="border border-cream-border rounded-xl h-52 overflow-y-auto divide-y divide-cream-border bg-white">
                    {syncAuditList.filter((a) => a.status === 'success').length === 0 ? (
                      <div className="p-6 text-center text-xs text-charcoal-muted">
                        No successful syncs recorded yet in this session.
                      </div>
                    ) : (
                      syncAuditList
                        .filter((a) => a.status === 'success')
                        .map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-emerald-50/40">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-charcoal">{item.stockCode}</span>
                                {item.code1 && (
                                  <span className="text-[10px] font-mono text-charcoal-muted">({item.code1})</span>
                                )}
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                    item.actionTaken === 'updated'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {item.actionTaken || 'SYNCED'}
                                </span>
                              </div>
                              <p className="text-[11px] text-charcoal-muted truncate mt-0.5">{item.productName}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">{item.time}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Failed Audit List with 1-Click Retry */}
              {syncModalTab === 'failed' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                      Failed Products ({syncAuditList.filter((a) => a.status === 'failed').length})
                    </span>
                    {syncAuditList.filter((a) => a.status === 'failed').length > 0 && !syncQueueActive && (
                      <button
                        type="button"
                        onClick={() => {
                          const failedIds = new Set(syncAuditList.filter((a) => a.status === 'failed').map((a) => a.id));
                          const failedItems = syncCandidateList.filter((p) => failedIds.has(p.id));
                          startSyncQueue(failedItems);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Failed Items ({syncAuditList.filter((a) => a.status === 'failed').length})</span>
                      </button>
                    )}
                  </div>

                  <div className="border border-rose-200 rounded-xl h-52 overflow-y-auto divide-y divide-rose-100 bg-rose-50/20">
                    {syncAuditList.filter((a) => a.status === 'failed').length === 0 ? (
                      <div className="p-8 text-center text-xs text-charcoal-muted flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                        <p className="font-bold text-charcoal">Zero Failed Items!</p>
                        <p className="text-[11px] text-charcoal-muted mt-0.5">All products processed without errors.</p>
                      </div>
                    ) : (
                      syncAuditList
                        .filter((a) => a.status === 'failed')
                        .map((item) => (
                          <div key={item.id} className="p-3 text-xs space-y-1 hover:bg-rose-50/60">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-rose-950">{item.stockCode}</span>
                              <span className="text-[10px] text-rose-600 font-mono">{item.time}</span>
                            </div>
                            <p className="text-[11px] text-charcoal truncate">{item.productName}</p>
                            <p className="text-[11px] text-rose-700 bg-rose-100/70 p-1.5 rounded font-mono break-words">
                              {item.error || item.message || 'Unknown sync error'}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-cream-light/60 border-t border-cream-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {syncCandidatesLoading ? (
                  <span className="text-xs text-charcoal-muted flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Counting candidates...
                  </span>
                ) : syncAuditList.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => exportQueueAuditCsv(syncAuditList, 'picky-assist-sync')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-charcoal border border-cream-border bg-white hover:bg-cream-light transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                    title="Export CSV proof of all synced, updated, or failed items"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export Audit CSV</span>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {!syncQueueActive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSyncAllModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal border border-cream-border bg-white hover:bg-cream-light transition-all cursor-pointer shadow-2xs"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => startSyncQueue()}
                      disabled={syncCandidatesLoading || syncCandidateStats.total === 0}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Smart Sync</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={togglePauseSync}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      {syncQueuePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{syncQueuePaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopSyncQueue}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Sync</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── PICKY ASSIST BULK DELETE ALL QUEUE MODAL ── */}
      {mounted && showDeleteAllModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-cream-border max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-rose-950 via-slate-900 to-charcoal text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center">
                  <Trash2 className={`w-5 h-5 text-rose-400 ${deleteQueueActive && !deleteQueuePaused ? 'animate-bounce' : ''}`} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base flex items-center gap-2">
                    Delete All from Picky Assist
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      REMOTE CATALOG CLEANUP
                    </span>
                  </h3>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    Deletes products & size variants from Picky Assist. Your local database products remain 100% untouched.
                  </p>
                </div>
              </div>
              {!deleteQueueActive && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Safety Banner */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Safe Remote Deletion Notice</p>
                  <p className="text-amber-800 leading-relaxed">
                    This queue sends delete commands directly to your Picky Assist connector webhook for each product (and all associated size variants). It will <strong>NOT delete or alter any products in your store database</strong>.
                  </p>
                </div>
              </div>

              {/* Filter Selector (When not running) */}
              {!deleteQueueActive && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-charcoal uppercase tracking-wider">
                    Select Products to Delete from Picky Assist
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDeleteFilterMode('all')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        deleteFilterMode === 'all'
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-cream-border bg-white hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-charcoal flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-rose-600" /> All Products
                        </span>
                        <span className="text-xs font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                          {syncCandidateStats.total}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-muted">
                        Purge entire catalog. Deletes every product and size variant in Picky Assist.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteFilterMode('syncedOnly')}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        deleteFilterMode === 'syncedOnly'
                          ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20'
                          : 'border-cream-border bg-white hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-charcoal flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-rose-600" /> Only Synced Items
                        </span>
                        <span className="text-xs font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {Math.max(0, syncCandidateStats.total - syncCandidateStats.unsyncedCount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-muted">
                        Only removes products with an active Picky Assist sync history timestamp.
                      </p>
                    </button>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/40 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deleteConfirmChecked}
                        onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-rose-950 font-medium leading-relaxed">
                        I confirm I want to delete products from Picky Assist. I understand my local database products will NOT be deleted.
                      </span>
                    </label>
                  </div>

                  {/* Direct Orphaned SKU / Custom Code Purge Box */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-charcoal uppercase tracking-wider block">
                        Delete Specific Orphaned SKU or Custom Code
                      </span>
                      <span className="text-[10px] text-charcoal-muted">
                        Useful for clearing duplicate or deleted items
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. K001, saree-01-m, or custom code..."
                        value={customDeleteCode}
                        onChange={(e) => setCustomDeleteCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCustomCodeDelete(); }}
                        className="flex-1 px-3 py-1.5 text-xs border border-cream-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleCustomCodeDelete}
                        disabled={!customDeleteCode.trim() || customDeleteLoading}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{customDeleteLoading ? 'Deleting...' : 'Delete SKU'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Bar & Counters */}
              {(deleteQueueActive || deleteQueueProgress.current > 0) && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-charcoal flex items-center gap-1.5">
                      {deleteQueueActive ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          <span>Bulk deletion in progress...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Bulk deletion complete!</span>
                        </>
                      )}
                    </span>
                    <span className="font-mono font-bold text-charcoal">
                      {deleteQueueProgress.current} / {deleteQueueProgress.total} ({deleteQueueProgress.total > 0 ? Math.round((deleteQueueProgress.current / deleteQueueProgress.total) * 100) : 0}%)
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${deleteQueueProgress.total > 0 ? (deleteQueueProgress.current / deleteQueueProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  {/* Stat Chips */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-rose-100/70 border border-rose-300">
                      <span className="text-[10px] uppercase font-bold text-rose-800 block">Deleted from Picky</span>
                      <span className="text-sm font-bold text-rose-950 font-mono">{deleteQueueStats.deleted}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100/70 border border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-slate-800 block">Failed / Skipped</span>
                      <span className="text-sm font-bold text-slate-950 font-mono">{deleteQueueStats.failed}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal View Tabs */}
              {(deleteQueueActive || deleteQueueProgress.current > 0 || deleteLogs.length > 0) && (
                <div className="flex items-center gap-1.5 border-b border-cream-border pb-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteModalTab('feed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      deleteModalTab === 'feed'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-charcoal-muted hover:text-charcoal hover:bg-cream-light'
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Live Feed</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                      {deleteLogs.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteModalTab('success')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      deleteModalTab === 'success'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'text-charcoal-muted hover:text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Deleted ({deleteAuditList.filter((a) => a.status === 'success').length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteModalTab('failed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      deleteModalTab === 'failed'
                        ? 'bg-red-600 text-white shadow-xs'
                        : deleteAuditList.some((a) => a.status === 'failed')
                        ? 'text-red-700 bg-red-50 border border-red-200'
                        : 'text-charcoal-muted hover:text-red-700 hover:bg-red-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                    {deleteAuditList.filter((a) => a.status === 'failed').length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-red-200 text-red-950 font-bold">
                        {deleteAuditList.filter((a) => a.status === 'failed').length}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {/* Tab 1: Monospace Terminal Live Feed */}
              {deleteModalTab === 'feed' && deleteLogs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-charcoal-muted">
                    <span className="font-bold uppercase tracking-wider">Live Deletion Feed</span>
                    <span>{deleteLogs.length} events logged</span>
                  </div>
                  <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-xl border border-slate-800 h-48 overflow-y-auto space-y-1.5 select-text shadow-inner">
                    {deleteLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`leading-relaxed flex items-start gap-2 ${
                          log.type === 'deleted'
                            ? 'text-rose-400'
                            : log.type === 'failed'
                            ? 'text-red-400'
                            : 'text-amber-300'
                        }`}
                      >
                        <span className="text-slate-500 text-[10px] shrink-0">[{log.time}]</span>
                        <span className="flex-1 break-words">{log.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 2: Successfully Deleted List */}
              {deleteModalTab === 'success' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-charcoal-muted">
                    <span className="font-bold uppercase tracking-wider">Deleted from Picky Assist</span>
                    <span>{deleteAuditList.filter((a) => a.status === 'success').length} products</span>
                  </div>
                  <div className="border border-cream-border rounded-xl h-52 overflow-y-auto divide-y divide-cream-border bg-white">
                    {deleteAuditList.filter((a) => a.status === 'success').length === 0 ? (
                      <div className="p-6 text-center text-xs text-charcoal-muted">
                        No deletions recorded yet in this session.
                      </div>
                    ) : (
                      deleteAuditList
                        .filter((a) => a.status === 'success')
                        .map((item) => (
                          <div key={item.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-rose-50/40">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-charcoal">{item.stockCode}</span>
                                {item.code1 && (
                                  <span className="text-[10px] font-mono text-charcoal-muted">({item.code1})</span>
                                )}
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-rose-100 text-rose-800">
                                  REMOVED
                                </span>
                              </div>
                              <p className="text-[11px] text-charcoal-muted truncate mt-0.5">{item.productName}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">{item.time}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Failed Deletions with 1-Click Retry */}
              {deleteModalTab === 'failed' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-900">
                      Failed Deletions ({deleteAuditList.filter((a) => a.status === 'failed').length})
                    </span>
                    {deleteAuditList.filter((a) => a.status === 'failed').length > 0 && !deleteQueueActive && (
                      <button
                        type="button"
                        onClick={() => {
                          const failedIds = new Set(deleteAuditList.filter((a) => a.status === 'failed').map((a) => a.id));
                          const failedItems = syncCandidateList.filter((p) => failedIds.has(p.id));
                          startDeleteQueue(failedItems);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Failed ({deleteAuditList.filter((a) => a.status === 'failed').length})</span>
                      </button>
                    )}
                  </div>

                  <div className="border border-rose-200 rounded-xl h-52 overflow-y-auto divide-y divide-rose-100 bg-rose-50/20">
                    {deleteAuditList.filter((a) => a.status === 'failed').length === 0 ? (
                      <div className="p-8 text-center text-xs text-charcoal-muted flex flex-col items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                        <p className="font-bold text-charcoal">Zero Failed Deletions!</p>
                        <p className="text-[11px] text-charcoal-muted mt-0.5">All targeted products were removed cleanly.</p>
                      </div>
                    ) : (
                      deleteAuditList
                        .filter((a) => a.status === 'failed')
                        .map((item) => (
                          <div key={item.id} className="p-3 text-xs space-y-1 hover:bg-rose-50/60">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-rose-950">{item.stockCode}</span>
                              <span className="text-[10px] text-rose-600 font-mono">{item.time}</span>
                            </div>
                            <p className="text-[11px] text-charcoal truncate">{item.productName}</p>
                            <p className="text-[11px] text-rose-700 bg-rose-100/70 p-1.5 rounded font-mono break-words">
                              {item.error || item.message || 'Unknown delete error'}
                            </p>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-cream-light/60 border-t border-cream-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {syncCandidatesLoading ? (
                  <span className="text-xs text-charcoal-muted flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Counting candidates...
                  </span>
                ) : deleteAuditList.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => exportQueueAuditCsv(deleteAuditList, 'picky-assist-delete')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-charcoal border border-cream-border bg-white hover:bg-cream-light transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                    title="Export CSV proof of all deleted or failed items"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Export Audit CSV</span>
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {!deleteQueueActive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowDeleteAllModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal border border-cream-border bg-white hover:bg-cream-light transition-all cursor-pointer shadow-2xs"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => startDeleteQueue()}
                      disabled={syncCandidatesLoading || !deleteConfirmChecked || syncCandidateStats.total === 0}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Start Bulk Delete</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={togglePauseDelete}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      {deleteQueuePaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{deleteQueuePaused ? 'Resume' : 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={stopDeleteQueue}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
