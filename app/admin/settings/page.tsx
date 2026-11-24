'use client';

import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  ExternalLink,
  MessageSquare,
  Database,
  Check,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  category: 'ai' | 'picky_assist' | 'erp';
  isSecret: boolean;
  isUrl?: boolean;
  placeholder?: string;
  isConfigured: boolean;
  source: 'database' | 'env' | 'none';
  maskedValue: string;
  updatedAt: string | null;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'ai' | 'picky_assist' | 'erp'>('all');

  // Input editing state: { [key]: typedValue }
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  // Track visibility toggles for secret fields
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  // Saving state
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Testing connection state
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || []);

        // Pre-fill input values with masked representation
        const initialInputs: Record<string, string> = {};
        (data.settings || []).forEach((s: SettingItem) => {
          initialInputs[s.key] = s.maskedValue || '';
        });
        setInputValues(initialInputs);
      } else {
        setErrorMessage('Failed to load system settings');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error fetching settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSingle(key: string) {
    const val = inputValues[key];
    if (val === undefined) return;

    setSavingKey(key);
    setSaveSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: val }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccessMessage(`Saved ${key} securely! Takes effect immediately.`);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        await fetchSettings();
      } else {
        setErrorMessage(data.error || 'Failed to save setting');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error saving setting');
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveAll() {
    setSavingAll(true);
    setSaveSuccessMessage(null);
    setErrorMessage(null);

    // Filter out values that are untouched masked values
    const changedUpdates: Record<string, string> = {};
    Object.entries(inputValues).forEach(([k, v]) => {
      if (!v.includes('••••')) {
        changedUpdates[k] = v;
      }
    });

    if (Object.keys(changedUpdates).length === 0) {
      setSaveSuccessMessage('No changes detected to save.');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      setSavingAll(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: changedUpdates }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccessMessage(data.message || 'All modified settings saved successfully!');
        setTimeout(() => setSaveSuccessMessage(null), 4000);
        await fetchSettings();
      } else {
        setErrorMessage(data.error || 'Failed to save settings');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error');
    } finally {
      setSavingAll(false);
    }
  }

  async function handleTestConnection(key: string) {
    setTestingKey(key);
    setTestResult((prev) => ({ ...prev, [key]: undefined as any }));

    try {
      const res = await fetch('/api/admin/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKey: key, testValue: inputValues[key] }),
      });
      const data = await res.json();
      setTestResult((prev) => ({
        ...prev,
        [key]: {
          success: data.success,
          message: data.success ? data.message : data.error || 'Test failed',
        },
      }));
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [key]: { success: false, message: err?.message || 'Connection test error' },
      }));
    } finally {
      setTestingKey(null);
    }
  }

  const filteredSettings = settings.filter((s) => {
    if (activeTab === 'all') return true;
    return s.category === activeTab;
  });

  return (
    <div className="space-y-8 pb-16 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-charcoal/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-accent/10 text-accent">
              <KeyRound className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-display text-charcoal">API Keys & Dynamic Settings</h1>
          </div>
          <p className="text-sm text-charcoal/60">
            Edit API keys and webhooks on the fly. Updates are encrypted with <strong>AES-256-GCM</strong> and take effect immediately with zero downtime and no rebuilds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={fetchSettings}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAll}
            disabled={savingAll || loading}
            className="flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            {savingAll ? 'Encrypting & Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{saveSuccessMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Security Info Banner */}
      <Card className="p-5 border border-accent/20 bg-accent/5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-accent/15 text-accent shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm text-charcoal/80">
            <p className="font-semibold text-charcoal">Bank-Grade Encryption at Rest (AES-256-GCM)</p>
            <p>
              Sensitive values are stored encrypted with a unique cryptographic initialization vector (IV) per record.
              If an item is empty in the database, the system safely falls back to your <code className="bg-charcoal/10 px-1 py-0.5 rounded text-charcoal">.env.local</code> file so nothing ever breaks.
            </p>
          </div>
        </div>
      </Card>

      {/* Category Tabs */}
      <div className="flex border-b border-charcoal/10 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-accent text-accent bg-white shadow-sm'
              : 'border-transparent text-charcoal/60 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          All Settings ({settings.length})
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ai'
              ? 'border-accent text-accent bg-white shadow-sm'
              : 'border-transparent text-charcoal/60 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Engines (Kie.ai & Gemini)
        </button>

        <button
          onClick={() => setActiveTab('picky_assist')}
          className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'picky_assist'
              ? 'border-accent text-accent bg-white shadow-sm'
              : 'border-transparent text-charcoal/60 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Picky Assist (WhatsApp Integration)
        </button>

        <button
          onClick={() => setActiveTab('erp')}
          className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'erp'
              ? 'border-accent text-accent bg-white shadow-sm'
              : 'border-transparent text-charcoal/60 hover:text-charcoal hover:bg-charcoal/5'
          }`}
        >
          <Database className="w-4 h-4" />
          ERP & POS Sync
        </button>
      </div>

      {/* Settings List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-charcoal/50 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-accent" />
            <p>Loading encrypted settings...</p>
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="p-8 text-center text-charcoal/50 bg-white rounded-xl border border-charcoal/10">
            No settings found in this category.
          </div>
        ) : (
          filteredSettings.map((item) => {
            const isEditing = Boolean(inputValues[item.key] && !inputValues[item.key].includes('••••'));
            const testInfo = testResult[item.key];
            const isTesting = testingKey === item.key;
            const isSavingThis = savingKey === item.key;

            return (
              <Card key={item.key} className="p-5 sm:p-6 bg-white border border-charcoal/10 shadow-sm transition-all">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Info Column */}
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-base text-charcoal">{item.label}</span>
                      <code className="text-xs bg-charcoal/5 px-2 py-0.5 rounded text-charcoal/70 font-mono">
                        {item.key}
                      </code>

                      {/* Source Badge */}
                      {item.source === 'database' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" />
                          Active (Database)
                        </span>
                      )}
                      {item.source === 'env' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          Fallback (.env)
                        </span>
                      )}
                      {item.source === 'none' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          Not Set
                        </span>
                      )}

                      {item.isSecret && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-charcoal/40 font-medium">
                          <Lock className="w-3 h-3" /> Encrypted
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-charcoal/60">{item.description}</p>
                    {item.updatedAt && (
                      <p className="text-[11px] text-charcoal/40">
                        Last saved to DB: {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Test button if applicable */}
                  <div className="flex items-center gap-2 self-start">
                    {(item.key === 'KIE_API_KEY' || item.key === 'GEMINI_API_KEY' || item.isUrl) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isTesting || (!item.isConfigured && !isEditing)}
                        onClick={() => handleTestConnection(item.key)}
                        className="text-xs whitespace-nowrap"
                      >
                        {isTesting ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="w-3 h-3 mr-1 text-accent" />
                        )}
                        Test Connection
                      </Button>
                    )}
                  </div>
                </div>

                {/* Test Feedback */}
                {testInfo && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      testInfo.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {testInfo.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{testInfo.message}</span>
                  </div>
                )}

                {/* Input + Action Row */}
                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type={item.isSecret && !showSecret[item.key] ? 'password' : 'text'}
                      value={inputValues[item.key] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInputValues((prev) => ({ ...prev, [item.key]: val }));
                      }}
                      placeholder={item.placeholder || 'Enter value...'}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-charcoal/20 bg-charcoal/[0.02] text-sm text-charcoal font-mono placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-accent focus:bg-white transition-all pr-10"
                    />

                    {item.isSecret && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecret((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40 hover:text-charcoal p-1"
                        title={showSecret[item.key] ? 'Hide' : 'Reveal'}
                      >
                        {showSecret[item.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isSavingThis || !isEditing}
                    onClick={() => handleSaveSingle(item.key)}
                    className="whitespace-nowrap px-4 py-2.5"
                  >
                    {isSavingThis ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
