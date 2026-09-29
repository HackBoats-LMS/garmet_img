'use client';

import React, { useState } from 'react';
import { Search, CheckCircle2, AlertCircle, Trash2, Check, RefreshCw, Archive, ShoppingBag } from 'lucide-react';
import { StockItemData } from '@/app/types/stock';

interface Props {
  stockItems: StockItemData[];
  onRefreshStock: () => void;
  onBillStock: (stockCode: string, purgeImages: boolean) => Promise<void>;
}

export function BillingManager({ stockItems, onRefreshStock, onBillStock }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BILLED'>('ALL');
  const [billingCode, setBillingCode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purgeOption, setPurgeOption] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filteredItems = stockItems.filter((item) => {
    const matchesSearch =
      item.stockCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rawDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleConfirmBill = async (stockCode: string) => {
    setIsProcessing(true);
    try {
      await onBillStock(stockCode, purgeOption);
      setActionSuccess(`Stock #${stockCode} has been marked as SOLD OUT.`);
      setBillingCode(null);
      setTimeout(() => setActionSuccess(null), 3500);
      onRefreshStock();
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Garment Stock Maintenance & Sold Out Manager
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            When a customer purchases a piece, mark it as Billed to update database stock and automatically stamp Sold Out.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshStock}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors shrink-0 cursor-pointer border border-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Database</span>
        </button>
      </div>

      {/* Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Stock Code (e.g. KAN-101), title, or saree weave..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors shadow-2xs"
          />
        </div>

        <div className="flex gap-1.5 bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs self-stretch sm:self-auto">
          {(['ALL', 'ACTIVE', 'BILLED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {st === 'ALL' ? 'All Stock' : st === 'ACTIVE' ? '🟢 In Stock' : '🔴 Sold Out'}
            </button>
          ))}
        </div>
      </div>

      {/* Stock Items Table / Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Archive className="w-8 h-8 mx-auto text-slate-300" />
            <div>No stock items found matching your filter.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isBilled = item.status === 'BILLED';
              const thumbnail = item.poses?.[0]?.imageUrl || item.referenceImages?.[0]?.url || '/saree_model_4k.jpg';

              return (
                <div
                  key={item.stockCode}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <img src={thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      {isBilled && (
                        <div className="absolute inset-0 bg-red-600/80 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                          Sold
                        </div>
                      )}
                    </div>

                    {/* Stock Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {item.stockCode}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            isBilled
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isBilled ? 'SOLD OUT' : 'IN STOCK'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {item.rawDescription || 'No description provided.'}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span>Price: <strong className="text-slate-800">{item.price ? `₹${item.price.toLocaleString('en-IN')}` : 'N/A'}</strong></span>
                        <span>•</span>
                        <span>{item.poses?.length || 0} Poses in Album</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!isBilled ? (
                      <button
                        type="button"
                        onClick={() => setBillingCode(item.stockCode)}
                        className="px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Mark Sold Out</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 font-semibold px-3 py-1 bg-slate-100 rounded-lg border border-slate-200">
                        Item Sold
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {billingCode && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-slate-900">
                Confirm Sale for Stock #{billingCode}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Marking this piece as <strong>SOLD OUT</strong> updates the database inventory status.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={purgeOption}
                  onChange={(e) => setPurgeOption(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <span>Automatically remove high-res photos to free server storage</span>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setBillingCode(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmBill(billingCode)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm & Mark Sold</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

