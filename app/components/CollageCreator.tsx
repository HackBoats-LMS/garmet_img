'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Download, LayoutGrid, Layers, AlignCenter, AlignLeft, Move,
  Image as ImageIcon, Palette, Type, ChevronDown, Share2,
  MessageSquare, Globe, Check
} from 'lucide-react';

interface CollageImage {
  id: string;
  url: string;
  poseName: string;
}

interface CollageLayout {
  id: string;
  name: string;
  icon: string;
  cols: number;
  rows: number;
  grid: { col: number; row: number; colSpan: number; rowSpan: number }[];
  aspectRatio: number; // width/height
}

const LAYOUTS: CollageLayout[] = [
  {
    id: '2x1', name: '2 Side by Side', icon: '⬜⬜', cols: 2, rows: 1,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
    ],
    aspectRatio: 16 / 9,
  },
  {
    id: '3x1', name: '3 in a Row', icon: '⬜⬜⬜', cols: 3, rows: 1,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 2, row: 0, colSpan: 1, rowSpan: 1 },
    ],
    aspectRatio: 3 / 1,
  },
  {
    id: '2x2', name: '2×2 Grid', icon: '▪▪\n▪▪', cols: 2, rows: 2,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
    ],
    aspectRatio: 1,
  },
  {
    id: '1+2', name: 'Feature + 2', icon: '🔲▪\n  ▪', cols: 2, rows: 2,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 2 }, // large left
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 }, // small top right
      { col: 1, row: 1, colSpan: 1, rowSpan: 1 }, // small bottom right
    ],
    aspectRatio: 4 / 3,
  },
  {
    id: '2+1', name: 'Wide + Feature', icon: '▪▪\n🔲', cols: 2, rows: 2,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, // small top left
      { col: 1, row: 0, colSpan: 1, rowSpan: 1 }, // small top right
      { col: 0, row: 1, colSpan: 2, rowSpan: 1 }, // wide bottom
    ],
    aspectRatio: 4 / 3,
  },
  {
    id: '1x3', name: '3 Stacked', icon: '⬜\n⬜\n⬜', cols: 1, rows: 3,
    grid: [
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 1, colSpan: 1, rowSpan: 1 },
      { col: 0, row: 2, colSpan: 1, rowSpan: 1 },
    ],
    aspectRatio: 9 / 16,
  },
];

const PLATFORM_PRESETS = [
  { id: 'instagram-square', name: 'Instagram Post', width: 1080, height: 1080, icon: '📸' },
  { id: 'instagram-story', name: 'Instagram Story', width: 1080, height: 1920, icon: '📱' },
  { id: 'whatsapp', name: 'WhatsApp', width: 1200, height: 630, icon: '💬' },
  { id: 'facebook', name: 'Facebook', width: 1200, height: 628, icon: '👍' },
];

const GAP = 8; // px gap between images

interface Props {
  images: CollageImage[];
  productName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CollageCreator({ images, productName, isOpen, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedLayout, setSelectedLayout] = useState<CollageLayout>(LAYOUTS[2]); // default 2x2
  const [assignedImages, setAssignedImages] = useState<(CollageImage | null)[]>([]);
  const [showBrandText, setShowBrandText] = useState(true);
  const [brandText, setBrandText] = useState(productName);
  const [bgColor, setBgColor] = useState('#1a1a1a');
  const [selectedPlatform, setSelectedPlatform] = useState(PLATFORM_PRESETS[0]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Initialize assigned images when layout or images change
  useEffect(() => {
    const slots = selectedLayout.grid.length;
    const initial: (CollageImage | null)[] = [];
    for (let i = 0; i < slots; i++) {
      initial.push(images[i] || null);
    }
    setAssignedImages(initial);
  }, [selectedLayout, images]);

  // Re-render preview whenever settings change
  useEffect(() => {
    if (!isOpen) return;
    renderPreview();
  }, [assignedImages, selectedLayout, showBrandText, brandText, bgColor, selectedPlatform, isOpen]);

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  const renderToCanvas = async (
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const layout = selectedLayout;
    const cellW = (width - GAP * (layout.cols - 1)) / layout.cols;
    const cellH = (height - GAP * (layout.rows - 1) - (showBrandText ? 60 : 0)) / layout.rows;

    for (let i = 0; i < layout.grid.length; i++) {
      const cell = layout.grid[i];
      const img = assignedImages[i];
      if (!img?.url) continue;

      const x = cell.col * (cellW + GAP);
      const y = cell.row * (cellH + GAP);
      const w = cellW * cell.colSpan + GAP * (cell.colSpan - 1);
      const h = cellH * cell.rowSpan + GAP * (cell.rowSpan - 1);

      try {
        const imgEl = await loadImage(img.url);
        // Cover-fit image
        const scale = Math.max(w / imgEl.width, h / imgEl.height);
        const sw = w / scale;
        const sh = h / scale;
        const sx = (imgEl.width - sw) / 2;
        const sy = (imgEl.height - sh) / 2;

        ctx.save();
        // Rounded corners
        const radius = 8;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(imgEl, sx, sy, sw, sh, x, y, w, h);
        ctx.restore();
      } catch {
        // Draw placeholder
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, y, w, h);
      }
    }

    // Brand text overlay
    if (showBrandText && brandText) {
      const textY = height - 45;
      const textX = width / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, height - 60, width, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(width * 0.03)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(brandText, textX, textY);
    }
  };

  const renderPreview = useCallback(async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const previewW = 600;
    const previewH = Math.round(previewW / selectedLayout.aspectRatio);
    await renderToCanvas(canvas, previewW, previewH);
  }, [assignedImages, selectedLayout, showBrandText, brandText, bgColor]);

  const handleDownload = async () => {
    setIsRendering(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      await renderToCanvas(canvas, selectedPlatform.width, selectedPlatform.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${productName.replace(/\s+/g, '_')}_collage_${selectedPlatform.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDragStart = (idx: number) => setDragFrom(idx);

  const handleDrop = (idx: number) => {
    if (dragFrom === null || dragFrom === idx) return;
    const updated = [...assignedImages];
    const temp = updated[dragFrom];
    updated[dragFrom] = updated[idx];
    updated[idx] = temp;
    setAssignedImages(updated);
    setDragFrom(null);
  };

  const handleAssignImage = (slotIdx: number, img: CollageImage) => {
    const updated = [...assignedImages];
    updated[slotIdx] = img;
    setAssignedImages(updated);
  };

  const handleClearSlot = (slotIdx: number) => {
    const updated = [...assignedImages];
    updated[slotIdx] = null;
    setAssignedImages(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl text-white">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow">
              <LayoutGrid className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Collage Creator</h2>
              <p className="text-xs text-zinc-400">Build shareable collages for any platform</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Controls */}
          <div className="w-72 border-r border-zinc-800 flex flex-col overflow-y-auto shrink-0 p-4 space-y-5">

            {/* Layout Selector */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Layout</h3>
              <div className="grid grid-cols-3 gap-2">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedLayout(layout)}
                    className={`p-2.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer text-center leading-tight ${
                      selectedLayout.id === layout.id
                        ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    <span className="block text-lg mb-1">{layout.icon}</span>
                    {layout.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Slot Assignment */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
                Slot Assignment ({assignedImages.filter(Boolean).length}/{selectedLayout.grid.length})
              </h3>
              <div className="space-y-2">
                {selectedLayout.grid.map((_, slotIdx) => {
                  const assigned = assignedImages[slotIdx];
                  return (
                    <div
                      key={slotIdx}
                      className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800"
                      draggable={!!assigned}
                      onDragStart={() => assigned && handleDragStart(slotIdx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(slotIdx)}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0 flex items-center justify-center">
                        {assigned ? (
                          <img src={assigned.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-zinc-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-300 truncate">
                          Slot {slotIdx + 1}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {assigned?.poseName || 'Empty — drag image here'}
                        </p>
                      </div>
                      {assigned && (
                        <button
                          onClick={() => handleClearSlot(slotIdx)}
                          className="p-1 rounded-lg text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Available Images to drag */}
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-3 mb-2">
                Available Images (drag to slot)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className="aspect-square rounded-lg overflow-hidden border border-zinc-700 cursor-grab active:cursor-grabbing bg-zinc-900"
                    draggable
                    onDragStart={() => {
                      // Find first empty slot and assign
                      const emptyIdx = assignedImages.findIndex((a) => !a);
                      if (emptyIdx !== -1) {
                        const updated = [...assignedImages];
                        updated[emptyIdx] = img;
                        setAssignedImages(updated);
                      }
                    }}
                    onClick={() => {
                      const emptyIdx = assignedImages.findIndex((a) => !a);
                      if (emptyIdx !== -1) {
                        handleAssignImage(emptyIdx, img);
                      }
                    }}
                    title={`Click to add: ${img.poseName}`}
                  >
                    <img src={img.url} alt={img.poseName} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Background Color */}
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Background</h3>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
                />
                <div className="flex gap-1.5">
                  {['#1a1a1a', '#ffffff', '#f5f0e8', '#1e293b', '#fdf6f0'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${bgColor === c ? 'border-violet-400 scale-110' : 'border-zinc-700'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Brand Text */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Brand Text</h3>
                <button
                  onClick={() => setShowBrandText((v) => !v)}
                  className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${showBrandText ? 'bg-violet-600' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showBrandText ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {showBrandText && (
                <input
                  value={brandText}
                  onChange={(e) => setBrandText(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-violet-500"
                  placeholder="Brand name or caption..."
                />
              )}
            </div>
          </div>

          {/* Right: Preview + Platform + Download */}
          <div className="flex-1 flex flex-col overflow-hidden p-5 gap-5">
            {/* Platform Selector */}
            <div className="shrink-0">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Export Format</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {PLATFORM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPlatform(preset)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      selectedPlatform.id === preset.id
                        ? 'bg-violet-600/20 border-violet-500 text-violet-200'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                    <span className="text-[10px] opacity-60">
                      {preset.width}×{preset.height}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas Preview */}
            <div className="flex-1 flex items-center justify-center bg-zinc-900/50 rounded-2xl border border-zinc-800 overflow-hidden p-4">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                style={{ imageRendering: 'auto' }}
              />
            </div>

            {/* Hidden full-res canvas */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Download Button */}
            <div className="shrink-0 flex gap-3">
              <button
                onClick={handleDownload}
                disabled={isRendering || assignedImages.filter(Boolean).length === 0}
                className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRendering ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : downloaded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Downloaded!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download {selectedPlatform.name} Collage</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3.5 rounded-xl font-medium text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
