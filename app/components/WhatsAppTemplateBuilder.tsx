'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Download, Sparkles, LayoutGrid, Layers, Columns3, Smartphone, Copy, Check } from 'lucide-react';
import { StockItemData, StockPoseData, WhatsAppTemplateId } from '@/app/types/stock';

interface Props {
  stockItem: StockItemData;
  availablePoses: StockPoseData[];
}

export function WhatsAppTemplateBuilder({ stockItem, availablePoses }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplateId>('luxury_inset');
  const [activeSlotTarget, setActiveSlotTarget] = useState<string | null>(null);

  // Default image assignments from 15 real poses
  const defaultHero = availablePoses[0]?.imageUrl || stockItem.referenceImages?.[0]?.url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80';
  const defaultSlot1 = availablePoses[1]?.imageUrl || stockItem.referenceImages?.[1]?.url || 'https://images.unsplash.com/photo-1667053312811-6594186d37ca?auto=format&fit=crop&w=900&q=80';
  const defaultSlot2 = availablePoses[2]?.imageUrl || stockItem.referenceImages?.[2]?.url || 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=80';
  const defaultSlot3 = availablePoses[3]?.imageUrl || 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=900&q=80';
  const defaultSlot4 = availablePoses[4]?.imageUrl || 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=900&q=80';

  const [assignedSlots, setAssignedSlots] = useState<Record<string, string>>({
    hero: defaultHero,
    slot1: defaultSlot1,
    slot2: defaultSlot2,
    slot3: defaultSlot3,
    slot4: defaultSlot4,
  });

  const [customTitle, setCustomTitle] = useState(stockItem.title || 'Pure Kanchipuram Silk Saree');
  const [customPrice, setCustomPrice] = useState(
    stockItem.price ? `₹${stockItem.price.toLocaleString('en-IN')}` : '₹24,500'
  );
  const [customDesc, setCustomDesc] = useState(
    stockItem.rawDescription || 'Pure silk warp & weft weave with grand 10-inch pure gold zari temple border.'
  );

  const [isExporting, setIsExporting] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync if stock item changes
  useEffect(() => {
    setCustomTitle(stockItem.title || `Pure Handloom Silk (${stockItem.stockCode})`);
    if (stockItem.price) setCustomPrice(`₹${stockItem.price.toLocaleString('en-IN')}`);
    if (stockItem.rawDescription) setCustomDesc(stockItem.rawDescription);

    if (availablePoses.length > 0) {
      setAssignedSlots({
        hero: availablePoses[0]?.imageUrl || defaultHero,
        slot1: availablePoses[1]?.imageUrl || defaultSlot1,
        slot2: availablePoses[2]?.imageUrl || defaultSlot2,
        slot3: availablePoses[3]?.imageUrl || defaultSlot3,
        slot4: availablePoses[4]?.imageUrl || defaultSlot4,
      });
    }
  }, [stockItem.stockCode, stockItem.price, availablePoses]);

  // Load and draw template onto HTML5 canvas
  const drawCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1350; // Standard 4:5 Instagram & WhatsApp portrait resolution
    canvas.width = width;
    canvas.height = height;

    // Background fill
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          // Fallback solid color image if cross-origin fails
          const fallback = new Image();
          fallback.src = '/saree_model_4k.jpg';
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => resolve(img);
        };
        img.src = src;
      });
    };

    try {
      if (selectedTemplate === 'luxury_inset') {
        // Main Hero Image
        const heroImg = await loadImage(assignedSlots.hero || defaultHero);
        ctx.drawImage(heroImg, 0, 0, width, 1050);

        // Inset Circle 1 (Border Focus)
        const inset1 = await loadImage(assignedSlots.slot1 || defaultSlot1);
        ctx.save();
        ctx.beginPath();
        ctx.arc(880, 180, 120, 0, Math.PI * 2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#d4af37'; // Gold
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(inset1, 760, 60, 240, 240);
        ctx.restore();

        // Inset Circle 2 (Blouse Focus)
        const inset2 = await loadImage(assignedSlots.slot2 || defaultSlot2);
        ctx.save();
        ctx.beginPath();
        ctx.arc(880, 460, 120, 0, Math.PI * 2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#d4af37';
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(inset2, 760, 340, 240, 240);
        ctx.restore();

        // Inset Labels
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(780, 260, 200, 30);
        ctx.fillRect(780, 540, 200, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Zari Border Focus', 880, 282);
        ctx.fillText('Blouse Embroidery', 880, 562);

      } else if (selectedTemplate === 'quad_grid') {
        // 2x2 Grid
        const img1 = await loadImage(assignedSlots.hero || defaultHero);
        const img2 = await loadImage(assignedSlots.slot1 || defaultSlot1);
        const img3 = await loadImage(assignedSlots.slot2 || defaultSlot2);
        const img4 = await loadImage(assignedSlots.slot3 || defaultSlot3);

        const gw = 530;
        const gh = 515;
        ctx.drawImage(img1, 10, 10, gw, gh);
        ctx.drawImage(img2, 550, 10, gw, gh);
        ctx.drawImage(img3, 10, 535, gw, gh);
        ctx.drawImage(img4, 550, 535, gw, gh);

      } else if (selectedTemplate === 'story_strip') {
        // 3 Vertical Slices
        const img1 = await loadImage(assignedSlots.hero || defaultHero);
        const img2 = await loadImage(assignedSlots.slot1 || defaultSlot1);
        const img3 = await loadImage(assignedSlots.slot2 || defaultSlot2);

        const sw = 350;
        ctx.drawImage(img1, 10, 10, sw, 1030);
        ctx.drawImage(img2, 365, 10, sw, 1030);
        ctx.drawImage(img3, 720, 10, sw, 1030);

      } else if (selectedTemplate === 'minimalist_card') {
        // Single Minimalist Luxury Card
        const heroImg = await loadImage(assignedSlots.hero || defaultHero);
        ctx.drawImage(heroImg, 40, 40, width - 80, 980);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.strokeRect(30, 30, width - 60, 1000);
      }

      // -------------------------------------------------------------
      // Luxury Bottom Description Bar (All Templates)
      // -------------------------------------------------------------
      const footerY = 1060;
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, footerY, width, height - footerY);

      // Gold Accent Divider Line
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(0, footerY, width, 4);

      // Stock Code Pill
      ctx.fillStyle = '#222222';
      ctx.fillRect(50, footerY + 30, 200, 45);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(50, footerY + 30, 200, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`CODE: ${stockItem.stockCode || 'MYRA-01'}`, 65, footerY + 60);

      // Price Tag
      ctx.fillStyle = '#10b981'; // Emerald
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText(customPrice, 280, footerY + 65);

      // Title & Brand Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(customTitle, 50, footerY + 120);

      // Description
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '18px sans-serif';
      ctx.fillText(customDesc.slice(0, 85) + (customDesc.length > 85 ? '...' : ''), 50, footerY + 165);
      ctx.fillText('✨ 100% Pure Silk Mark Certified • Reply with Stock Code to Order on WhatsApp', 50, footerY + 205);

      // Brand Monogram on bottom right
      ctx.fillStyle = '#d4af37';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'right';
      ctx.fillText('MYRA COUTURE', width - 50, footerY + 65);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#737373';
      ctx.fillText('Handcrafted Luxury', width - 50, footerY + 95);

    } catch (e) {
      console.error('Error drawing canvas template:', e);
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [selectedTemplate, assignedSlots, customTitle, customPrice, customDesc]);

  const handleDownload = async () => {
    setIsExporting(true);
    await drawCanvas();
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      link.download = `${stockItem.stockCode || 'garment'}_whatsapp_card.jpg`;
      link.href = dataUrl;
      link.click();
    }
    setIsExporting(false);
  };

  const handleAssignPose = (poseUrl: string) => {
    if (activeSlotTarget) {
      setAssignedSlots((prev) => ({ ...prev, [activeSlotTarget]: poseUrl }));
      setActiveSlotTarget(null);
    }
  };

  const templatesList: { id: WhatsAppTemplateId; name: string; subtitle: string; icon: any }[] = [
    {
      id: 'luxury_inset',
      name: '1. Luxury Inset Showcase',
      subtitle: 'Hero + 2 Detail Inset Circles',
      icon: Layers,
    },
    {
      id: 'quad_grid',
      name: '2. 4-Grid Quad Catalog',
      subtitle: '2x2 Angle Overview',
      icon: LayoutGrid,
    },
    {
      id: 'story_strip',
      name: '3. Vertical Story Strip',
      subtitle: '3 Tall Slices (Body, Pallu, Blouse)',
      icon: Columns3,
    },
    {
      id: 'minimalist_card',
      name: '4. Minimalist Studio Card',
      subtitle: 'Single Framed Luxury Portrait',
      icon: Smartphone,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Template Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {templatesList.map((tpl) => {
          const Icon = tpl.icon;
          const isSelected = selectedTemplate === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setSelectedTemplate(tpl.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-500/50'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                {isSelected && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded-md">
                    Selected
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{tpl.name}</div>
                <div className="text-[11px] text-slate-500">{tpl.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Builder: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Slot Mapping & Editable Footer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Photo Slot Mapping Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-xs font-bold text-slate-900">
                Assign Photos to Poster Slots
              </span>
              <span className="text-[11px] text-slate-500">Click slot to change</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['hero', 'slot1', 'slot2', 'slot3'].map((slotKey) => (
                <button
                  key={slotKey}
                  type="button"
                  onClick={() => setActiveSlotTarget(slotKey)}
                  className={`p-2 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    activeSlotTarget === slotKey
                      ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/40'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-600 uppercase truncate">
                    {slotKey === 'hero' ? 'Main Hero' : slotKey === 'slot1' ? 'Pallu / Detail' : slotKey === 'slot2' ? 'Blouse / Yoke' : 'Angle 4'}
                  </div>
                  <div className="w-full aspect-[3/4] rounded-lg bg-slate-200 overflow-hidden border border-slate-200">
                    <img
                      src={assignedSlots[slotKey] || defaultHero}
                      alt="Slot preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>

            {/* Pose Picker Drawer */}
            {activeSlotTarget && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                  <span>Pick Photo for [{activeSlotTarget.toUpperCase()}]</span>
                  <button
                    onClick={() => setActiveSlotTarget(null)}
                    className="text-[10px] text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {availablePoses.map((pose) => (
                    <button
                      key={pose.poseNumber}
                      type="button"
                      onClick={() => handleAssignPose(pose.imageUrl)}
                      className="aspect-[3/4] rounded-lg border border-slate-300 hover:border-emerald-600 hover:ring-2 hover:ring-emerald-500/50 overflow-hidden group cursor-pointer shadow-2xs"
                    >
                      <img src={pose.imageUrl} alt={pose.poseName} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Editable Footer Fields Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
            <span className="text-xs font-bold text-slate-900 block border-b border-slate-100 pb-2">
              Poster Text & Pricing Customizer
            </span>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Product Title / Collection</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Offer Price</label>
                  <input
                    type="text"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-emerald-700 font-bold focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Stock Code</label>
                  <input
                    type="text"
                    disabled
                    value={stockItem.stockCode}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Short Description (Bottom Banner)</label>
                <textarea
                  rows={2}
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition-colors resize-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download WhatsApp Poster Card (1080x1350 HD)</span>
            </button>
          </div>

        </div>

        {/* Right Column: Live Composite Canvas Preview (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 w-full flex flex-col items-center gap-3 shadow-xs">
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-xs font-bold text-slate-900">
                Live WhatsApp Customer Poster Preview
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                1080 × 1350 Ultra HD
              </span>
            </div>

            {/* The Actual HTML5 Canvas */}
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-black aspect-[4/5]">
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
