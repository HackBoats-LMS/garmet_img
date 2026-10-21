'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';

export default function PickyTestPage() {
  // Main view tab: 'inbound_mapper' (live order mapper) or 'outbound_sync' (existing push sync)
  const [activeTab, setActiveTab] = useState<'inbound_mapper' | 'outbound_sync'>('inbound_mapper');

  // Products from DB
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Inbound Webhook Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [activeInspectorSubTab, setActiveInspectorSubTab] = useState<'mapping' | 'db_impact' | 'raw_payload'>('mapping');

  // Simulation Modal State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simProductId, setSimProductId] = useState('');
  const [simQty, setSimQty] = useState(1);
  const [simSize, setSimSize] = useState('');
  const [simFormat, setSimFormat] = useState<'whatsapp_catalog' | 'form_encoded' | 'single_item'>('whatsapp_catalog');
  const [simDryRun, setSimDryRun] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // Replaying / Executing deduction state
  const [executingDeduction, setExecutingDeduction] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // Outbound push sync state (Tab 2)
  const [action, setAction] = useState<'sync' | 'search' | 'add' | 'update'>('sync');
  const [searchIdentifier, setSearchIdentifier] = useState('');
  const [payloadText, setPayloadText] = useState(
    '{\n  "stockCode": "TEST-001",\n  "productName": "Test Garment",\n  "unitPrice": 999,\n  "retailPrice": 1499,\n  "quantity": 10,\n  "color": "Royal Blue",\n  "status": "ACTIVE"\n}'
  );
  const [response, setResponse] = useState<any>(null);
  const [loadingOutbound, setLoadingOutbound] = useState(false);
  const [envInfo, setEnvInfo] = useState<any>(null);

  // ngrok host dynamically detected or fallback
  const [originUrl, setOriginUrl] = useState('https://unshaken-runway-emit.ngrok-free.dev');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isNgrok = window.location.hostname.includes('ngrok');
      if (isNgrok) {
        setOriginUrl(window.location.origin);
      }
    }
  }, []);

  const liveWebhookUrl = `${originUrl}/api/webhooks/picky-assist`;
  const searchCallbackUrl = `${originUrl}/api/webhooks/picky-assist/search-response`;
  const testWebhookUrl = `${originUrl}/api/admin/picky-test/webhook`;

  // 1. Fetch DB Products
  const loadProducts = () => {
    setLoadingProducts(true);
    fetch('/api/admin/products?limit=60')
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setProducts(data.products);
          if (data.products.length > 0 && !simProductId) {
            setSimProductId(data.products[0].id);
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

    // Fetch env URLs for outbound tab
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

  // Auto-refresh interval (every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetch('/api/admin/picky-test/logs')
        .then((res) => res.json())
        .then((data) => {
          if (data.requests) {
            setLogs((prev) => {
              if (prev.length !== data.requests.length || (prev[0]?.id !== data.requests[0]?.id)) {
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(key);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all recorded webhook logs?')) return;
    await fetch('/api/admin/picky-test/logs', { method: 'DELETE' });
    setLogs([]);
    setSelectedLogId(null);
  };

  const selectedLog = logs.find((l) => l.id === selectedLogId) || logs[0] || null;

  // Selected product for simulator
  const simProduct = products.find((p) => p.id === simProductId);

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
        loadProducts(); // refresh stock numbers in select
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSimulateModal(false);
        fetchLogs(true);
        loadProducts();
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  // Outbound push tester submit handler
  const handleOutboundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingOutbound(true);
    setResponse(null);
    try {
      let parsedPayload: any = null;
      if (action !== 'search') {
        try {
          parsedPayload = JSON.parse(payloadText);
        } catch {
          setResponse({ error: 'Invalid JSON format in payload text area' });
          setLoadingOutbound(false);
          return;
        }
      }

      const res = await fetch('/api/admin/picky-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload: parsedPayload,
          identifier: searchIdentifier || parsedPayload?.stockCode || parsedPayload?.code1,
        }),
      });
      const data = await res.json();
      setResponse(data);
      setTimeout(() => fetchLogs(), 2000);
    } catch (err: any) {
      setResponse({ error: err.message });
    } finally {
      setLoadingOutbound(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="border-b border-cream-border/70 pb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PICKY ASSIST WEBHOOK & INVENTORY HUB
              </span>
              <span className="text-xs text-charcoal-muted">WhatsApp Orders • Auto Inventory Deduction • Live Field Mapping</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-charcoal flex items-center gap-2.5">
              <ShoppingBag className="w-6 h-6 text-accent" /> Picky Assist Order & Webhook Center
            </h1>
            <p className="text-xs text-charcoal-muted mt-1">
              Configure the webhook URL in Picky Assist so when customers buy products on WhatsApp, your database inventory automatically decreases.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-cream-light/80 p-1 rounded-xl border border-cream-border shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('inbound_mapper')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'inbound_mapper'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-charcoal hover:text-accent'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Incoming Orders & Field Mapper</span>
              {logs.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === 'inbound_mapper' ? 'bg-white/20 text-white' : 'bg-cream-border text-charcoal'
                }`}>
                  {logs.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('outbound_sync')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'outbound_sync'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-charcoal hover:text-accent'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Outbound Product Sync & Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: INCOMING ORDERS & WEBHOOK FIELD MAPPER                                */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'inbound_mapper' && (
        <div className="space-y-6">
          {/* Webhook URLs & Setup Card */}
          <Card className="p-5 border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-cream-light/30 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    Live Webhook Endpoints for Picky Assist
                  </h2>
                </div>
                <p className="text-xs text-charcoal-muted">
                  Paste this URL into Picky Assist Smart Automation / Webhooks. When someone buys a product, Picky Assist calls this URL to update your database.
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

            {/* URL Display Rows */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mt-4">
              {/* Primary Live Webhook */}
              <div className="p-3.5 rounded-xl bg-white border border-emerald-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                      LIVE ORDERS
                    </span>
                    <span className="text-xs font-bold text-charcoal">Inventory Webhook</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-mono font-bold">POST</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                  <code className="flex-1 truncate">{liveWebhookUrl}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(liveWebhookUrl, 'live')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl === 'live' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-charcoal-muted">
                  Give this to Picky Assist for WhatsApp purchase orders. Automatically deducts database stock for the exact size variant.
                </p>
              </div>

              {/* Search Response Callback Webhook */}
              <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                      SEARCH CALLBACK
                    </span>
                    <span className="text-xs font-bold text-charcoal">Search Response URL</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-mono font-bold">POST / GET</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-amber-300 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                  <code className="flex-1 truncate">{searchCallbackUrl}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(searchCallbackUrl, 'search_callback')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl === 'search_callback' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-charcoal-muted">
                  Give this to Picky Assist when asked for a callback URL to return search results back to check product existence before creating/updating.
                </p>
              </div>

              {/* Inspector / Test Webhook */}
              <div className="p-3.5 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                      DEV / TEST CATCHER
                    </span>
                    <span className="text-xs font-bold text-charcoal">Inspector Sandbox</span>
                  </div>
                  <span className="text-[10px] text-blue-700 font-mono font-bold">ALL</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 text-blue-300 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                  <code className="flex-1 truncate">{testWebhookUrl}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(testWebhookUrl, 'test')}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl === 'test' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-charcoal-muted">
                  Dedicated sandbox route that records any incoming webhook format for payload mapping inspection.
                </p>
              </div>
            </div>

            {/* Quick Setup Guide Collapse */}
            <div className="mt-4 p-3 rounded-xl bg-cream-light/60 border border-cream-border text-xs text-charcoal space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-accent">
                <CheckCircle2 className="w-3.5 h-3.5" /> How to configure in Picky Assist:
              </span>
              <p className="text-[11px] text-charcoal-muted leading-relaxed">
                1. In Picky Assist, open <strong>Smart Automation / Bot Builder</strong> → Add Step: <strong>Push Webhook</strong>.<br />
                2. Set <strong>Method: POST</strong> and URL to: <code className="text-accent font-semibold">{liveWebhookUrl}</code>.<br />
                3. Choose <strong>application/json</strong> or <strong>application/x-www-form-urlencoded</strong>.<br />
                4. When an order is placed on WhatsApp, the webhook fires, deducts quantity in your database, logs an audit entry, and shows up below in real time!
              </p>
            </div>
          </Card>

          {/* Main Inspector & Mapping Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: List of Captured Requests (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" /> Captured Webhooks ({logs.length})
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

              {logs.length === 0 ? (
                <Card className="p-8 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-cream-light flex items-center justify-center mx-auto text-charcoal-muted">
                    <Globe className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-charcoal font-semibold">No Inbound Webhooks Captured Yet</p>
                  <p className="text-[11px] text-charcoal-muted">
                    Point your Picky Assist automation to the webhook URL above, or click below to simulate an order right now.
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
                  {logs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const actionTaken = log.mappingResult?.actionTaken;
                    const isSuccess = log.mappingResult?.success;
                    const orderRef = log.mappingResult?.orderMeta?.orderId || log.body?.order_id || log.body?.order_reference;

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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            log.method === 'POST' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {log.method}
                          </span>
                          <span className="text-[10px] text-charcoal-muted">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-charcoal truncate text-[11px]">
                            {orderRef ? `Order ${orderRef}` : (log.detectedType || 'Webhook Event')}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                            actionTaken === 'INVENTORY_DEDUCTED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : actionTaken === 'SIMULATED'
                              ? 'bg-purple-100 text-purple-800'
                              : actionTaken === 'PRODUCTS_NOT_FOUND'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {actionTaken === 'INVENTORY_DEDUCTED'
                              ? 'Deducted'
                              : actionTaken === 'SIMULATED'
                              ? 'Simulated'
                              : actionTaken === 'PRODUCTS_NOT_FOUND'
                              ? 'Not Found'
                              : 'Captured'}
                          </span>
                        </div>

                        <p className="text-[10px] text-charcoal-muted truncate">
                          {log.mappingResult?.summaryMessage || log.url}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Deep Data Mapper & Payload Inspector (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {selectedLog ? (
                <Card className="p-5 shadow-xs space-y-4">
                  {/* Top Bar of Selected Request */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-cream-border gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-charcoal text-sm">
                          {selectedLog.mappingResult?.orderMeta?.orderId
                            ? `Order: ${selectedLog.mappingResult.orderMeta.orderId}`
                            : `Request ${selectedLog.id}`}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-mono bg-cream-light text-charcoal-muted">
                          {selectedLog.ip}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-muted mt-0.5">
                        Received on {new Date(selectedLog.timestamp).toLocaleString()} • URL: <code className="font-mono text-accent">{selectedLog.url}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleExecuteDeduction(false)}
                        disabled={executingDeduction}
                        className="px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        title="Replay or execute DB deduction right now"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{executingDeduction ? 'Processing...' : 'Deduct on DB'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(selectedLog.body, null, 2), 'payload')}
                        className="px-2.5 py-1.5 bg-white hover:bg-cream-light border border-cream-border text-charcoal rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Copy raw body JSON"
                      >
                        {copiedUrl === 'payload' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy JSON</span>
                      </button>
                    </div>
                  </div>

                  {executionMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{executionMessage}</span>
                    </div>
                  )}

                  {/* Inspector Sub-Tabs */}
                  <div className="flex items-center gap-2 border-b border-cream-border pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveInspectorSubTab('mapping')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorSubTab === 'mapping'
                          ? 'bg-charcoal text-white'
                          : 'text-charcoal hover:bg-cream-light'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Field Mapping Breakdown</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInspectorSubTab('db_impact')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorSubTab === 'db_impact'
                          ? 'bg-charcoal text-white'
                          : 'text-charcoal hover:bg-cream-light'
                      }`}
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Database Stock Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveInspectorSubTab('raw_payload')}
                      className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer ${
                        activeInspectorSubTab === 'raw_payload'
                          ? 'bg-charcoal text-white'
                          : 'text-charcoal hover:bg-cream-light'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Raw Payload & Headers</span>
                    </button>
                  </div>

                  {/* ── Sub-Tab 1: Field Mapping Breakdown Table ── */}
                  {activeInspectorSubTab === 'mapping' && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
                        <Eye className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block">How Incoming Fields Map to Your Database:</span>
                          <span className="text-[11px] text-blue-800">
                            The engine extracts product codes, sizes, and quantities from Picky Assist and maps them to the appropriate columns in your PostgreSQL database.
                          </span>
                        </div>
                      </div>

                      {/* Visual Mapping Table */}
                      <div className="border border-cream-border rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-cream-light text-[11px] font-bold text-charcoal uppercase tracking-wider border-b border-cream-border">
                            <tr>
                              <th className="py-2.5 px-3">Incoming Field (Picky Assist)</th>
                              <th className="py-2.5 px-3">Received Value</th>
                              <th className="py-2.5 px-3">Target Database Field</th>
                              <th className="py-2.5 px-3 text-right">Match Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cream-border bg-white font-mono">
                            {selectedLog.mappingResult?.fieldMappings && selectedLog.mappingResult.fieldMappings.length > 0 ? (
                              selectedLog.mappingResult.fieldMappings.map((entry: any, i: number) => (
                                <tr key={i} className="hover:bg-cream-light/40 transition-colors">
                                  <td className="py-2 px-3 text-emerald-800 font-bold">
                                    {entry.sourceField}
                                  </td>
                                  <td className="py-2 px-3 text-charcoal font-semibold max-w-[180px] truncate" title={String(entry.sourceValue)}>
                                    {typeof entry.sourceValue === 'object' ? JSON.stringify(entry.sourceValue) : String(entry.sourceValue)}
                                  </td>
                                  <td className="py-2 px-3 text-accent font-medium">
                                    {entry.targetDbField}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                      entry.matchStatus === 'matched'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : entry.matchStatus === 'fallback'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {entry.matchStatus === 'matched' && <Check className="w-3 h-3" />}
                                      {entry.matchStatus}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="p-4 text-center text-charcoal-muted italic">
                                  No fields mapped yet. If this was an empty ping, send an order using the simulator button above.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Sub-Tab 2: Database Stock Impact ── */}
                  {activeInspectorSubTab === 'db_impact' && (
                    <div className="space-y-4">
                      {selectedLog.mappingResult?.itemsProcessed && selectedLog.mappingResult.itemsProcessed.length > 0 ? (
                        <div className="space-y-3">
                          {selectedLog.mappingResult.itemsProcessed.map((item: any, i: number) => {
                            const p = item.product;
                            return (
                              <div key={i} className="p-4 rounded-xl border border-cream-border bg-white shadow-2xs space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    {p?.coverImageUrl ? (
                                      <img
                                        src={p.coverImageUrl}
                                        alt={p.productName}
                                        className="w-12 h-14 object-cover rounded-lg border border-cream-border shrink-0 bg-cream-light"
                                      />
                                    ) : (
                                      <div className="w-12 h-14 rounded-lg bg-cream-light border border-cream-border flex items-center justify-center text-charcoal-muted shrink-0">
                                        <ShoppingBag className="w-5 h-5" />
                                      </div>
                                    )}
                                    <div>
                                      <h4 className="font-bold text-xs text-charcoal">
                                        {p?.productName || item.stockCodeRequested}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-charcoal-muted">
                                        <span>Identifier: <strong className="text-charcoal">{item.stockCodeRequested}</strong></span>
                                        {item.sizeRequested && (
                                          <span className="px-1.5 py-0.2 bg-cream-light rounded text-accent font-bold">
                                            Size: {item.sizeRequested}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.status === 'deducted'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : item.status === 'simulated'
                                      ? 'bg-purple-100 text-purple-800'
                                      : item.status === 'insufficient_stock'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {item.status.toUpperCase()}
                                  </span>
                                </div>

                                {p && (
                                  <div className="grid grid-cols-3 gap-2 p-3 bg-cream-light/60 rounded-xl text-center text-xs">
                                    <div>
                                      <span className="text-[10px] text-charcoal-muted block">Stock Before</span>
                                      <span className="font-bold text-charcoal text-sm">{p.oldQuantity}</span>
                                    </div>
                                    <div className="text-emerald-700 font-bold flex flex-col items-center justify-center">
                                      <span className="text-[10px] text-emerald-600 block">Deduction</span>
                                      <span className="text-sm">-{item.quantityRequested}</span>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-charcoal-muted block">Stock After</span>
                                      <span className="font-bold text-accent text-sm">{p.newQuantity}</span>
                                    </div>
                                  </div>
                                )}

                                {p?.sizeBreakdown && Object.keys(p.sizeBreakdown).length > 0 && (
                                  <div className="text-[11px]">
                                    <span className="text-charcoal-muted block font-semibold mb-1">Size Breakdown Status:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {Object.entries(p.sizeBreakdown).map(([sz, info]: any) => (
                                        <span key={sz} className="px-2 py-0.5 rounded bg-cream-light border border-cream-border font-mono text-[10px]">
                                          <strong>{sz}</strong>: {typeof info === 'number' ? info : (info?.quantity ?? 0)}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <p className="text-[11px] text-charcoal-muted italic">
                                  {item.reason}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-charcoal-muted italic">
                          No product items were processed in this webhook request.
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Sub-Tab 3: Raw Payload & Headers ── */}
                  {activeInspectorSubTab === 'raw_payload' && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-bold text-charcoal uppercase tracking-wider">
                            Received Payload Body (JSON)
                          </label>
                          <span className="text-[10px] text-charcoal-muted font-mono">
                            Content-Type: {selectedLog.headers?.['content-type'] || 'application/json'}
                          </span>
                        </div>
                        <pre className="p-3 bg-[#0d1117] text-[#58a6ff] rounded-xl font-mono text-xs overflow-x-auto max-h-[300px] whitespace-pre-wrap border border-slate-800">
                          <code>{JSON.stringify(selectedLog.body, null, 2)}</code>
                        </pre>
                      </div>

                      {selectedLog.rawBody && selectedLog.rawBody !== JSON.stringify(selectedLog.body, null, 2) && (
                        <div>
                          <label className="text-[11px] font-bold text-charcoal uppercase tracking-wider block mb-1.5">
                            Raw Text Body as received over HTTP
                          </label>
                          <pre className="p-3 bg-slate-900 text-slate-300 rounded-xl font-mono text-xs overflow-x-auto max-h-[150px] whitespace-pre-wrap border border-slate-800">
                            <code>{selectedLog.rawBody}</code>
                          </pre>
                        </div>
                      )}

                      <div>
                        <label className="text-[11px] font-bold text-charcoal uppercase tracking-wider block mb-1.5">
                          HTTP Headers
                        </label>
                        <pre className="p-3 bg-cream-light/60 text-charcoal rounded-xl font-mono text-[11px] overflow-x-auto max-h-[150px] border border-cream-border">
                          <code>{JSON.stringify(selectedLog.headers, null, 2)}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-10 text-center text-xs text-charcoal-muted">
                  Select a webhook request from the left list to inspect its field mapping.
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: OUTBOUND PRODUCT SYNC & SEARCH (Existing Tool)                       */}
      {/* ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'outbound_sync' && (
        <div className="space-y-6">
          {/* Outbound Connector Status */}
          <Card className="p-4 border-cream-border bg-white shadow-xs">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted mb-2.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-accent" /> Configured Outbound Webhooks (.env.local)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-cream-light/60 border border-cream-border">
                <span className="font-bold text-charcoal block text-xs mb-0.5">1. Search Webhook</span>
                <span className="text-[10px] text-charcoal-muted block font-mono">PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL</span>
                <p className="font-mono text-[11px] mt-1.5 truncate" title={envInfo?.searchUrl || 'Not set'}>
                  {envInfo?.searchUrl ? <span className="text-emerald-700 font-semibold">{envInfo.searchUrl}</span> : <span className="text-amber-600 font-semibold italic">Not configured</span>}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-cream-light/60 border border-cream-border">
                <span className="font-bold text-charcoal block text-xs mb-0.5">2. Add Webhook</span>
                <span className="text-[10px] text-charcoal-muted block font-mono">PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL</span>
                <p className="font-mono text-[11px] mt-1.5 truncate" title={envInfo?.addUrl || 'Not set'}>
                  {envInfo?.addUrl ? <span className="text-emerald-700 font-semibold">{envInfo.addUrl}</span> : <span className="text-amber-600 font-semibold italic">Not configured</span>}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-cream-light/60 border border-cream-border">
                <span className="font-bold text-charcoal block text-xs mb-0.5">3. Update Webhook</span>
                <span className="text-[10px] text-charcoal-muted block font-mono">PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL</span>
                <p className="font-mono text-[11px] mt-1.5 truncate" title={envInfo?.updateUrl || 'Not set'}>
                  {envInfo?.updateUrl ? <span className="text-emerald-700 font-semibold">{envInfo.updateUrl}</span> : <span className="text-amber-600 font-semibold italic">Not configured</span>}
                </p>
              </div>
            </div>
            
            {/* Picky Assist Inbound Callback URL Required for Search */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white tracking-wider uppercase">
                      Required for Picky Assist Search
                    </span>
                    <span className="text-xs font-bold text-charcoal">Inbound Search Response Callback URL</span>
                  </div>
                  <p className="text-xs text-charcoal-muted">
                    When Picky Assist executes a product search via <code>PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL</code>, it requires a callback URL to return the matched product records. Give Picky Assist this URL:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(searchCallbackUrl, 'search_callback_tab2')}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs transition-all"
                >
                  {copiedUrl === 'search_callback_tab2' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedUrl === 'search_callback_tab2' ? 'Copied URL!' : 'Copy Callback URL'}</span>
                </button>
              </div>
              <div className="mt-2.5 flex items-center gap-2 bg-slate-900 text-amber-300 p-2.5 rounded-lg font-mono text-xs overflow-x-auto">
                <code className="flex-1 truncate">{searchCallbackUrl}</code>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Outbound form */}
            <div className="lg:col-span-5 space-y-5">
              <Card className="p-5 shadow-xs">
                <form onSubmit={handleOutboundSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal uppercase tracking-wider mb-2">
                      Choose Outbound Action
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAction('sync')}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          action === 'sync'
                            ? 'bg-accent text-white border-accent shadow-xs'
                            : 'bg-white text-charcoal border-cream-border hover:border-accent'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Smart Sync</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAction('search')}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          action === 'search'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-charcoal border-cream-border hover:border-blue-600'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Search Connector</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAction('add')}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          action === 'add'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-charcoal border-cream-border hover:border-emerald-600'
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Direct Add</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAction('update')}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          action === 'update'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-charcoal border-cream-border hover:border-purple-600'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Direct Update</span>
                      </button>
                    </div>
                  </div>

                  {/* Load from DB */}
                  <div className="p-3 rounded-xl bg-cream-light/60 border border-cream-border space-y-1.5">
                    <label className="block text-[11px] font-bold text-charcoal flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-accent" /> Load Product from Database
                    </label>
                    <select
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        const selected = products.find((p) => p.id === id);
                        if (selected) {
                          setPayloadText(JSON.stringify(selected, null, 2));
                          setSearchIdentifier(selected.stockCode || selected.code1 || selected.id);
                        }
                      }}
                      className="w-full p-2 bg-white border border-cream-border rounded-lg text-xs font-medium text-charcoal focus:outline-none focus:border-accent"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {loadingProducts ? 'Loading products...' : 'Select a product to populate JSON...'}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.stockCode} — {p.productName || p.title || 'Unnamed'} (Qty: {p.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search target input */}
                  {action === 'search' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-charcoal">
                        Search Identifier (Stock Code / Barcode / Code1)
                      </label>
                      <input
                        type="text"
                        value={searchIdentifier}
                        onChange={(e) => setSearchIdentifier(e.target.value)}
                        placeholder="e.g. saree-05-cherry-red or 5150000065"
                        className="w-full px-3 py-2 border border-cream-border rounded-xl text-xs font-mono font-bold bg-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* JSON Payload editor */}
                  {action !== 'search' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-charcoal">Payload JSON</label>
                        <span className="text-[10px] text-charcoal-muted">Editable preview</span>
                      </div>
                      <textarea
                        rows={10}
                        value={payloadText}
                        onChange={(e) => setPayloadText(e.target.value)}
                        className="w-full p-3 border border-slate-700 rounded-xl font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loadingOutbound}
                    className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    {loadingOutbound ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Executing {action}...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Run {action.toUpperCase()} Action</span>
                      </>
                    )}
                  </button>
                </form>
              </Card>
            </div>

            {/* Right: Response box */}
            <div className="lg:col-span-7">
              <Card className="p-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-muted mb-3 flex items-center justify-between">
                  <span>Execution Output</span>
                  {response && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        response.error || response.success === false
                          ? 'bg-red-100 text-red-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {response.error || response.success === false ? 'Failed' : 'Success'}
                    </span>
                  )}
                </h2>

                {response ? (
                  <div className="space-y-3">
                    {response.message && (
                      <div
                        className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                          response.error || response.success === false
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {response.error || response.success === false ? (
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        )}
                        <span>{response.message || response.error}</span>
                      </div>
                    )}

                    {response.diff && Object.keys(response.diff).length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                        <span className="font-bold text-amber-900 block mb-1">Differences Detected (Diff):</span>
                        <pre className="font-mono text-[11px] overflow-x-auto text-amber-950">
                          {JSON.stringify(response.diff, null, 2)}
                        </pre>
                      </div>
                    )}

                    <div className="relative">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 rounded-t-xl border-b border-slate-700 text-[10px] text-slate-400 font-mono">
                        <span>JSON Response</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(JSON.stringify(response, null, 2), 'resp')}
                          className="hover:text-white transition-colors cursor-pointer text-[10px]"
                        >
                          {copiedUrl === 'resp' ? 'Copied' : 'Copy JSON'}
                        </button>
                      </div>
                      <pre className="p-4 bg-[#0d1117] text-[#58a6ff] rounded-b-xl text-xs font-mono overflow-x-auto max-h-[420px] whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                        <code>{JSON.stringify(response, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 border border-dashed border-cream-border rounded-xl text-center text-xs text-charcoal-muted">
                    Run an outbound action on the left to see the live output from Picky Assist.
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-cream-border space-y-4">
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
                <label className="font-bold text-charcoal block">
                  Select Product from Database
                </label>
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
                  <label className="font-bold text-charcoal block">Size Variant (Optional)</label>
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
