/**
 * Size Inventory Utility
 * 
 * Manages size-wise breakdown of garment inventory (e.g. {"S": 2, "M": 5, "XL": 1})
 * seamlessly keeping it synchronized with total aggregate quantity.
 */

export interface SizeInventoryItem {
  quantity: number;
  stockCode?: string | null;
  stockCodes?: string[];
}

export type SizeInventoryMap = Record<string, SizeInventoryItem | number>;

/**
 * Normalizes any incoming size inventory representation into a clean Record<string, SizeInventoryItem>.
 * Supports:
 * - Legacy format: {"XL": 3, "XXL": 2}
 * - Single stockCode format: {"XL": { quantity: 3, stockCode: "5270000094" }}
 * - Multi-stockCode format: {"XL": { quantity: 5, stockCode: "5270000094, 5270000102", stockCodes: ["5270000094", "5270000102"] }}
 * - JSON string, existing object, or null/undefined.
 */
export function normalizeSizeInventory(raw: any): Record<string, SizeInventoryItem> {
  if (!raw) return {};

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
    return {};
  }

  const result: Record<string, SizeInventoryItem> = {};
  for (const [key, val] of Object.entries(parsed)) {
    const trimmedSize = String(key).trim().toUpperCase();
    if (!trimmedSize) continue;

    if (typeof val === 'number') {
      result[trimmedSize] = {
        quantity: Math.max(0, val),
        stockCode: null,
        stockCodes: [],
      };
    } else if (typeof val === 'object' && val !== null) {
      const q = parseInt(String((val as any).quantity ?? (val as any).qty ?? 0), 10);
      const rawCode = (val as any).stockCode ? String((val as any).stockCode).trim() : null;
      const rawCodes = Array.isArray((val as any).stockCodes)
        ? (val as any).stockCodes.map((s: any) => String(s).trim()).filter(Boolean)
        : [];

      const codesSet = new Set<string>();
      for (const c of rawCodes) {
        if (c) codesSet.add(c);
      }
      if (rawCode) {
        rawCode.split(/[,;|\s]+/).forEach(s => {
          const t = s.trim();
          if (t) codesSet.add(t);
        });
      }

      const allCodes = Array.from(codesSet);
      result[trimmedSize] = {
        quantity: isNaN(q) ? 0 : Math.max(0, q),
        stockCode: allCodes.length > 0 ? allCodes.join(', ') : null,
        stockCodes: allCodes,
      };
    } else {
      const q = parseInt(String(val), 10);
      if (!isNaN(q)) {
        result[trimmedSize] = {
          quantity: Math.max(0, q),
          stockCode: null,
          stockCodes: [],
        };
      }
    }
  }

  return result;
}

/**
 * Computes the total quantity across all size variants.
 */
export function sumSizeInventory(inv: any): number {
  const normalized = normalizeSizeInventory(inv);
  return Object.values(normalized).reduce((acc, item) => acc + (item.quantity || 0), 0);
}

/**
 * Finds the matching size variant given a barcode stockCode from a scanner or webhook.
 */
export function findSizeByStockCode(
  inv: any,
  barcode: string
): { size: string; item: SizeInventoryItem } | null {
  if (!barcode) return null;
  const cleanBarcode = String(barcode).trim().toLowerCase();
  const normalized = normalizeSizeInventory(inv);

  // 1. Exact match on variant stockCodes array or stockCode string
  for (const [size, item] of Object.entries(normalized)) {
    if (item.stockCodes && item.stockCodes.length > 0) {
      if (item.stockCodes.some(c => c.toLowerCase() === cleanBarcode)) {
        return { size, item };
      }
    }
    if (item.stockCode) {
      const codes = item.stockCode.split(/[,;|\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      if (codes.includes(cleanBarcode)) {
        return { size, item };
      }
    }
  }

  // 2. Suffix match: e.g. barcode is "kpd-2-navy-xl" and size is "XL"
  for (const [size, item] of Object.entries(normalized)) {
    const sLower = size.toLowerCase();
    if (cleanBarcode.endsWith(`-${sLower}`) || cleanBarcode.endsWith(`_${sLower}`) || cleanBarcode === sLower) {
      return { size, item };
    }
  }

  return null;
}

/**
 * Merges or increments a specific size into an existing sizeInventory map.
 * Returns the new map and the new total quantity, keeping all stockCodes.
 */
export function addOrUpdateSizeStock(
  currentMap: any,
  size: string,
  quantityToAdd: number,
  stockCode?: string | null
): { sizeInventory: Record<string, SizeInventoryItem>; totalQuantity: number } {
  const map = { ...normalizeSizeInventory(currentMap) };
  const normalizedSize = String(size).trim().toUpperCase();

  const currentItem = map[normalizedSize] || { quantity: 0, stockCode: null, stockCodes: [] };
  const updatedQty = Math.max(0, currentItem.quantity + quantityToAdd);
  
  const currentCodes = currentItem.stockCodes || (currentItem.stockCode ? currentItem.stockCode.split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean) : []);
  const newCodes = stockCode ? String(stockCode).split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean) : [];
  const mergedCodes = Array.from(new Set([...currentCodes, ...newCodes]));

  map[normalizedSize] = {
    quantity: updatedQty,
    stockCode: mergedCodes.length > 0 ? mergedCodes.join(', ') : null,
    stockCodes: mergedCodes,
  };

  const totalQuantity = sumSizeInventory(map);
  return { sizeInventory: map, totalQuantity };
}

/**
 * Deducts stock for a specific size (e.g. on sale).
 * If barcode stockCode matches a specific size, deducts from that size directly.
 */
export function deductSizeStock(
  currentMap: any,
  sizeOrStockCode: string | null | undefined,
  quantityToDeduct: number
): {
  success: boolean;
  sizeInventory: Record<string, SizeInventoryItem>;
  totalQuantity: number;
  deductedSize?: string;
  error?: string;
} {
  const map = { ...normalizeSizeInventory(currentMap) };
  const total = sumSizeInventory(map);

  if (!sizeOrStockCode) {
    // No size or barcode specified — cannot deduct from specific size
    return {
      success: true,
      sizeInventory: map,
      totalQuantity: Math.max(0, total - quantityToDeduct),
    };
  }

  const query = String(sizeOrStockCode).trim().toUpperCase();
  const queryLower = query.toLowerCase();
  
  // 1. Try finding by direct size name (e.g. "XL")
  let targetSize = map[query] ? query : null;

  // 2. Try finding by case-insensitive key
  if (!targetSize) {
    for (const s of Object.keys(map)) {
      if (s.toUpperCase() === query) {
        targetSize = s;
        break;
      }
    }
  }

  // 3. Try finding by barcode / variant stockCode (case-insensitive)
  if (!targetSize) {
    for (const [s, item] of Object.entries(map)) {
      const allCodes: string[] = [];
      if (item.stockCodes && Array.isArray(item.stockCodes)) {
        allCodes.push(...item.stockCodes);
      }
      if (item.stockCode) {
        allCodes.push(...String(item.stockCode).split(/[,;|\s]+/));
      }
      if (allCodes.some(c => c.trim().toLowerCase() === queryLower)) {
        targetSize = s;
        break;
      }
    }
  }

  // 4. Try suffix match (e.g. "saree-05-cherry-red-m" -> size "M")
  if (!targetSize) {
    for (const s of Object.keys(map)) {
      const sLower = s.toLowerCase();
      if (queryLower.endsWith(`-${sLower}`) || queryLower.endsWith(`_${sLower}`)) {
        targetSize = s;
        break;
      }
    }
  }

  if (!targetSize || !map[targetSize]) {
    // If neither size name nor stockCode is found in the map, default safely
    return {
      success: true,
      sizeInventory: map,
      totalQuantity: Math.max(0, total - quantityToDeduct),
    };
  }

  const currentQty = map[targetSize].quantity;
  if (currentQty < quantityToDeduct) {
    return {
      success: false,
      sizeInventory: map,
      totalQuantity: total,
      error: `Insufficient stock for size ${targetSize}. Available: ${currentQty}, Requested: ${quantityToDeduct}`,
    };
  }

  map[targetSize] = {
    ...map[targetSize],
    quantity: currentQty - quantityToDeduct,
  };

  const newTotal = sumSizeInventory(map);

  return {
    success: true,
    sizeInventory: map,
    totalQuantity: newTotal,
    deductedSize: targetSize,
  };
}

/**
 * Generates a clean, unique stock code for a size variant based on code1 or stockCode:
 * e.g. base: "saree-05-cherry-red", size: "XL" -> "saree-05-cherry-red-XL"
 */
export function generateVariantStockCode(baseCode: string | null | undefined, size: string): string {
  const cleanBase = String(baseCode || '').trim();
  const cleanSize = String(size || '').trim().toLowerCase();
  if (!cleanBase) return cleanSize;
  // If base already ends with the size (e.g. k-1-orchid-xl), avoid double suffixing
  if (cleanBase.toLowerCase().endsWith(`-${cleanSize}`)) {
    return cleanBase;
  }
  return `${cleanBase}-${cleanSize}`;
}

/**
 * Normalizes and ensures all size entries have a unique variant stock code
 * derived from code1 (or fallback stockCode) while retaining all existing stockCodes.
 */
export function ensureVariantStockCodes(
  sizeInventory: any,
  baseCode: string | null | undefined
): Record<string, SizeInventoryItem> {
  const normalized = normalizeSizeInventory(sizeInventory);
  const result: Record<string, SizeInventoryItem> = {};

  for (const [sz, item] of Object.entries(normalized)) {
    const existingCodes = item.stockCodes && item.stockCodes.length > 0
      ? item.stockCodes
      : (item.stockCode ? item.stockCode.split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean) : []);

    const finalCodes = existingCodes.length > 0
      ? existingCodes
      : [generateVariantStockCode(baseCode, sz)];

    result[sz] = {
      quantity: item.quantity,
      stockCode: finalCodes.join(', '),
      stockCodes: finalCodes,
    };
  }

  return result;
}

/**
 * Consolidates multiple spreadsheet rows that belong to the same product
 * (e.g., rows having the same Code1 or StockCode with different sizes and quantities).
 * Retains all unique stockCodes under each size variant.
 */
export function consolidateSpreadsheetRows<T extends {
  stockCode: string;
  code1?: string | null;
  productCode?: string | null;
  length_Size?: string | null;
  quantity?: number;
  sizeInventory?: any;
  [key: string]: any;
}>(rows: T[]): T[] {
  if (!rows || rows.length === 0) return [];

  const groupMap = new Map<string, T[]>();

  for (const row of rows) {
    const rawCode1 = row.code1 ? String(row.code1).trim() : '';
    const rawStock = row.stockCode ? String(row.stockCode).trim() : '';
    const groupKey = rawCode1 || rawStock;
    if (!groupKey) continue;

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(row);
  }

  const consolidated: T[] = [];

  for (const groupRows of Array.from(groupMap.values())) {
    if (groupRows.length === 1) {
      const single = { ...groupRows[0] };
      const rawSize = single.length_Size ? String(single.length_Size).trim() : null;
      const baseCode = single.code1 || single.stockCode;
      if (rawSize && rawSize !== '-' && !single.sizeInventory) {
        const initialCode = single.stockCode || generateVariantStockCode(baseCode, rawSize);
        single.sizeInventory = {
          [rawSize.toUpperCase()]: {
            quantity: single.quantity || 0,
            stockCode: initialCode,
            stockCodes: initialCode ? [initialCode] : [],
          }
        };
      } else if (single.sizeInventory) {
        single.sizeInventory = ensureVariantStockCodes(single.sizeInventory, baseCode);
      }
      consolidated.push(single);
      continue;
    }

    const primary = { ...groupRows[0] };
    const mergedSizes: Record<string, SizeInventoryItem> = {};
    let totalQty = 0;
    const baseCode = primary.code1 || primary.stockCode;

    for (const r of groupRows) {
      const q = typeof r.quantity === 'number' && !isNaN(r.quantity) ? r.quantity : 0;
      totalQty += q;

      const sz = r.length_Size ? String(r.length_Size).trim() : null;
      if (sz && sz !== '-') {
        const normSz = sz.toUpperCase();
        const existingItem = mergedSizes[normSz];
        const existingCodes = existingItem?.stockCodes || (existingItem?.stockCode ? String(existingItem.stockCode).split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean) : []);
        const incomingCode = r.stockCode ? String(r.stockCode).trim() : null;
        const newCodes = incomingCode ? [incomingCode] : [];
        const mergedCodes = Array.from(new Set([...existingCodes, ...newCodes]));

        mergedSizes[normSz] = {
          quantity: (existingItem?.quantity || 0) + q,
          stockCode: mergedCodes.join(', ') || generateVariantStockCode(r.code1 || baseCode, normSz),
          stockCodes: mergedCodes.length > 0 ? mergedCodes : [generateVariantStockCode(r.code1 || baseCode, normSz)],
        };
      }

      for (const [k, v] of Object.entries(r)) {
        if (((primary as any)[k] === null || (primary as any)[k] === undefined || (primary as any)[k] === '') && v !== null && v !== undefined && v !== '') {
          (primary as any)[k] = v;
        }
      }
    }

    primary.quantity = totalQty;
    primary.sizeInventory = Object.keys(mergedSizes).length > 0
      ? ensureVariantStockCodes(mergedSizes, baseCode)
      : null;

    if (Object.keys(mergedSizes).length > 0) {
      primary.length_Size = Object.keys(mergedSizes).join(', ');
    }

    consolidated.push(primary);
  }

  return consolidated;
}

