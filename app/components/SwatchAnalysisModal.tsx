'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
  Sparkles,
  Layers,
  FileText,
  Code,
  ShieldAlert,
  ArrowRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { Button } from './ui/Button';

export interface SwatchAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  swatchAnalysis: any | null;
  scanError: { message: string; raw?: string; status?: number; provider?: string } | null;
  swatchImageUrl?: string;
  currentProvider: 'kie' | 'google';
  onRescan: (provider?: 'kie' | 'google') => void;
  isScanning: boolean;
}

export const SwatchAnalysisModal: React.FC<SwatchAnalysisModalProps> = ({
  isOpen,
  onClose,
  swatchAnalysis,
  scanError,
  swatchImageUrl,
  currentProvider,
  onRescan,
  isScanning,
}) => {
  const [activeTab, setActiveTab] = useState<'motifs' | 'directive' | 'json' | 'error'>(
    scanError && !swatchAnalysis ? 'error' : 'motifs'
  );
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const vision = swatchAnalysis?.vision;
  const isDenseJaal =
    vision?.pattern_type === 'dense_jaal' ||
    vision?.spatial_density?.type === 'dense_jaal' ||
    vision?.spatial_density?.is_continuous_grid === true;

  const rawMotifs: any[] = vision?.body_motifs || vision?.detected_buttis || vision?.distinctMotifs || [];
  const rawBorders: any[] = vision?.border_elements || [];

  const getPatternBadge = () => {
    const pType = String(vision?.pattern_type || '').toLowerCase();
    if (pType.includes('jaal') || pType.includes('lattice') || isDenseJaal) {
      return { label: 'Continuous All-Over Jaal / Lattice', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
    }
    if (pType.includes('stripe') || pType.includes('leheriya') || pType.includes('chevron')) {
      return { label: 'Diagonal Leheriya Waves / Stripes', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
    }
    if (pType.includes('check') || pType.includes('kattam')) {
      return { label: 'Geometric Checks / Kattam Grid', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
    if (pType.includes('bandhani') || pType.includes('bandhej')) {
      return { label: 'Traditional Bandhani Micro-Dots', bg: 'bg-pink-50 text-pink-800 border-pink-200' };
    }
    if (pType.includes('medium')) {
      return { label: 'Regular Medium Repeat (~3-8cm)', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    }
    if (pType.includes('narrative') || pType.includes('folk')) {
      return { label: 'Traditional Folk / Figurative Art', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
    }
    if (pType.includes('vine') || pType.includes('bel')) {
      return { label: 'Flowing Floral Vines / Bel', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (pType.includes('plain')) {
      return { label: 'Solid Plain Body with Border', bg: 'bg-gray-50 text-gray-800 border-gray-200' };
    }
    return { label: 'Sparse Widely-Spaced Delicate Buttis', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[200] bg-charcoal/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-cream-border my-auto animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 px-6 border-b border-cream-border flex items-center justify-between bg-gradient-to-r from-cream-light via-white to-cream-light shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold text-lg shadow-2xs">
              🌸
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-base sm:text-lg font-bold text-charcoal">
                  Fabric Swatch AI Vision Output
                </h3>
                {swatchAnalysis && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Analysis Verified
                  </span>
                )}
                {scanError && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    Analysis Failed
                  </span>
                )}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-charcoal/5 text-charcoal border border-cream-border">
                  Engine: {vision?.modelUsed || (currentProvider === 'google' ? 'Google Gemini 3.6 Flash' : 'Kie.ai gemini-3-6-flash')}
                </span>
              </div>
              <p className="text-xs text-charcoal-muted mt-0.5">
                Detailed morphological inspection of detected buttis, lattice patterns, and spatial distribution rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal-muted hover:text-charcoal hover:bg-cream transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-cream-border/60 bg-white shrink-0 overflow-x-auto">
          {swatchAnalysis && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('motifs')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'motifs'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-cream text-charcoal hover:bg-cream-dark'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Motifs & Structure ({rawMotifs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('directive')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'directive'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-cream text-charcoal hover:bg-cream-dark'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Kie.ai Prompt Directive</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('json')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'json'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-cream text-charcoal hover:bg-cream-dark'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Raw JSON Response</span>
              </button>
            </>
          )}

          {scanError && (
            <button
              type="button"
              onClick={() => setActiveTab('error')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'error'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Error Telemetry</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-cream-light/30">
          {/* TAB 1: Motifs & Fabric */}
          {activeTab === 'motifs' && swatchAnalysis && (
            <div className="space-y-6">
              {/* Swatch & Fabric Overview Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Swatch Preview */}
                {swatchImageUrl && (
                  <div className="bg-white p-3 rounded-2xl border border-cream-border shadow-2xs flex flex-col items-center">
                    <span className="text-[10px] font-bold text-charcoal-muted uppercase mb-2">Analyzed Swatch</span>
                    <img
                      src={swatchImageUrl}
                      alt="Analyzed Swatch"
                      className="w-full h-36 object-cover rounded-xl border border-cream-border"
                    />
                  </div>
                )}

                {/* Fabric Background */}
                <div className={`bg-white p-4 rounded-2xl border border-cream-border shadow-2xs ${swatchImageUrl ? 'md:col-span-1' : 'md:col-span-1'}`}>
                  <span className="text-[10px] font-bold text-charcoal-muted uppercase">Fabric Ground</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-charcoal">
                      {vision?.fabric_background?.base_color || 'Authentic Fabric Ground'}
                    </span>
                  </div>
                  <p className="text-xs text-charcoal-muted mt-2 leading-relaxed">
                    <strong className="text-charcoal">Weave / Texture:</strong>{' '}
                    {vision?.fabric_background?.texture_notes || 'Smooth woven textile surface'}
                  </p>
                  {vision?.craft_technique && (
                    <p className="text-xs text-charcoal-muted mt-1.5 leading-relaxed">
                      <strong className="text-charcoal">Craft / Technique:</strong>{' '}
                      <span className="text-amber-800 font-medium">{vision.craft_technique}</span>
                    </p>
                  )}
                </div>

                {/* Pattern Density & Layout */}
                <div className={`bg-white p-4 rounded-2xl border border-cream-border shadow-2xs ${swatchImageUrl ? 'md:col-span-1' : 'md:col-span-2'}`}>
                  <span className="text-[10px] font-bold text-charcoal-muted uppercase">Pattern Architecture</span>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {(() => {
                      const badge = getPatternBadge();
                      return (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                    {vision?.spatial_density?.is_continuous_grid && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                        Continuous Grid
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-muted mt-2 leading-relaxed">
                    <strong className="text-charcoal">Spatial Spacing:</strong>{' '}
                    {vision?.spatial_density?.spacing_description ||
                      (isDenseJaal
                        ? 'Repeating framed motifs in adjacent touching cells with no wide gaps'
                        : 'Isolated buttis with approx 10x-15x negative spacing of solid base fabric')}
                  </p>
                </div>
              </div>

              {/* Detected Body Motifs Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider flex items-center gap-1.5">
                    <span>Verified Body Motifs / Buttis</span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-accent-bg text-accent">
                      {rawMotifs.length} Detected
                    </span>
                  </h4>
                  <span className="text-[11px] text-charcoal-muted">
                    {isDenseJaal ? 'Replicated systematically within jaal cells' : 'Replicated in staggered diagonal distribution'}
                  </span>
                </div>

                {rawMotifs.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-cream-border text-center text-xs text-charcoal-muted">
                    No individual body motifs detected. Uniform fabric ground detected.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {rawMotifs.map((motif, idx) => {
                      const pColors: string[] = Array.isArray(motif.primary_colors)
                        ? motif.primary_colors
                        : motif.colors || [];
                      const sColors: string[] = Array.isArray(motif.secondary_colors)
                        ? motif.secondary_colors
                        : [];

                      return (
                        <div
                          key={motif.motif_id || idx}
                          className="bg-white p-4 rounded-2xl border border-cream-border hover:border-amber-300 transition-all shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                                #{motif.motif_id || idx + 1}
                              </span>
                              <div>
                                <h5 className="font-bold text-xs text-charcoal">
                                  {motif.shape_type || motif.name || `Motif #${idx + 1}`}
                                </h5>
                                {motif.category && (
                                  <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">
                                    {motif.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {motif.scale_estimate && (
                                <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-cream text-charcoal border border-cream-border">
                                  {motif.scale_estimate}
                                </span>
                              )}
                              {motif.visibility_confidence && (
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    motif.visibility_confidence === 'high'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : motif.visibility_confidence === 'medium'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-cream text-charcoal-muted border border-cream-border'
                                  }`}
                                >
                                  {motif.visibility_confidence}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-charcoal-muted leading-relaxed">
                            {motif.structure_details || motif.anatomy || 'Detailed weave embroidery'}
                          </p>

                          {/* Color Pills */}
                          {(pColors.length > 0 || sColors.length > 0) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-cream-border/50">
                              <span className="text-[10px] font-bold text-charcoal-muted">Colors:</span>
                              {pColors.map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-cream text-charcoal border border-cream-border/60"
                                >
                                  {c}
                                </span>
                              ))}
                              {sColors.map((c, cIdx) => (
                                <span
                                  key={`sec-${cIdx}`}
                                  className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60"
                                  title="Secondary accent"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}

                          {motif.layout_arrangement && (
                            <div className="text-[11px] text-charcoal-soft/80 flex items-center gap-1">
                              <span className="text-[10px] font-bold text-charcoal-muted">Arrangement:</span>
                              <span>{motif.layout_arrangement}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Detected Border Elements (Preserved and Isolated) */}
              {rawBorders.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🛡️</span>
                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Border Selvedge Elements Isolated ({rawBorders.length})
                    </h4>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    The vision engine detected running border strips along the fabric edge. These are isolated so they are
                    <strong> NOT scattered as body buttis</strong> across the chest or pleats.
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {rawBorders.map((b, bIdx) => (
                      <div key={bIdx} className="text-xs text-charcoal bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                        <strong className="text-amber-950">{b.type || `Border #${bIdx + 1}`}:</strong> {b.description}
                        {b.colors && b.colors.length > 0 && (
                          <span className="ml-2 text-[10px] text-charcoal-muted">
                            [Colors: {Array.isArray(b.colors) ? b.colors.join(', ') : b.colors}]
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Directive */}
          {activeTab === 'directive' && swatchAnalysis && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                    Generation Prompt Directive
                  </h4>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    This exact prompt instruction is injected into Kie.ai Nano-Banana/Seedream to lock motif fidelity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(vision?.promptDirective || '', 'directive')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-cream-border hover:bg-cream text-charcoal font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  {copiedType === 'directive' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-charcoal-muted" />}
                  <span>{copiedType === 'directive' ? 'Copied Directive!' : 'Copy Directive'}</span>
                </button>
              </div>

              <div className="bg-charcoal text-amber-100 p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                {vision?.promptDirective || 'No directive generated.'}
              </div>
            </div>
          )}

          {/* TAB 3: Raw JSON */}
          {activeTab === 'json' && swatchAnalysis && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-charcoal uppercase tracking-wider">
                    Raw API JSON Payload
                  </h4>
                  <p className="text-xs text-charcoal-muted mt-0.5">
                    Full structured output returned from {vision?.modelUsed || 'the vision API'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(vision?.rawJson || vision || swatchAnalysis, null, 2),
                      'json'
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-cream-border hover:bg-cream text-charcoal font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  {copiedType === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-charcoal-muted" />}
                  <span>{copiedType === 'json' ? 'Copied JSON!' : 'Copy JSON'}</span>
                </button>
              </div>

              <div className="bg-charcoal text-emerald-300 p-5 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto max-h-[500px]">
                {JSON.stringify(vision?.rawJson || vision || swatchAnalysis, null, 2)}
              </div>
            </div>
          )}

          {/* TAB 4: Error Telemetry */}
          {(activeTab === 'error' || scanError) && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-950">
                      Swatch Analysis Encountered an Error
                    </h4>
                    <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                      {scanError?.message || 'Server exception, please try again later.'}
                    </p>
                    {scanError?.status && (
                      <p className="text-[11px] font-mono text-rose-700 mt-1">
                        HTTP Status: {scanError.status} | Provider: {scanError.provider || currentProvider}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => onRescan('kie')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Retry with Kie.ai</span>
                  </button>
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => onRescan('google')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 hover:bg-rose-100/60 font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Try with Google Gemini</span>
                  </button>
                </div>
              </div>

              {scanError?.raw && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-charcoal uppercase">Raw Server Response</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(scanError.raw || '', 'error-raw')}
                      className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedType === 'error-raw' ? 'Copied!' : 'Copy Raw Output'}
                    </button>
                  </div>
                  <pre className="bg-charcoal text-rose-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                    {scanError.raw}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-cream-border bg-white flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-charcoal-muted">
            <span>Switch Engine:</span>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => onRescan('kie')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                currentProvider === 'kie'
                  ? 'bg-amber-600 text-white'
                  : 'bg-cream text-charcoal hover:bg-cream-dark'
              }`}
            >
              Kie.ai
            </button>
            <button
              type="button"
              disabled={isScanning}
              onClick={() => onRescan('google')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                currentProvider === 'google'
                  ? 'bg-amber-600 text-white'
                  : 'bg-cream text-charcoal hover:bg-cream-dark'
              }`}
            >
              Google Gemini
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isScanning}
              onClick={() => onRescan()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Re-scan'}</span>
            </button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

