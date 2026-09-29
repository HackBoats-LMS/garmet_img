'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Sparkles,
  Download,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Search,
  Eye,
  X,
  Plus,
  Image as ImageIcon,
  CheckCircle2,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/app/components/ui/Button';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Input } from '@/app/components/ui/Input';
import { CollageCreator } from '@/app/components/CollageCreator';
import { ProductCaptionGenerator } from '@/app/components/ProductCaptionGenerator';

interface CustomerOrderRecord {
  id: string;
  productName: string | null;
  stockCode: string | null;
  description: string | null;
  aspectRatio: string | null;
  captions: Record<string, string> | null;
  uploadedImages: Record<string, string> | null;
  selectedOptions: Record<string, string> | null;
  generatedImages: Record<string, { imageUrl: string; prompt?: string }> | null;
  status: string;
  createdAt: string;
  template: {
    id: string;
    name: string;
    slug: string;
    coverImage: string | null;
    poses: { id: string; name: string; category: string; previewImage?: string | null }[];
  } | null;
}

export default function CustomerGalleryPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState('all');

  // Lightbox Modal state
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    poseName: string;
    prompt?: string;
  } | null>(null);

  // Collage Creator state
  const [collageOrder, setCollageOrder] = useState<CustomerOrderRecord | null>(null);

  // Captions panel state — which order's captions panel is open
  const [captionsOrderId, setCaptionsOrderId] = useState<string | null>(null);

  // Regenerating state: { orderId_poseId }
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customer/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleRegenerate = async (orderId: string, poseId: string) => {
    const key = `${orderId}_${poseId}`;
    setRegenerating((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poseId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update the local state
        setOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            return {
              ...order,
              generatedImages: {
                ...(order.generatedImages || {}),
                [poseId]: { imageUrl: data.imageUrl, prompt: data.prompt || '' },
              },
            };
          })
        );
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      setRegenerating((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleCaptionsSaved = (orderId: string, captions: Record<string, string>) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, captions } : order
      )
    );
  };

  // Calculate totals
  const allGeneratedItems: {
    orderId: string;
    garmentName: string;
    poseName: string;
    imageUrl: string;
    prompt?: string;
    date: string;
    templateName: string;
  }[] = [];

  orders.forEach((order) => {
    if (order.generatedImages && typeof order.generatedImages === 'object') {
      Object.entries(order.generatedImages).forEach(([poseId, imgData]) => {
        if (imgData && imgData.imageUrl) {
          const poseObj = order.template?.poses?.find((p) => p.id === poseId);
          allGeneratedItems.push({
            orderId: order.id,
            garmentName: order.productName || order.template?.name || 'Garment Photoshoot',
            poseName: poseObj?.name || 'Photoshoot Pose',
            imageUrl: imgData.imageUrl,
            prompt: imgData.prompt,
            date: new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            templateName: order.template?.name || 'Custom',
          });
        }
      });
    }
  });

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const nameMatch =
      !searchQuery ||
      (order.productName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.stockCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.template?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const templateMatch =
      selectedTemplateFilter === 'all' || order.template?.slug === selectedTemplateFilter;

    return nameMatch && templateMatch;
  });

  const uniqueTemplates = Array.from(
    new Map(orders.map((o) => o.template).filter(Boolean).map((t: any) => [t.slug, t])).values()
  ) as { id: string; name: string; slug: string }[];

  // Get aspect ratio style for image containers
  const getAspectRatioStyle = (ratio: string | null) => {
    const ratioMap: Record<string, string> = {
      '3:4': 'aspect-[3/4]',
      '1:1': 'aspect-square',
      '9:16': 'aspect-[9/16]',
      '4:3': 'aspect-[4/3]',
      '16:9': 'aspect-[16/9]',
    };
    return ratioMap[ratio || '3:4'] || 'aspect-[3/4]';
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 animate-fade-in pb-20">
      {/* ──── HEADER ──── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-cream-border/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-bg border border-accent-border text-accent text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Catalog Vault</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-charcoal">
            My Generated Photoshoots
          </h1>
          <p className="mt-2 text-sm text-charcoal-muted max-w-xl">
            Access, view in 4K resolution, download, create collages and generate captions for all your AI photoshoots.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-cream-border shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-accent-bg flex items-center justify-center text-accent">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-base font-extrabold text-charcoal">{allGeneratedItems.length}</p>
              <p className="text-[10px] uppercase font-bold text-charcoal-muted tracking-wider">4K Images</p>
            </div>
          </div>

          <Link href="/customer">
            <Button size="md">
              <Plus className="w-4 h-4" />
              New Photoshoot
            </Button>
          </Link>
        </div>
      </div>

      {/* ──── SEARCH & FILTERS ──── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by garment, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {uniqueTemplates.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            <button
              onClick={() => setSelectedTemplateFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedTemplateFilter === 'all'
                  ? 'bg-charcoal text-white shadow-xs'
                  : 'bg-white text-charcoal-muted hover:text-charcoal border border-cream-border'
              }`}
            >
              All Categories ({orders.length})
            </button>
            {uniqueTemplates.map((t) => (
              <button
                key={t.slug}
                onClick={() => setSelectedTemplateFilter(t.slug)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedTemplateFilter === t.slug
                    ? 'bg-charcoal text-white shadow-xs'
                    : 'bg-white text-charcoal-muted hover:text-charcoal border border-cream-border'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ──── CONTENT ──── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-charcoal">Loading your photoshoot gallery...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-cream-light border border-cream-border flex items-center justify-center mx-auto text-charcoal-light">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal">No photoshoots found</h3>
            <p className="text-xs text-charcoal-muted mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'No photoshoot matches your search query. Try clearing filters.'
                : 'You have not created any AI photoshoots yet. Start your first session now!'}
            </p>
          </div>
          <Link href="/customer" className="inline-block pt-2">
            <Button size="md">
              <Sparkles className="w-4 h-4" />
              Create First Photoshoot
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-10">
          {filteredOrders.map((order) => {
            const genCount = order.generatedImages
              ? Object.keys(order.generatedImages).length
              : 0;

            const dateStr = new Date(order.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const aspectClass = getAspectRatioStyle(order.aspectRatio);
            const captionsOpen = captionsOrderId === order.id;

            // Build collage images list for this order
            const collageImages = order.generatedImages
              ? Object.entries(order.generatedImages)
                  .filter(([, item]) => item?.imageUrl)
                  .map(([poseId, item]) => ({
                    id: poseId,
                    url: item.imageUrl,
                    poseName:
                      order.template?.poses?.find((p) => p.id === poseId)?.name ||
                      'Pose',
                  }))
              : [];

            return (
              <Card key={order.id} className="overflow-hidden shadow-xs hover:shadow-md transition-shadow">
                {/* Product Header Bar */}
                <div className="p-6 sm:p-8 border-b border-cream-border/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="font-display text-lg sm:text-xl font-bold text-charcoal">
                          {order.productName || order.template?.name || 'Bespoke Photoshoot'}
                        </h2>
                        {order.stockCode && (
                          <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-md bg-cream-dark text-charcoal-soft">
                            SKU: {order.stockCode}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-bg text-accent">
                          {order.template?.name || 'Garment'}
                        </span>
                        {order.aspectRatio && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {order.aspectRatio}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-charcoal-muted pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-charcoal">
                          {genCount} {genCount === 1 ? 'pose photo' : 'pose photos'}
                        </span>
                      </div>
                    </div>

                    {/* Product Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Collage Creator */}
                      {collageImages.length >= 2 && (
                        <button
                          onClick={() => setCollageOrder(order)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Create Collage</span>
                        </button>
                      )}

                      {/* Captions */}
                      <button
                        onClick={() =>
                          setCaptionsOrderId(captionsOpen ? null : order.id)
                        }
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          captionsOpen
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{captionsOpen ? 'Hide Captions' : 'Captions'}</span>
                        {order.captions && Object.values(order.captions).some(Boolean) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </button>

                      {order.template && (
                        <Link href={`/customer/order/${order.template.id}`}>
                          <Button variant="ghost" size="sm">
                            <Sparkles className="w-3.5 h-3.5 text-accent" />
                            New Photoshoot
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Swatches & Styling Notes Summary */}
                {(order.uploadedImages || order.selectedOptions) && (
                  <div className="px-6 sm:px-8 py-4 bg-cream-light border-b border-cream-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    {order.uploadedImages && (
                      <div className="flex items-center gap-3">
                        <span className="text-charcoal-muted font-semibold uppercase tracking-wider text-[10px]">
                          Reference Swatches:
                        </span>
                        <div className="flex items-center gap-2">
                          {Object.entries(order.uploadedImages).map(([slotKey, imgUrl]) => (
                            <div
                              key={slotKey}
                              className="w-9 h-9 rounded-lg overflow-hidden border border-cream-border bg-white shadow-xs shrink-0"
                              title={slotKey}
                            >
                              <img src={imgUrl} alt="Swatch" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {order.selectedOptions && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {Object.entries(order.selectedOptions).map(([k, v]) => (
                          <span
                            key={k}
                            className="px-2.5 py-1 rounded-md bg-white border border-cream-border text-charcoal text-[11px] font-medium"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Generated Photos Grid */}
                <div className="p-6 sm:p-8">
                  {order.generatedImages && Object.keys(order.generatedImages).length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                      {Object.entries(order.generatedImages).map(([poseId, item]) => {
                        if (!item?.imageUrl) return null;
                        const pose = order.template?.poses?.find((p) => p.id === poseId);
                        const poseName = pose?.name || 'Pose Angle';
                        const regenKey = `${order.id}_${poseId}`;
                        const isRegen = regenerating[regenKey];

                        return (
                          <div
                            key={poseId}
                            className="group relative rounded-2xl overflow-hidden bg-white border border-cream-border hover:border-accent/40 shadow-xs hover:shadow-md transition-all flex flex-col"
                          >
                            <div
                              className={`${aspectClass} relative overflow-hidden bg-cream-light`}
                            >
                              {isRegen ? (
                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                                  <span className="text-xs text-white font-medium">Regenerating...</span>
                                </div>
                              ) : (
                                <img
                                  src={item.imageUrl}
                                  alt={poseName}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                              )}

                              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3.5">
                                <button
                                  onClick={() =>
                                    setLightboxImage({
                                      url: item.imageUrl,
                                      title: order.productName || order.template?.name || 'Photoshoot',
                                      poseName,
                                      prompt: item.prompt,
                                    })
                                  }
                                  className="p-2 rounded-xl bg-white/90 text-charcoal hover:bg-white transition-colors cursor-pointer shadow-sm"
                                  title="View in Full Screen"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-1.5">
                                  {/* Regenerate */}
                                  <button
                                    onClick={() => handleRegenerate(order.id, poseId)}
                                    disabled={isRegen}
                                    className="p-2 rounded-xl bg-white/90 text-charcoal hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                                    title="Regenerate this image"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>

                                  {/* Download */}
                                  <button
                                    onClick={() =>
                                      handleDownload(
                                        item.imageUrl,
                                        `${order.productName || 'garment'}_${poseName}.jpg`
                                      )
                                    }
                                    className="p-2 rounded-xl bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer shadow-sm"
                                    title="Download 4K Photo"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-charcoal/80 backdrop-blur-xs text-[9px] font-bold text-white uppercase tracking-wider">
                                4K Ultra HD
                              </div>
                            </div>

                            <div className="p-3.5 bg-white border-t border-cream-border/60 flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <p className="text-xs font-bold text-charcoal truncate">{poseName}</p>
                                <p className="text-[10px] text-charcoal-muted capitalize">
                                  {pose?.category || 'Studio Angle'}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleRegenerate(order.id, poseId)}
                                  disabled={isRegen}
                                  className="p-1.5 text-charcoal-muted hover:text-amber-600 transition-colors cursor-pointer disabled:opacity-40"
                                  title="Regenerate"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDownload(
                                      item.imageUrl,
                                      `${order.productName || 'garment'}_${poseName}.jpg`
                                    )
                                  }
                                  className="p-1.5 text-charcoal-muted hover:text-accent transition-colors cursor-pointer shrink-0"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-charcoal-muted italic py-4">
                      No images were saved for this photoshoot session.
                    </p>
                  )}
                </div>

                {/* Captions Panel (collapsible) */}
                {captionsOpen && (
                  <div className="px-6 sm:px-8 pb-8 border-t border-cream-border/40 pt-6">
                    <ProductCaptionGenerator
                      orderId={order.id}
                      productName={order.productName || order.template?.name || 'Product'}
                      stockCode={order.stockCode}
                      description={order.description}
                      existingCaptions={order.captions}
                      onCaptionsSaved={(captions) => handleCaptionsSaved(order.id, captions)}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ──── LIGHTBOX MODAL ──── */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-charcoal/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-charcoal rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            {/* Top Bar */}
            <div className="p-4 px-6 bg-charcoal-dark border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{lightboxImage.title}</p>
                <p className="text-xs text-cream-dark/70">{lightboxImage.poseName}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    handleDownload(
                      lightboxImage.url,
                      `${lightboxImage.title}_${lightboxImage.poseName}.jpg`
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download 4K</span>
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Preview */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* ──── COLLAGE CREATOR MODAL ──── */}
      {collageOrder && (
        <CollageCreator
          isOpen={true}
          onClose={() => setCollageOrder(null)}
          productName={collageOrder.productName || collageOrder.template?.name || 'Product'}
          images={
            collageOrder.generatedImages
              ? Object.entries(collageOrder.generatedImages)
                  .filter(([, item]) => item?.imageUrl)
                  .map(([poseId, item]) => ({
                    id: poseId,
                    url: item.imageUrl,
                    poseName:
                      collageOrder.template?.poses?.find((p) => p.id === poseId)?.name ||
                      'Pose',
                  }))
              : []
          }
        />
      )}
    </div>
  );
}
