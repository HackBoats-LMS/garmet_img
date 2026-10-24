'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  PlusCircle,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Database,
  Globe,
  Play,
  Trash2,
  Copy,
  Check,
  ShoppingBag,
  ArrowDownRight,
  Sparkles,
  Clock,
  Eye,
  Code2,
  Tag,
  ChevronRight,
  ExternalLink,
  Layers,
  Send,
  Zap,
  Terminal,
  ShieldCheck,
  Package,
  Sliders,
  HelpCircle,
  Maximize2,
  CornerDownRight,
  Info,
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

type MainTab = 'inbound_listener' | 'search' | 'update';

export default function PickyTestPage() {
  // Navigation tabs requested by user: 'inbound_listener', 'search', 'update'
  const [activeTab, setActiveTab] = useState<MainTab>('inbound_listener');

  // Database Products
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Inbound Webhook Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [activeInspectorSubTab, setActiveInspectorSubTab] = useState<'mapping' | 'db_impact' | 'raw_payload'>('mapping');

  // Simulator Modal State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simProductId, setSimProductId] = useState('');
  const [simQty, setSimQty] = useState(1);
  const [simSize, setSimSize] = useState('');
  const [simFormat, setSimFormat] = useState<'whatsapp_catalog' | 'form_encoded' | 'single_item'>('whatsapp_catalog');
  const [simDryRun, setSimDryRun] = useState(false);
  const [simOrderId, setSimOrderId] = useState(`ORD-${Date.now().toString().slice(-6)}`);
  const [simCustomerPhone, setSimCustomerPhone] = useState('+919876543210');
  const [simCustomerName, setSimCustomerName] = useState('Priya Sharma');
  const [simulating, setSimulating] = useState(false);

  // Replaying / Executing deduction state
  const [executingDeduction, setExecutingDeduction] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // ── SEARCH TAB STATE ──
  const [searchTarget, setSearchTarget] = useState('');
  const [selectedSearchProductId, setSelectedSearchProductId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // ── UPDATE & PUSH TAB STATE ──
  const [updateSourceMode, setUpdateSourceMode] = useState<'product' | 'json'>('product');
  const [selectedUpdateProductId, setSelectedUpdateProductId] = useState('');
  const [customPayloadText, setCustomPayloadText] = useState(
    '{\n  "stock_code": "TEST-001",\n  "productName": "Signature Kurti Set",\n  "unitPrice": 1299,\n  "retailPrice": 1899,\n  "quantity": 15,\n  "color": "Royal Sage",\n  "cloth_type": "Modal Cotton",\n  "kurta_length": "Short (till hip)",\n  "pant_style": "Afghani Pant",\n  "embroidery_type": "Chikankari Handwork",\n  "status": "ACTIVE"\n}'
  );
  const [previewPayload, setPreviewPayload] = useState<any>(null);
  const [previewVariantTab, setPreviewVariantTab] = useState<string>('main');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executingPush, setExecutingPush] = useState(false);
  const [pushAction, setPushAction] = useState<'update' | 'sync' | 'add'>('update');
  const [pushResponse, setPushResponse] = useState<any>(null);

  // Environment and origin info
  const [envInfo, setEnvInfo] = useState<any>(null);
  const [originUrl, setOriginUrl] = useState('https://unshaken-runway-emit.ngrok-free.dev');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isNgrok = window.location.hostname.includes('ngrok');
      if (isNgrok || window.location.origin) {
        setOriginUrl(window.location.origin);
      }
    }
  }, []);

  const liveWebhookUrl = `${originUrl}/api/webhooks/picky-assist`;
  const v1OrdersWebhookUrl = `${originUrl}/api/v1/webhooks/picky-assist/orders`;
  const searchCallbackUrl = `${originUrl}/api/webhooks/picky-assist/search-response`;

  // 1. Fetch DB Products
  const loadProducts = () => {
    setLoadingProducts(true);
    fetch('/api/admin/products?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products)) {
          setProducts(data.products);
          if (data.products.length > 0) {
            if (!simProductId) setSimProductId(data.products[0].id);
            if (!selectedUpdateProductId) setSelectedUpdateProductId(data.products[0].id);
          }
        }
      })
      .catch((err) => console.error('Failed to load products:', err))
      .finally(() => setLoadingProducts(false));
  };

  // 2. Fetch Inbound Logs
  const fetchLogs = (selectFirst = false) => {
    setLoadingLogs(true);
    fetch('/api/admin/picky-test/logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.requests) {
          setLogs(data.requests);
          if (selectFirst && data.requests.length > 0) {
            setSelectedLogId(data.requests[0].id);
          } else if (!selectedLogId && data.requests.length > 0) {
            setSelectedLogId(data.requests[0].id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    loadProducts();
    fetchLogs(true);

    fetch('/api/admin/picky-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_env' }),
    })
      .then((res) => res.json())
      .then((d) => {
        if (d.envUrls) setEnvInfo(d.envUrls);
      })
      .catch(console.error);
  }, []);

  // Auto-refresh interval (every 3 seconds) for captured webhook listener
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetch('/api/admin/picky-test/logs')
        .then((res) => res.json())
        .then((data) => {
          if (data.requests) {
            setLogs((prev) => {
              if (prev.length !== data.requests.length || prev[0]?.id !== data.requests[0]?.id) {
                return data.requests;
              }
              return prev;
            });
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Load preview payload whenever selectedUpdateProductId changes in Update tab
  useEffect(() => {
    if (updateSourceMode === 'product' && selectedUpdateProductId) {
      setLoadingPreview(true);
      fetch('/api/admin/picky-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_payload',
          productId: selectedUpdateProductId,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setPreviewPayload(d);
        })
        .catch(console.error)
        .finally(() => setLoadingPreview(false));
    }
  }, [selectedUpdateProductId, updateSourceMode]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all recorded webhook logs?')) return;
    await fetch('/api/admin/picky-test/logs', { method: 'DELETE' });
    setLogs([]);
    setSelectedLogId(null);
  };

  // Filter logs by query
  const filteredLogs = useMemo(() => {
    if (!logSearchQuery.trim()) return logs;
    const q = logSearchQuery.toLowerCase();
    return logs.filter((l) => {
      const orderId = l.mappingResult?.orderMeta?.orderId || l.body?.order_id || l.body?.order_reference || '';
      const phone = l.mappingResult?.orderMeta?.customerPhone || l.body?.phone || l.body?.customer?.phone || '';
      const summary = l.mappingResult?.summaryMessage || '';
      return (
        String(orderId).toLowerCase().includes(q) ||
        String(phone).toLowerCase().includes(q) ||
        String(summary).toLowerCase().includes(q) ||
        JSON.stringify(l.body).toLowerCase().includes(q)
      );
    });
  }, [logs, logSearchQuery]);

  const selectedLog = logs.find((l) => l.id === selectedLogId) || logs[0] || null;

  // Selected product objects
  const simProduct = products.find((p) => p.id === simProductId);
  const updateProduct = products.find((p) => p.id === selectedUpdateProductId);

  // Execute or replay deduction on DB for current selected request
  const handleExecuteDeduction = async (dryRun = false) => {
    if (!selectedLog) return;
    setExecutingDeduction(true);
    setExecutionMessage(null);
    try {
      const res = await fetch('/api/admin/picky-test/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replay',
          requestId: selectedLog.id,
          dryRun,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setExecutionMessage(data.message);
        fetchLogs();
        loadProducts();
      } else {
        alert(data.error || 'Failed to process request');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExecutingDeduction(false);
    }
  };

  // Submit Simulator Order
  const handleSimulateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simProductId) {
      alert('Please select a product to simulate');
      return;
    }
    setSimulating(true);
    try {
      const res = await fetch('/api/admin/picky-test/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'simulate_order',
          productId: simProductId,
          quantity: simQty,
          size: simSize || undefined,
          format: simFormat,
          dryRun: simDryRun,
          orderId: simOrderId,
          customerPhone: simCustomerPhone,
          customerName: simCustomerName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSimulateModal(false);
        fetchLogs(true);
        loadProducts();
        setSimOrderId(`ORD-${Date.now().toString().slice(-6)}`);
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  // ── SEARCH HANDLER ──
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const identifier = searchTarget.trim();
    if (!identifier) {
      alert('Please enter a barcode, stock code, or select a product from the database.');
      return;
    }
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch('/api/admin/picky-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          identifier,
        }),
      });
      const data = await res.json();
      setSearchResult(data);
    } catch (err: any) {
      setSearchResult({ success: false, error: err.message });
    } finally {
      setSearching(false);
    }
  };

  // ── UPDATE / PUSH HANDLER (NEW PUSH RULES) ──
  const handlePushSubmit = async (actionToRun: 'update' | 'sync' | 'add') => {
    setExecutingPush(true);
    setPushResponse(null);
    setPushAction(actionToRun);
    try {
      let reqBody: any = { action: actionToRun };
      if (updateSourceMode === 'product') {
        reqBody.productId = selectedUpdateProductId;
      } else {
        try {
          reqBody.payload = JSON.parse(customPayloadText);
        } catch {
          setPushResponse({ success: false, error: 'Invalid JSON format in custom payload textarea' });
          setExecutingPush(false);
          return;
        }
      }

      const res = await fetch('/api/admin/picky-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      setPushResponse(data);
      if (data.success) {
        loadProducts(); // update syncedAt badge
      }
    } catch (err: any) {
      setPushResponse({ success: false, error: err.message });
    } finally {
      setExecutingPush(false);
    }
  };

  // Helper: Sample cURL for testing incoming order
  const sampleCurl = `curl -X POST "${liveWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "order_reference": "WA-${Date.now().toString().slice(-6)}",
    "customer": {
      "name": "Priya Sharma",
      "phone": "+919876543210"
    },
    "items": [
      {
        "stock_code": "${products[0]?.stockCode || '5270000094'}",
        "title": "${products[0]?.productName || 'Cotton Kurti'}",
        "size": "L",
        "quantity": 1,
        "price": ${products[0]?.retailPrice || 1299}
      }
    ]
  }'`;

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto px-2 sm:px-4">
      {/* ── HEADER & PRIMARY CONTROLS ── */}
      <div className="border-b border-cream-border/70 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PICKY ASSIST INTEGRATION CENTER
              </span>
              <span className="text-xs text-charcoal-muted">WhatsApp Commerce • Auto Inventory Deduction • Smart Push Rules</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-charcoal flex items-center gap-2.5">
              <ShoppingBag className="w-6 h-6 text-accent" /> Picky Assist Order & Catalog Studio
            </h1>
            <p className="text-xs text-charcoal-muted mt-1">
              Test incoming WhatsApp customer orders, search products across Picky Assist, and push catalog updates using the new push rules.
            </p>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="flex items-center bg-cream-light/90 p-1.5 rounded-2xl border border-cream-border shadow-xs flex-wrap gap-1">
            {/* Tab 1: Inbound Listener */}
            <button
              type="button"
              onClick={() => setActiveTab('inbound_listener')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'inbound_listener'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-charcoal hover:text-accent hover:bg-white/60'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Orders Webhook Listener</span>
              {logs.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === 'inbound_listener' ? 'bg-white/20 text-white' : 'bg-cream-border text-charcoal'
                  }`}
                >
                  {logs.length}
                </span>
              )}
            </button>

            {/* Tab 2: Search */}
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-charcoal hover:text-accent hover:bg-white/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search Product</span>
            </button>

            {/* Tab 3: Update & Push Rules */}
            <button
              type="button"
              onClick={() => setActiveTab('update')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'update'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-charcoal hover:text-accent hover:bg-white/60'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Update & Push Rules</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: ORDER WEBHOOK LISTENER (ROUTE THAT LISTENS WHEN ORDER COMES FROM PA) */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'inbound_listener' && (
        <div className="space-y-6">
          {/* Active Listening Route Banner */}
          <Card className="p-5 border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-cream-light/30 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    Live Webhook Listener for Incoming Orders
                  </h2>
                </div>
                <p className="text-xs text-charcoal-muted">
                  Configure this endpoint in Picky Assist <strong>Smart Automation / Push Webhook</strong>. When a WhatsApp customer buys an item, Picky Assist calls this route to automatically deduct stock from your database.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulate Inbound Order</span>
                </button>
                <button
                  type="button"
                  onClick={() => fetchLogs()}
                  disabled={loadingLogs}
                  className="px-3 py-2 bg-white hover:bg-cream-light border border-cream-border text-charcoal rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <label className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-cream-border text-xs text-charcoal-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="accent-accent w-3.5 h-3.5 rounded"
                  />
                  <span>Live Auto-Poll (3s)</span>
                </label>
              </div>
            </div>

            {/* Webhook URLs & cURL helper */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-4">
              {/* Primary Inbound Webhook */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                      ACTIVE ROUTE
                    </span>
                    <span className="text-xs font-bold text-charcoal">Picky Assist Orders Listener</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold">POST / GET</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                  <code className="flex-1 truncate">{liveWebhookUrl}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(liveWebhookUrl, 'live_url')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    {copiedKey === 'live_url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-charcoal-muted pt-0.5">
                  <span>Supports: JSON, URL-Encoded & Cart Objects</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sampleCurl, 'curl')}
                    className="text-accent hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>{copiedKey === 'curl' ? 'Copied cURL!' : 'Copy test cURL command'}</span>
                  </button>
                </div>
              </div>

              {/* Alternative Route & Search Callback */}
              <div className="p-3.5 rounded-xl bg-white border border-cream-border shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                      SEARCH CALLBACK
                    </span>
                    <span className="text-xs font-bold text-charcoal">Async Search Response URL</span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-mono font-bold">POST</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-blue-300 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                  <code className="flex-1 truncate">{searchCallbackUrl}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(searchCallbackUrl, 'search_callback')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Callback URL"
                  >
                    {copiedKey === 'search_callback' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-charcoal-muted">
                  Used by Picky Assist CRM to post search results back when verifying product presence before order processing.
                </p>
              </div>
            </div>
          </Card>

          {/* Captured Inbound Webhook Stream & Field Mapping Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Captured Inbound Requests (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" /> Captured Requests ({filteredLogs.length})
                </h3>
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={clearLogs}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* Search filter for logs */}
              {logs.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-charcoal-muted absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="Filter by Order ID, phone, code..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-cream-border rounded-xl focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {logs.length === 0 ? (
                <Card className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-cream-light flex items-center justify-center mx-auto text-charcoal-muted">
                    <Globe className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-charcoal font-semibold">No Inbound Orders Captured Yet</p>
                  <p className="text-[11px] text-charcoal-muted">
                    Point your Picky Assist bot automation to the listener URL, or click below to simulate an order right now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSimulateModal(true)}
                    className="px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold mx-auto cursor-pointer"
                  >
                    Simulate WhatsApp Order
                  </button>
                </Card>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                  {filteredLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const actionTaken = log.mappingResult?.actionTaken;
                    const isSuccess = log.mappingResult?.success;
                    const orderRef = log.mappingResult?.orderMeta?.orderId || log.body?.order_id || log.body?.order_reference;
                    const phone = log.mappingResult?.orderMeta?.customerPhone || log.body?.phone || log.body?.customer?.phone;

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white border-accent shadow-sm ring-2 ring-accent/10'
                            : 'bg-white/70 hover:bg-white border-cream-border hover:border-charcoal-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              log.method === 'POST' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className="text-[10px] text-charcoal-muted">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <div className="font-semibold text-charcoal flex items-center justify-between gap-2">
                          <span className="truncate">{orderRef ? `Order #${orderRef}` : 'Webhook Event'}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              actionTaken === 'INVENTORY_DEDUCTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : actionTaken === 'SIMULATED'
                                ? 'bg-blue-100 text-blue-800'
                                : isSuccess
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {actionTaken || (isSuccess ? 'PROCESSED' : 'UNMAPPED')}
                          </span>
                        </div>

                        {phone && <p className="text-[11px] text-charcoal-muted mt-1 font-mono">📱 {phone}</p>}

                        {log.mappingResult?.summaryMessage && (
                          <p className="text-[10px] text-charcoal-muted line-clamp-1 mt-1 border-t border-cream-border/50 pt-1">
                            {log.mappingResult.summaryMessage}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Live Field Mapping & Database Impact Inspector (8 cols) */}
            <div className="lg:col-span-8">
              {selectedLog ? (
                <Card className="p-6 space-y-5">
                  {/* Top Bar of Inspector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cream-border">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold">
                          {selectedLog.method}
                        </span>
                        <h3 className="font-bold text-sm text-charcoal">
                          {selectedLog.mappingResult?.orderMeta?.orderId
                            ? `Order #${selectedLog.mappingResult.orderMeta.orderId}`
                            : 'Inbound Webhook Payload'}
                        </h3>
                      </div>
                      <p className="text-xs text-charcoal-muted mt-0.5 font-mono">
                        Captured at: {new Date(selectedLog.timestamp).toLocaleString()} • IP: {selectedLog.ip || '127.0.0.1'}
                      </p>
                    </div>

                    {/* Inspector Sub-Tabs */}
                    <div className="flex items-center bg-cream-light p-1 rounded-xl border border-cream-border text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSubTab('mapping')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          activeInspectorSubTab === 'mapping' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                        }`}
                      >
                        Field Mapping
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSubTab('db_impact')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          activeInspectorSubTab === 'db_impact' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                        }`}
                      >
                        Inventory Impact
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveInspectorSubTab('raw_payload')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          activeInspectorSubTab === 'raw_payload' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                        }`}
                      >
                        Raw JSON
                      </button>
                    </div>
                  </div>

                  {/* SUB-TAB 1: FIELD MAPPING TABLE */}
                  {activeInspectorSubTab === 'mapping' && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                        <div>
                          <strong>Field Mapping Engine:</strong> Shows how incoming keys from Picky Assist (WhatsApp catalog items, retailer IDs, sizes, quantities, and phone numbers) map directly into your PostgreSQL Prisma database.
                        </div>
                      </div>

                      {selectedLog.mappingResult?.fieldMappings && selectedLog.mappingResult.fieldMappings.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-cream-border">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-cream-light/80 text-[11px] font-bold text-charcoal uppercase tracking-wider border-b border-cream-border">
                              <tr>
                                <th className="p-3">Incoming Field (Picky Assist)</th>
                                <th className="p-3">Sample Value</th>
                                <th className="p-3">Mapped Database Column</th>
                                <th className="p-3">Match Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-cream-border/60">
                              {selectedLog.mappingResult.fieldMappings.map((m: any, idx: number) => (
                                <tr key={idx} className="hover:bg-cream-light/30">
                                  <td className="p-3 font-mono font-bold text-charcoal">{m.sourceField}</td>
                                  <td className="p-3 font-mono text-charcoal-muted truncate max-w-[200px]">
                                    {typeof m.sourceValue === 'object' ? JSON.stringify(m.sourceValue) : String(m.sourceValue)}
                                  </td>
                                  <td className="p-3 font-semibold text-accent">{m.targetDbField}</td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        m.matchStatus === 'matched'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : m.matchStatus === 'fallback'
                                          ? 'bg-blue-100 text-blue-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {m.matchStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-8 border border-dashed border-cream-border rounded-xl text-center text-xs text-charcoal-muted">
                          No structured field mappings were recorded for this request.
                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB-TAB 2: DATABASE IMPACT & STOCK DEDUCTION */}
                  {activeInspectorSubTab === 'db_impact' && (
                    <div className="space-y-4 animate-fade-in">
                      {selectedLog.mappingResult?.summaryMessage && (
                        <div
                          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-3 ${
                            selectedLog.mappingResult.success
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {selectedLog.mappingResult.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <span>{selectedLog.mappingResult.summaryMessage}</span>
                          </div>

                          {/* Replay action buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleExecuteDeduction(true)}
                              disabled={executingDeduction}
                              className="px-2.5 py-1 bg-white hover:bg-cream-light border border-cream-border rounded-lg text-[11px] font-bold text-charcoal cursor-pointer shadow-2xs"
                            >
                              Dry Run Test
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExecuteDeduction(false)}
                              disabled={executingDeduction}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shadow-xs"
                            >
                              {executingDeduction ? 'Deducting...' : 'Deduct Live on DB'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Items Processed List */}
                      {selectedLog.mappingResult?.itemsProcessed?.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl border border-cream-border bg-white space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {item.product?.coverImageUrl ? (
                                <img
                                  src={item.product.coverImageUrl}
                                  alt=""
                                  className="w-12 h-12 rounded-lg object-cover border border-cream-border"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-cream-light flex items-center justify-center text-charcoal-muted">
                                  <Package className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-bold text-xs text-charcoal">
                                  {item.product?.productName || item.stockCodeRequested}
                                </h4>
                                <p className="text-[11px] text-charcoal-muted font-mono">
                                  Code: {item.product?.stockCode || item.stockCodeRequested}
                                  {item.product?.code1 ? ` · Alt: ${item.product.code1}` : ''}
                                  {item.sizeRequested ? ` · Size: ${item.sizeRequested}` : ''}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                item.status === 'deducted'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'simulated'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          {/* Inventory Before & After Numbers */}
                          {item.product && (
                            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-cream-light/60 border border-cream-border text-center text-xs">
                              <div>
                                <span className="text-[10px] text-charcoal-muted uppercase font-bold block">Previous Stock</span>
                                <span className="font-bold text-charcoal">{item.product.oldQuantity} units</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-charcoal-muted uppercase font-bold block">Order Qty</span>
                                <span className="font-bold text-accent">-{item.quantityRequested}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-charcoal-muted uppercase font-bold block">New Stock</span>
                                <span className="font-bold text-emerald-700">{item.product.newQuantity} units</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SUB-TAB 3: RAW PAYLOAD & HEADERS */}
                  {activeInspectorSubTab === 'raw_payload' && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="relative">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl border-b border-slate-700 text-[10px] text-slate-400 font-mono">
                          <span>Payload JSON Body</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(JSON.stringify(selectedLog.body, null, 2), 'log_body')}
                            className="hover:text-white transition-colors cursor-pointer text-[10px]"
                          >
                            {copiedKey === 'log_body' ? 'Copied' : 'Copy JSON'}
                          </button>
                        </div>
                        <pre className="p-4 bg-[#0d1117] text-[#58a6ff] rounded-b-xl text-xs font-mono overflow-x-auto max-h-[400px] whitespace-pre-wrap leading-relaxed border border-slate-800">
                          <code>{JSON.stringify(selectedLog.body, null, 2)}</code>
                        </pre>
                      </div>

                      {selectedLog.headers && (
                        <details className="text-xs text-charcoal-muted">
                          <summary className="cursor-pointer font-bold py-1">View Inbound HTTP Headers</summary>
                          <pre className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono mt-2 overflow-x-auto">
                            {JSON.stringify(selectedLog.headers, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-12 text-center text-xs text-charcoal-muted">
                  Select a request from the list on the left to inspect its field mapping and inventory impact.
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: SEARCH PRODUCT IN PICKY ASSIST                                       */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="max-w-2xl space-y-4">
              <div>
                <h2 className="text-base font-bold text-charcoal flex items-center gap-2">
                  <Search className="w-5 h-5 text-accent" /> Search Product in Picky Assist
                </h2>
                <p className="text-xs text-charcoal-muted mt-1">
                  Query the Picky Assist CRM / Meta Catalog by barcode, stock code, code1, or variant code to check if the product already exists before adding or updating.
                </p>
              </div>

              {/* Quick Select from Local Database */}
              <div className="space-y-1.5 p-3 rounded-xl bg-cream-light/60 border border-cream-border">
                <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                  <span>Quick Pick from Local Database</span>
                  <span className="text-[10px] text-charcoal-muted">Auto-fills search box</span>
                </label>
                <select
                  value={selectedSearchProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedSearchProductId(pid);
                    const found = products.find((p) => p.id === pid);
                    if (found) {
                      setSearchTarget(found.code1 || found.stockCode);
                    }
                  }}
                  className="w-full p-2 bg-white border border-cream-border rounded-xl text-xs font-medium text-charcoal focus:outline-none focus:border-accent"
                >
                  <option value="">-- Choose a product to test search --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.stockCode} {p.code1 ? `(${p.code1})` : ''} — {p.productName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Form */}
              <form onSubmit={handleSearchSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-charcoal block">Search Identifier (Barcode / Stock Code / Code1 / Variant Code)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchTarget}
                      onChange={(e) => setSearchTarget(e.target.value)}
                      placeholder="e.g. 5270000094 or saree-05-cherry-red or k-1-orchid-xl"
                      className="flex-1 px-3 py-2.5 border border-cream-border rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={searching}
                      className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Search</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Configured Endpoints Info */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-700 space-y-1">
                <div>
                  <span className="font-bold text-slate-900">Search Webhook URL:</span>{' '}
                  <span className="text-accent">{envInfo?.searchUrl || 'Configured via PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL'}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900">Async Callback URL:</span>{' '}
                  <span className="text-slate-600">{searchCallbackUrl}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Search Result Display */}
          {searchResult && (
            <Card className="p-6 animate-fade-in space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-cream-border">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      searchResult.exists ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {searchResult.exists ? '✓ Product Exists in Picky Assist' : '✕ Product Not Found in Picky Assist'}
                  </span>
                  <span className="text-xs text-charcoal-muted font-mono">Target: {searchResult.identifier}</span>
                </div>

                {!searchResult.exists && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('update');
                      if (selectedSearchProductId) setSelectedUpdateProductId(selectedSearchProductId);
                    }}
                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Switch to Update/Push tab to Add it</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Details card if exists */}
              {searchResult.exists && searchResult.product && (
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs space-y-2">
                  <h4 className="font-bold text-emerald-950 text-sm">
                    {searchResult.product.productName || searchResult.product.title || searchResult.identifier}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div>
                      <span className="text-[10px] text-charcoal-muted uppercase block">Retail Price</span>
                      <span className="font-bold text-charcoal">₹{searchResult.product.retailPrice || searchResult.product.price || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-muted uppercase block">Quantity</span>
                      <span className="font-bold text-charcoal">{searchResult.product.quantity || searchResult.product.qty || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-muted uppercase block">Stock Code</span>
                      <span className="font-bold font-mono text-charcoal">{searchResult.product.stock_code || searchResult.product.stockCode || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-muted uppercase block">Status</span>
                      <span className="font-bold text-emerald-700">{searchResult.product.status || 'ACTIVE'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw search response JSON */}
              <div className="relative">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl border-b border-slate-700 text-[10px] text-slate-400 font-mono">
                  <span>Raw Search Result Payload</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(searchResult, null, 2), 'search_raw')}
                    className="hover:text-white transition-colors cursor-pointer text-[10px]"
                  >
                    {copiedKey === 'search_raw' ? 'Copied' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="p-4 bg-[#0d1117] text-[#58a6ff] rounded-b-xl text-xs font-mono overflow-x-auto max-h-[350px] whitespace-pre-wrap leading-relaxed border border-slate-800">
                  <code>{JSON.stringify(searchResult, null, 2)}</code>
                </pre>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: UPDATE & PUSH RULES (UPDATED FOR NEW MAPPING RULES & MULTI-VARIANTS) */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'update' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 5 Cols: Product Selector, Push Mode & Actions */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-charcoal flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-accent" /> Update & Push to Picky Assist
                  </h2>
                  <p className="text-xs text-charcoal-muted mt-1">
                    Select a local product or customize JSON to push updates to Picky Assist with full support for new push rules: garment attributes, multi-barcodes, and variant mapping.
                  </p>
                </div>

                {/* Mode Selector */}
                <div className="flex items-center bg-cream-light p-1 rounded-xl border border-cream-border text-xs">
                  <button
                    type="button"
                    onClick={() => setUpdateSourceMode('product')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      updateSourceMode === 'product' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                    }`}
                  >
                    Database Product
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateSourceMode('json')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      updateSourceMode === 'json' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                    }`}
                  >
                    Custom JSON
                  </button>
                </div>

                {/* Option A: Select Product from DB */}
                {updateSourceMode === 'product' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-charcoal block">Select Product</label>
                      <select
                        value={selectedUpdateProductId}
                        onChange={(e) => setSelectedUpdateProductId(e.target.value)}
                        className="w-full p-2.5 bg-white border border-cream-border rounded-xl text-xs font-medium text-charcoal focus:outline-none focus:border-accent"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.stockCode} {p.code1 ? `(${p.code1})` : ''} — {p.productName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product Summary Card */}
                    {updateProduct && (
                      <div className="p-3.5 rounded-xl bg-cream-light/40 border border-cream-border space-y-2 text-xs">
                        <div className="flex items-center gap-3">
                          {updateProduct.coverImageUrl ? (
                            <img
                              src={updateProduct.coverImageUrl}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover border border-cream-border shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-cream-light flex items-center justify-center text-charcoal-muted shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-charcoal truncate">{updateProduct.productName}</h4>
                            <p className="text-[11px] text-charcoal-muted font-mono truncate">
                              Stock: {updateProduct.stockCode} · Code1: {updateProduct.code1 || '—'}
                            </p>
                            <p className="text-[11px] text-accent font-semibold">
                              ₹{updateProduct.retailPrice || updateProduct.unitPrice || '—'} · Total Qty: {updateProduct.quantity}
                            </p>
                          </div>
                        </div>

                        {/* Garment Attribute Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {updateProduct.kurtaLength && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-semibold">
                              Kurta: {updateProduct.kurtaLength}
                            </span>
                          )}
                          {updateProduct.pantStyle && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-semibold">
                              Pant: {updateProduct.pantStyle}
                            </span>
                          )}
                          {updateProduct.color && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-semibold">
                              Color: {updateProduct.color}
                            </span>
                          )}
                          {updateProduct.clothType && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-semibold">
                              Fabric: {updateProduct.clothType}
                            </span>
                          )}
                        </div>

                        {/* Size breakdown with barcodes */}
                        {updateProduct.sizeInventory && typeof updateProduct.sizeInventory === 'object' && (
                          <div className="pt-2 border-t border-cream-border/60">
                            <span className="text-[10px] text-charcoal-muted uppercase font-bold block mb-1">
                              Size Variants & Barcodes:
                            </span>
                            <div className="space-y-1">
                              {Object.entries(updateProduct.sizeInventory).map(([sz, sVal]: any) => {
                                const qty = typeof sVal === 'object' ? sVal?.quantity ?? 0 : sVal;
                                const codes = typeof sVal === 'object' ? sVal?.stockCodes || (sVal?.stockCode ? [sVal.stockCode] : []) : [];
                                return (
                                  <div key={sz} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-cream-border">
                                    <span className="font-bold text-charcoal">Size {sz} ({qty} units)</span>
                                    <span className="font-mono text-[10px] text-charcoal-muted">
                                      {codes.length > 0 ? codes.join(', ') : 'No barcode'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: Custom JSON Textarea */}
                {updateSourceMode === 'json' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-charcoal flex items-center justify-between">
                      <span>Custom JSON Payload</span>
                      <span className="text-[10px] text-charcoal-muted">Editable</span>
                    </label>
                    <textarea
                      rows={12}
                      value={customPayloadText}
                      onChange={(e) => setCustomPayloadText(e.target.value)}
                      className="w-full p-3 border border-slate-700 rounded-xl font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Push Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-cream-border">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Primary: UPDATE */}
                    <button
                      type="button"
                      onClick={() => handlePushSubmit('update')}
                      disabled={executingPush}
                      className="py-2.5 px-3 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {executingPush && pushAction === 'update' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Edit3 className="w-3.5 h-3.5" />
                      )}
                      <span>Push UPDATE</span>
                    </button>

                    {/* Secondary: SMART SYNC */}
                    <button
                      type="button"
                      onClick={() => handlePushSubmit('sync')}
                      disabled={executingPush}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {executingPush && pushAction === 'sync' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>Smart SYNC (Diff)</span>
                    </button>
                  </div>

                  {/* Optional: Direct ADD */}
                  <button
                    type="button"
                    onClick={() => handlePushSubmit('add')}
                    disabled={executingPush}
                    className="w-full py-2 px-3 bg-white hover:bg-cream-light border border-cream-border text-charcoal rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Push as NEW Product (Add)</span>
                  </button>
                </div>
              </Card>
            </div>

            {/* Right 7 Cols: Payload Preview (New Push Rules) & Execution Response */}
            <div className="lg:col-span-7 space-y-4">
              {/* Push Response Card (if fired) */}
              {pushResponse && (
                <Card className="p-5 animate-fade-in space-y-3 border-accent/40 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-cream-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-charcoal flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-accent" />
                      <span>{pushAction.toUpperCase()} Execution Result</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                        pushResponse.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pushResponse.success ? 'Success' : 'Failed'}
                    </span>
                  </div>

                  {pushResponse.message && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                        pushResponse.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {pushResponse.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      )}
                      <span>{pushResponse.message}</span>
                    </div>
                  )}

                  {/* Diff View if Smart Sync detected changes */}
                  {pushResponse.diff && Object.keys(pushResponse.diff).length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <span className="font-bold text-amber-900 block mb-1">Differences Detected & Updated:</span>
                      <pre className="font-mono text-[11px] overflow-x-auto text-amber-950">
                        {JSON.stringify(pushResponse.diff, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Per-Variant Push Results (Shows each variant updated as its own product) */}
                  {pushResponse.results && pushResponse.results.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Per-Variant Product Sync ({pushResponse.results.length} variants)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">product_id = variant_code · item_group_id = code1</span>
                      </div>
                      <div className="space-y-1.5">
                        {pushResponse.results.map((r: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-charcoal">Size {r.size}</span>
                              <code className="text-[10px] text-accent font-mono bg-accent/10 px-1.5 py-0.5 rounded">
                                product_id: {r.variantCode}
                              </code>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                r.success ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {r.success ? `HTTP ${r.status} OK` : `HTTP ${r.status} FAILED`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl border-b border-slate-700 text-[10px] text-slate-400 font-mono">
                      <span>API Response</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(pushResponse, null, 2), 'push_resp')}
                        className="hover:text-white transition-colors cursor-pointer text-[10px]"
                      >
                        {copiedKey === 'push_resp' ? 'Copied' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre className="p-3.5 bg-[#0d1117] text-[#58a6ff] rounded-b-xl text-xs font-mono overflow-x-auto max-h-[250px] whitespace-pre-wrap leading-relaxed border border-slate-800">
                      <code>{JSON.stringify(pushResponse, null, 2)}</code>
                    </pre>
                  </div>
                </Card>
              )}

              {/* Live Preview of Mapped Payload according to New Push Rules */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-cream-border">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-accent" />
                      <span>Live Payload Preview (New Push Rules)</span>
                    </h3>
                    <p className="text-[11px] text-charcoal-muted mt-0.5">
                      Each size variant is updated as its own product using <code>variant_code</code> as <code>product_id</code> and <code>code1</code> as <code>item_group_id</code>.
                    </p>
                  </div>

                  {previewPayload?.mainPayload && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetJson = previewVariantTab === 'main'
                          ? previewPayload.mainPayload
                          : previewPayload.variantPayloads?.[previewVariantTab] || previewPayload.mainPayload;
                        copyToClipboard(JSON.stringify(targetJson, null, 2), 'payload_prev');
                      }}
                      className="px-2.5 py-1 text-xs border border-cream-border hover:bg-cream-light rounded-lg text-charcoal cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedKey === 'payload_prev' ? 'Copied' : 'Copy Payload'}</span>
                    </button>
                  )}
                </div>

                {loadingPreview ? (
                  <div className="p-8 text-center text-xs text-charcoal-muted flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                    <span>Compiling payload preview...</span>
                  </div>
                ) : previewPayload?.mainPayload ? (
                  <div className="space-y-3">
                    {/* Variant Tabs Selector if multiple variants */}
                    {previewPayload.hasMultipleVariants && previewPayload.variantPayloads && (
                      <div className="flex items-center gap-1.5 bg-cream-light p-1 rounded-xl border border-cream-border overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setPreviewVariantTab('main')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            previewVariantTab === 'main' ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                          }`}
                        >
                          Master Summary
                        </button>
                        {Object.keys(previewPayload.variantPayloads).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setPreviewVariantTab(sz)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                              previewVariantTab === sz ? 'bg-white text-accent shadow-xs' : 'text-charcoal-muted hover:text-charcoal'
                            }`}
                          >
                            Size {sz} (Product)
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Callout of mapped push rules */}
                    <div className="p-3 rounded-xl bg-cream-light/60 border border-cream-border text-[11px] text-charcoal space-y-1">
                      <span className="font-bold flex items-center gap-1 text-accent">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Push Rules Applied:
                      </span>
                      <ul className="list-disc list-inside text-charcoal-muted space-y-0.5 leading-relaxed">
                        <li>
                          <strong>Variant Identification:</strong> <code>product_id</code> is set to <code>variant_code</code> (e.g. <code>{(previewPayload.variantPayloads && Object.values(previewPayload.variantPayloads)[0] as any)?.product_id || previewPayload.mainPayload.product_id}</code>) and <code>item_group_id</code> is set to <code>code1</code> (<code>{previewPayload.mainPayload.item_group_id}</code>).
                        </li>
                        <li>
                          <strong>Garment Attributes:</strong> <code>kurta_length</code>, <code>pant_style</code>, <code>embroidery_type</code>, <code>cut_style</code>, <code>border</code> mapped.
                        </li>
                        <li>
                          <strong>Multi-Stock Codes:</strong> Barcodes mapped to <code>barcode</code>, <code>barcodes</code>, and <code>stock_codes</code> per variant.
                        </li>
                        <li>
                          <strong>Wholesale & MRP:</strong> <code>dealer_price</code>, <code>wholesale_price</code>, and <code>regular_price</code> included.
                        </li>
                      </ul>
                    </div>

                    <pre className="p-4 bg-[#0d1117] text-[#58a6ff] rounded-xl text-xs font-mono overflow-x-auto max-h-[420px] whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                      <code>
                        {JSON.stringify(
                          previewVariantTab === 'main'
                            ? previewPayload.mainPayload
                            : previewPayload.variantPayloads?.[previewVariantTab] || previewPayload.mainPayload,
                          null,
                          2
                        )}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-charcoal-muted">
                    Select a product on the left to inspect its compiled push payload.
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* SIMULATE INBOUND ORDER MODAL                                                */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-cream-border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-cream-border">
              <h3 className="font-bold text-sm text-charcoal flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Simulate Inbound Picky Assist Order
              </h3>
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="text-charcoal-muted hover:text-charcoal text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateOrder} className="space-y-4 text-xs">
              {/* Select Product from Database */}
              <div className="space-y-1.5">
                <label className="font-bold text-charcoal block">Select Product from Database</label>
                <select
                  value={simProductId}
                  onChange={(e) => {
                    setSimProductId(e.target.value);
                    setSimSize('');
                  }}
                  className="w-full p-2.5 bg-white border border-cream-border rounded-xl text-xs font-medium text-charcoal focus:outline-none focus:border-accent"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.stockCode} — {p.productName} (In Stock: {p.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Size */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-charcoal block">Quantity to Buy</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={simQty}
                    onChange={(e) => setSimQty(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-cream-border rounded-xl font-bold text-charcoal"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-charcoal block">Size Variant</label>
                  {simProduct?.sizeInventory && Object.keys(simProduct.sizeInventory).length > 0 ? (
                    <select
                      value={simSize}
                      onChange={(e) => setSimSize(e.target.value)}
                      className="w-full p-2 border border-cream-border rounded-xl font-bold text-charcoal"
                    >
                      <option value="">Any / Master Stock</option>
                      {Object.keys(simProduct.sizeInventory).map((s) => (
                        <option key={s} value={s}>
                          Size {s} (Qty: {simProduct.sizeInventory[s]?.quantity ?? simProduct.sizeInventory[s]})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="e.g. XL, M"
                      value={simSize}
                      onChange={(e) => setSimSize(e.target.value)}
                      className="w-full p-2 border border-cream-border rounded-xl font-bold text-charcoal"
                    />
                  )}
                </div>
              </div>

              {/* Order Meta details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-charcoal block">Order ID / Reference</label>
                  <input
                    type="text"
                    value={simOrderId}
                    onChange={(e) => setSimOrderId(e.target.value)}
                    className="w-full p-2 border border-cream-border rounded-xl font-mono text-charcoal"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-charcoal block">Customer WhatsApp Phone</label>
                  <input
                    type="text"
                    value={simCustomerPhone}
                    onChange={(e) => setSimCustomerPhone(e.target.value)}
                    className="w-full p-2 border border-cream-border rounded-xl font-mono text-charcoal"
                  />
                </div>
              </div>

              {/* Format selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-charcoal block">Payload Format Schema</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-cream-border cursor-pointer hover:bg-cream-light/40">
                    <input
                      type="radio"
                      name="simFormat"
                      checked={simFormat === 'whatsapp_catalog'}
                      onChange={() => setSimFormat('whatsapp_catalog')}
                      className="accent-accent"
                    />
                    <div>
                      <span className="font-bold block text-charcoal">WhatsApp Catalog Cart Order</span>
                      <span className="text-[10px] text-charcoal-muted">Standard schema sent when customer checks out catalog items</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-cream-border cursor-pointer hover:bg-cream-light/40">
                    <input
                      type="radio"
                      name="simFormat"
                      checked={simFormat === 'form_encoded'}
                      onChange={() => setSimFormat('form_encoded')}
                      className="accent-accent"
                    />
                    <div>
                      <span className="font-bold block text-charcoal">Picky Assist Webhook Action (Form/URL-Encoded)</span>
                      <span className="text-[10px] text-charcoal-muted">Simulates form-urlencoded post from bot builder automation</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dry Run Toggle */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-cream-light/60 border border-cream-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={simDryRun}
                  onChange={(e) => setSimDryRun(e.target.checked)}
                  className="accent-accent w-4 h-4 rounded"
                />
                <div>
                  <span className="font-bold text-charcoal block">Dry-Run Only (Preview Without Changing DB)</span>
                  <span className="text-[10px] text-charcoal-muted">Uncheck to actually deduct the product quantity in your database</span>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cream-border">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 border border-cream-border rounded-xl text-charcoal font-semibold hover:bg-cream-light cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{simulating ? 'Sending...' : 'Fire Test Webhook'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
