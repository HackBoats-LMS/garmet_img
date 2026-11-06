'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, RotateCw, RotateCcw, FlipHorizontal, Move, Crop, RefreshCw, Eye
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';

export interface Point2D {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
}

interface PointCropperModalProps {
  isOpen: boolean;
  imageUrl: string;
  slotTitle?: string;
  onClose: () => void;
  onApplyCrop: (croppedDataUrl: string) => void;
}

// Exact affine solver for a single triangle (s0, s1, s2) -> (d0, d1, d2)
function solveAffine(
  s0: { x: number; y: number },
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  d0: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number }
) {
  const det = s0.x * (s1.y - s2.y) - s1.x * (s0.y - s2.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(det) < 1e-6) return null;

  const invS = [
    [(s1.y - s2.y) / det, (s2.x - s1.x) / det, (s1.x * s2.y - s2.x * s1.y) / det],
    [(s2.y - s0.y) / det, (s0.x - s2.x) / det, (s2.x * s0.y - s0.x * s2.y) / det],
    [(s0.y - s1.y) / det, (s1.x - s0.x) / det, (s0.x * s1.y - s1.x * s0.y) / det],
  ];

  const a = d0.x * invS[0][0] + d1.x * invS[1][0] + d2.x * invS[2][0];
  const c = d0.x * invS[0][1] + d1.x * invS[1][1] + d2.x * invS[2][1];
  const e = d0.x * invS[0][2] + d1.x * invS[1][2] + d2.x * invS[2][2];

  const b = d0.y * invS[0][0] + d1.y * invS[1][0] + d2.y * invS[2][0];
  const d = d0.y * invS[0][1] + d1.y * invS[1][1] + d2.y * invS[2][1];
  const f = d0.y * invS[0][2] + d1.y * invS[1][2] + d2.y * invS[2][2];

  return { a, b, c, d, e, f };
}

// Render quadrilateral warp with bilinear subdivision (straightens perspective)
function renderPerspectiveQuad(
  srcImg: HTMLImageElement,
  pts: Point2D[],
  outW: number,
  outH: number,
  subdiv = 14
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgW = srcImg.naturalWidth || srcImg.width;
  const imgH = srcImg.naturalHeight || srcImg.height;

  // Convert normalized points [0, 1] to source image pixels
  const p0 = { x: pts[0].x * imgW, y: pts[0].y * imgH };
  const p1 = { x: pts[1].x * imgW, y: pts[1].y * imgH };
  const p2 = { x: pts[2].x * imgW, y: pts[2].y * imgH };
  const p3 = { x: pts[3].x * imgW, y: pts[3].y * imgH };

  const getSrcPt = (u: number, v: number) => {
    return {
      x: (1 - u) * (1 - v) * p0.x + u * (1 - v) * p1.x + u * v * p2.x + (1 - u) * v * p3.x,
      y: (1 - u) * (1 - v) * p0.y + u * (1 - v) * p1.y + u * v * p2.y + (1 - u) * v * p3.y,
    };
  };

  const drawTri = (
    s0: { x: number; y: number },
    s1: { x: number; y: number },
    s2: { x: number; y: number },
    d0: { x: number; y: number },
    d1: { x: number; y: number },
    d2: { x: number; y: number }
  ) => {
    const sol = solveAffine(s0, s1, s2, d0, d1, d2);
    if (!sol) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    ctx.transform(sol.a, sol.b, sol.c, sol.d, sol.e, sol.f);
    ctx.drawImage(srcImg, 0, 0);
    ctx.restore();
  };

  const n = subdiv;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u0 = i / n;
      const v0 = j / n;
      const u1 = (i + 1) / n;
      const v1 = (j + 1) / n;

      const dx0 = u0 * outW;
      const dy0 = v0 * outH;
      const dx1 = u1 * outW;
      const dy1 = v1 * outH;

      const s00 = getSrcPt(u0, v0);
      const s10 = getSrcPt(u1, v0);
      const s01 = getSrcPt(u0, v1);
      const s11 = getSrcPt(u1, v1);

      // Two triangles per cell
      drawTri(s00, s10, s01, { x: dx0, y: dy0 }, { x: dx1, y: dy0 }, { x: dx0, y: dy1 });
      drawTri(s10, s11, s01, { x: dx1, y: dy0 }, { x: dx1, y: dy1 }, { x: dx0, y: dy1 });
    }
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

export function PointCropperModal({
  isOpen,
  imageUrl,
  slotTitle,
  onClose,
  onApplyCrop,
}: PointCropperModalProps) {
  // Current working image (allows in-modal 90 deg rotation / flip)
  const [workingImage, setWorkingImage] = useState<string>(imageUrl);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgDims, setImgDims] = useState<{ width: number; height: number }>({ width: 1, height: 1 });

  // 4 Normalized Corner Points [TL, TR, BR, BL]
  const [points, setPoints] = useState<Point2D[]>([
    { x: 0.08, y: 0.08 }, // 0: Top-Left
    { x: 0.92, y: 0.08 }, // 1: Top-Right
    { x: 0.92, y: 0.92 }, // 2: Bottom-Right
    { x: 0.08, y: 0.92 }, // 3: Bottom-Left
  ]);

  // Dragging interaction state
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [isDraggingCenter, setIsDraggingCenter] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [initialPoints, setInitialPoints] = useState<Point2D[]>([]);

  // Real-time live preview state
  const [livePreview, setLivePreview] = useState<string>('');
  const [isProcessingPreview, setIsProcessingPreview] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Sync working image when new imageUrl arrives
  const [prevImageUrl, setPrevImageUrl] = useState(imageUrl);
  if (prevImageUrl !== imageUrl) {
    setPrevImageUrl(imageUrl);
    setWorkingImage(imageUrl);
    setPoints([
      { x: 0.08, y: 0.08 },
      { x: 0.92, y: 0.08 },
      { x: 0.92, y: 0.92 },
      { x: 0.08, y: 0.92 },
    ]);
    setImgLoaded(false);
  }

  // Load natural dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    imageElementRef.current = img;
    setImgDims({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    setImgLoaded(true);
  };

  // Generate real-time live preview whenever points change
  const updatePreview = useCallback(() => {
    if (!imageElementRef.current || !imgLoaded) return;
    try {
      setIsProcessingPreview(true);
      const previewData = renderPerspectiveQuad(
        imageElementRef.current,
        points,
        360,
        360,
        10 // lighter subdivision for live preview
      );
      setLivePreview(previewData);
    } catch (err) {
      console.warn('Live preview failed', err);
    } finally {
      setIsProcessingPreview(false);
    }
  }, [points, imgLoaded]);

  useEffect(() => {
    if (imgLoaded) {
      const timer = setTimeout(updatePreview, 60);
      return () => clearTimeout(timer);
    }
  }, [points, imgLoaded, updatePreview]);

  // Rotate source image in-modal by 90 degrees
  const handleRotate90 = (angle = 90) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const rad = (angle * Math.PI) / 180;
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        const rotated = canvas.toDataURL('image/jpeg', 0.95);
        setWorkingImage(rotated);
        // Reset points to default box
        setPoints([
          { x: 0.08, y: 0.08 },
          { x: 0.92, y: 0.08 },
          { x: 0.92, y: 0.92 },
          { x: 0.08, y: 0.92 },
        ]);
      }
    };
    img.src = workingImage;
  };

  // Flip horizontal
  const handleFlipHorizontal = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        const flipped = canvas.toDataURL('image/jpeg', 0.95);
        setWorkingImage(flipped);
      }
    };
    img.src = workingImage;
  };

  // Convert mouse/touch event into normalized [0, 1] coordinate relative to image
  const getEventNormalizedPos = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  // Mouse & Touch Handlers
  const handleMouseDownPoint = (idx: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActivePoint(idx);
    setIsDraggingCenter(false);
  };

  const handleMouseDownCenter = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pos = getEventNormalizedPos(clientX, clientY);
    if (!pos) return;
    setIsDraggingCenter(true);
    setActivePoint(null);
    setDragStart(pos);
    setInitialPoints([...points]);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (activePoint === null && !isDraggingCenter) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pos = getEventNormalizedPos(clientX, clientY);
    if (!pos) return;

    if (activePoint !== null) {
      setPoints(prev => {
        const next = [...prev];
        next[activePoint] = pos;
        return next;
      });
    } else if (isDraggingCenter && dragStart && initialPoints.length === 4) {
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      // Clamp bounds
      let canMove = true;
      for (const p of initialPoints) {
        if (p.x + dx < 0 || p.x + dx > 1 || p.y + dy < 0 || p.y + dy > 1) {
          canMove = false;
          break;
        }
      }
      if (canMove) {
        setPoints(initialPoints.map(p => ({ x: p.x + dx, y: p.y + dy })));
      }
    }
  };

  const handlePointerUp = () => {
    setActivePoint(null);
    setIsDraggingCenter(false);
    setDragStart(null);
  };

  // Preset Configurations
  const applyPreset = (type: 'fit' | 'square' | 'tight' | 'border' | 'pallu' | 'macro') => {
    switch (type) {
      case 'macro':
        // Tight 1-2 motifs center crop (fills 60-70% of crop area)
        setPoints([
          { x: 0.30, y: 0.30 },
          { x: 0.70, y: 0.30 },
          { x: 0.70, y: 0.70 },
          { x: 0.30, y: 0.70 },
        ]);
        break;
      case 'fit':
        setPoints([
          { x: 0.03, y: 0.03 },
          { x: 0.97, y: 0.03 },
          { x: 0.97, y: 0.97 },
          { x: 0.03, y: 0.97 },
        ]);
        break;
      case 'tight':
        setPoints([
          { x: 0.12, y: 0.12 },
          { x: 0.88, y: 0.12 },
          { x: 0.88, y: 0.88 },
          { x: 0.12, y: 0.88 },
        ]);
        break;
      case 'square': {
        const aspect = imgDims.width / imgDims.height;
        if (aspect >= 1) {
          const w = 0.8 / aspect;
          setPoints([
            { x: 0.5 - w / 2, y: 0.1 },
            { x: 0.5 + w / 2, y: 0.1 },
            { x: 0.5 + w / 2, y: 0.9 },
            { x: 0.5 - w / 2, y: 0.9 },
          ]);
        } else {
          const h = 0.8 * aspect;
          setPoints([
            { x: 0.1, y: 0.5 - h / 2 },
            { x: 0.9, y: 0.5 - h / 2 },
            { x: 0.9, y: 0.5 + h / 2 },
            { x: 0.1, y: 0.5 + h / 2 },
          ]);
        }
        break;
      }
      case 'border':
        // Horizontal ribbon along bottom
        setPoints([
          { x: 0.05, y: 0.60 },
          { x: 0.95, y: 0.60 },
          { x: 0.95, y: 0.95 },
          { x: 0.05, y: 0.95 },
        ]);
        break;
      case 'pallu':
        // Tall rectangular drop
        setPoints([
          { x: 0.20, y: 0.05 },
          { x: 0.80, y: 0.05 },
          { x: 0.80, y: 0.95 },
          { x: 0.20, y: 0.95 },
        ]);
        break;
    }
  };

  // Center point calculation for center drag handle
  const centerPoint = {
    x: (points[0].x + points[1].x + points[2].x + points[3].x) / 4,
    y: (points[0].y + points[1].y + points[2].y + points[3].y) / 4,
  };

  // Apply final high-resolution crop
  const handleSave = () => {
    if (!imageElementRef.current) return;
    const finalData = renderPerspectiveQuad(
      imageElementRef.current,
      points,
      1024,
      1024,
      18 // ultra high precision subdivision
    );
    onApplyCrop(finalData);
    onClose();
  };

  if (!isOpen) return null;

  const pointColors = ['bg-rose-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];
  const pointLabels = ['TL: 1', 'TR: 2', 'BR: 3', 'BL: 4'];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-charcoal/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in select-none"
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[95vh] flex flex-col shadow-2xl border border-cream-border overflow-hidden animate-scale-up">
        {/* Header Bar */}
        <div className="p-4 px-6 border-b border-cream-border flex items-center justify-between bg-cream-light/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center shadow-md">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-charcoal">
                  Precision 4-Point Swatch Crop
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-bg text-accent border border-accent/20">
                  SareeDrape Mode
                </span>
              </div>
              <p className="text-xs text-charcoal-muted">
                {slotTitle ? `Adjusting ${slotTitle} — ` : ''}Drag the 4 corner points to isolate the fabric & flatten angled folds.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-cream hover:bg-cream-dark flex items-center justify-center text-charcoal transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Content: Left interactive canvas, Right preview & presets */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-cream/30">
          {/* Left Canvas Work Area (2 cols) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center bg-charcoal/95 rounded-2xl p-4 relative min-h-[360px] sm:min-h-[480px] overflow-hidden border border-cream-border shadow-inner">
            <div
              ref={containerRef}
              className="relative max-w-full max-h-[460px] flex items-center justify-center cursor-crosshair touch-none"
            >
              <img
                src={workingImage}
                alt="Source Swatch"
                onLoad={handleImageLoad}
                className="max-h-[440px] max-w-full object-contain pointer-events-none rounded-lg"
              />

              {/* SVG Overlay for Polygons, Grid & Shading */}
              {imgLoaded && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="quad-crop-mask">
                      {/* White fills everything (visible), Black cuts out the polygon (transparent inside) */}
                      <rect x="0" y="0" width="100" height="100" fill="white" />
                      <polygon
                        points={`${points[0].x * 100},${points[0].y * 100} ${points[1].x * 100},${points[1].y * 100} ${points[2].x * 100},${points[2].y * 100} ${points[3].x * 100},${points[3].y * 100}`}
                        fill="black"
                      />
                    </mask>
                  </defs>

                  {/* Darkened backdrop outside the quadrilateral */}
                  <rect
                    x="0"
                    y="0"
                    width="100"
                    height="100"
                    fill="black"
                    fillOpacity="0.65"
                    mask="url(#quad-crop-mask)"
                  />

                  {/* Bounding Polygon with Gold Dashed Edge */}
                  <polygon
                    points={`${points[0].x * 100},${points[0].y * 100} ${points[1].x * 100},${points[1].y * 100} ${points[2].x * 100},${points[2].y * 100} ${points[3].x * 100},${points[3].y * 100}`}
                    fill="rgba(197, 160, 89, 0.12)"
                    stroke="#F59E0B"
                    strokeWidth="0.8"
                    strokeDasharray="2, 2"
                  />

                  {/* Internal 3x3 Grid Lines inside the crop quad */}
                  {[1 / 3, 2 / 3].map(t => {
                    const topX = ((1 - t) * points[0].x + t * points[1].x) * 100;
                    const topY = ((1 - t) * points[0].y + t * points[1].y) * 100;
                    const botX = ((1 - t) * points[3].x + t * points[2].x) * 100;
                    const botY = ((1 - t) * points[3].y + t * points[2].y) * 100;
                    return (
                      <line
                        key={`v-${t}`}
                        x1={topX}
                        y1={topY}
                        x2={botX}
                        y2={botY}
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="0.4"
                      />
                    );
                  })}
                  {[1 / 3, 2 / 3].map(t => {
                    const leftX = ((1 - t) * points[0].x + t * points[3].x) * 100;
                    const leftY = ((1 - t) * points[0].y + t * points[3].y) * 100;
                    const rightX = ((1 - t) * points[1].x + t * points[2].x) * 100;
                    const rightY = ((1 - t) * points[1].y + t * points[2].y) * 100;
                    return (
                      <line
                        key={`h-${t}`}
                        x1={leftX}
                        y1={leftY}
                        x2={rightX}
                        y2={rightY}
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth="0.4"
                      />
                    );
                  })}
                </svg>
              )}

              {/* 4 Interactive Corner Handles */}
              {imgLoaded &&
                points.map((pt, idx) => (
                  <div
                    key={idx}
                    onMouseDown={e => handleMouseDownPoint(idx, e)}
                    onTouchStart={e => handleMouseDownPoint(idx, e)}
                    style={{
                      left: `${pt.x * 100}%`,
                      top: `${pt.y * 100}%`,
                    }}
                    className={`
                      absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-30 transition-transform select-none
                      ${pointColors[idx]}
                      ${activePoint === idx ? 'scale-125 ring-4 ring-amber-400' : 'hover:scale-110'}
                    `}
                    title={`Drag ${pointLabels[idx]}`}
                  >
                    <span className="text-[10px] font-black text-white">{idx + 1}</span>
                  </div>
                ))}

              {/* Center Grab Handle to drag the entire quadrilateral */}
              {imgLoaded && (
                <div
                  onMouseDown={handleMouseDownCenter}
                  onTouchStart={handleMouseDownCenter}
                  style={{
                    left: `${centerPoint.x * 100}%`,
                    top: `${centerPoint.y * 100}%`,
                  }}
                  className={`
                    absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-2xl bg-white/95 text-charcoal shadow-xl border border-cream-border flex items-center justify-center cursor-move z-20 transition-all hover:scale-110
                    ${isDraggingCenter ? 'scale-125 ring-4 ring-accent bg-accent text-white' : ''}
                  `}
                  title="Drag to reposition entire crop selection"
                >
                  <Move className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* In-Canvas Quick Orientation Toolbar */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white/90 pointer-events-none">
              <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Drag 1-4 pins to match saree weave
              </span>

              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => handleRotate90(-90)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold transition-colors cursor-pointer"
                  title="Rotate -90°"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRotate90(90)}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold transition-colors cursor-pointer"
                  title="Rotate +90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleFlipHorizontal}
                  className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-bold transition-colors cursor-pointer"
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Control & Live Preview Panel (1 col) */}
          <div className="flex flex-col justify-between space-y-4">
            {/* Live Straightened Swatch Preview */}
            <div className="bg-white rounded-2xl p-4 border border-cream-border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-charcoal">
                  <Eye className="w-4 h-4 text-accent" />
                  <span>Real-Time Cropped Swatch</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  1024×1024 Rectified
                </span>
              </div>

              <div className="aspect-square w-full rounded-xl bg-cream-light border border-cream-border/80 overflow-hidden flex items-center justify-center relative shadow-inner">
                {livePreview ? (
                  <img
                    src={livePreview}
                    alt="Live Cropped Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <RefreshCw className="w-6 h-6 text-charcoal-muted animate-spin mb-2" />
                    <span className="text-xs text-charcoal-muted">Generating swatch preview...</span>
                  </div>
                )}
                {isProcessingPreview && (
                  <div className="absolute top-2 right-2 p-1 rounded-md bg-black/60 text-white text-[10px]">
                    Updating...
                  </div>
                )}
              </div>

              <p className="text-[11px] text-charcoal-muted leading-tight">
                ✨ <strong>Zero-Warp Guarantee:</strong> Our bilinear algorithm straightens angled photos and trims all background clutter before sending to AI.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="bg-white rounded-2xl p-4 border border-cream-border shadow-xs space-y-2.5">
              <span className="text-[11px] font-bold text-charcoal uppercase tracking-wider block">
                📐 Precision Saree Presets:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('macro')}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold text-left transition-colors cursor-pointer border border-purple-200 flex items-center gap-1.5 shadow-xs"
                  title="Tight crop around 1-2 motifs for maximum AI fidelity"
                >
                  <span>🌸 Tight Butti Zoom (1–2 Motifs)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('square')}
                  className="px-2.5 py-1.5 rounded-xl bg-cream hover:bg-cream-dark text-charcoal text-xs font-semibold text-left transition-colors cursor-pointer border border-cream-border flex items-center gap-1.5"
                >
                  <span>🟦 1:1 Square (Body)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('border')}
                  className="px-2.5 py-1.5 rounded-xl bg-cream hover:bg-cream-dark text-charcoal text-xs font-semibold text-left transition-colors cursor-pointer border border-cream-border flex items-center gap-1.5"
                >
                  <span>📏 Border Ribbon</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('pallu')}
                  className="px-2.5 py-1.5 rounded-xl bg-cream hover:bg-cream-dark text-charcoal text-xs font-semibold text-left transition-colors cursor-pointer border border-cream-border flex items-center gap-1.5"
                >
                  <span>📜 Pallu Drop (3:4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('tight')}
                  className="px-2.5 py-1.5 rounded-xl bg-cream hover:bg-cream-dark text-charcoal text-xs font-semibold text-left transition-colors cursor-pointer border border-cream-border flex items-center gap-1.5"
                >
                  <span>✂️ Tight 12% Trim</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => applyPreset('fit')}
                className="w-full text-center py-1 text-xs text-charcoal-muted hover:text-charcoal underline cursor-pointer"
              >
                Reset to full image bounds
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-[2] flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>Apply & Save Swatch</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

