/**
 * Size Inventory Utility
 * 
 * Manages size-wise breakdown of garment inventory (e.g. {"S": 2, "M": 5, "XL": 1})
 * seamlessly keeping it synchronized with total aggregate quantity.
 */

export interface SizeInventoryItem {
  quantity: number;
  stockCode?: string | null;
}

export type SizeInventoryMap = Record<string, SizeInventoryItem | number>;

/**
 * Normalizes any incoming size inventory representation into a clean Record<string, SizeInventoryItem>.
 * Supports:
 * - Legacy format: {"XL": 3, "XXL": 2}
 * - Detailed format: {"XL": { quantity: 3, stockCode: "5270000094" }, "XXL": { quantity: 2, stockCode: "5270000095" }}
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
      };
    } else if (typeof val === 'object' && val !== null) {
      const q = parseInt(String((val as any).quantity ?? (val as any).qty ?? 0), 10);
      const sCode = (val as any).stockCode ? String((val as any).stockCode).trim() : null;
      result[trimmedSize] = {
        quantity: isNaN(q) ? 0 : Math.max(0, q),
        stockCode: sCode,
      };
    } else {
      const q = parseInt(String(val), 10);
      if (!isNaN(q)) {
        result[trimmedSize] = {
          quantity: Math.max(0, q),
          stockCode: null,
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

  // 1. Exact match on variant stockCode (case-insensitive)
  for (const [size, item] of Object.entries(normalized)) {
    if (item.stockCode && String(item.stockCode).trim().toLowerCase() === cleanBarcode) {
      return { size, item };
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
 * Returns the new map and the new total quantity.
 */
export function addOrUpdateSizeStock(
  currentMap: any,
  size: string,
  quantityToAdd: number,
  stockCode?: string | null
): { sizeInventory: Record<string, SizeInventoryItem>; totalQuantity: number } {
  const map = { ...normalizeSizeInventory(currentMap) };
  const normalizedSize = String(size).trim().toUpperCase();

  const currentItem = map[normalizedSize] || { quantity: 0, stockCode: null };
  const updatedQty = Math.max(0, currentItem.quantity + quantityToAdd);
  
  map[normalizedSize] = {
    quantity: updatedQty,
    stockCode: stockCode !== undefined ? stockCode : currentItem.stockCode,
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
      if (item.stockCode && String(item.stockCode).trim().toLowerCase() === queryLower) {
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
 * derived from code1 (or fallback stockCode).
 */
export function ensureVariantStockCodes(
  sizeInventory: any,
  baseCode: string | null | undefined
): Record<string, SizeInventoryItem> {
  const normalized = normalizeSizeInventory(sizeInventory);
  const result: Record<string, SizeInventoryItem> = {};

  for (const [sz, item] of Object.entries(normalized)) {
    result[sz] = {
      quantity: item.quantity,
      // If explicit barcode/stockCode exists (e.g. from Excel column), use it; otherwise auto-generate from code1
      stockCode: item.stockCode && item.stockCode.trim() !== ''
        ? item.stockCode.trim()
        : generateVariantStockCode(baseCode, sz),
    };
  }

  return result;
}

/**
 * Consolidates multiple spreadsheet rows that belong to the same product
 * (e.g., rows having the same Code1 or StockCode with different sizes and quantities).
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
        single.sizeInventory = {
          [rawSize.toUpperCase()]: {
            quantity: single.quantity || 0,
            stockCode: single.stockCode || generateVariantStockCode(baseCode, rawSize),
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
        mergedSizes[normSz] = {
          quantity: (existingItem?.quantity || 0) + q,
          stockCode: r.stockCode || existingItem?.stockCode || generateVariantStockCode(r.code1 || baseCode, normSz),
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

