// ─────────────────────────────────────────────────────────────────────────────
// lib/picky-assist-push.ts
// ─────────────────────────────────────────────────────────────────────────────
import { waitForSearchResponse } from '@/lib/picky-assist-search-store';

export interface PickyAssistProductPayload {
  stock_code: string;
  code1?: string;
  productName?: string;
  title?: string;
  productDescription?: string;
  description?: string;
  unitPrice?: number;
  price?: number;
  retailPrice?: number;
  mrp?: number;
  quantity?: number;
  color?: string;
  cloth_type?: string;
  clothType?: string;
  cover_image_url?: string;
  coverImageUrl?: string;
  tags?: string[];
  category?: string;
  sub_category?: string;
  whatsapp_catalogue_title?: string;
  whatsappCatalogueTitle?: string;
  whatsappRetail?: string;
  whatsappWholesale?: string;
  instagram_caption?: string;
  instagramCaption?: string;
  status?: string;
  size?: string;
  size_inventory?: Record<string, any>;
  sizeInventory?: Record<string, any>;
  [key: string]: any;
}

/**
 * Extract up to 5 clean image URLs for Picky Assist catalog from product:
 * 1. coverImageUrl
 * 2. generatedImages (sorted by order)
 * 3. referenceImages (uploaded swatches)
 */
export function extractProductImages(product: any): string[] {
  const images: string[] = [];

  const addImg = (url: any) => {
    if (typeof url === 'string' && url.trim() && !images.includes(url.trim())) {
      images.push(url.trim());
    }
  };

  // Primary cover image
  addImg(product.coverImageUrl || product.cover_image_url);

  // Generated photoshoot images
  const genImgs = product.generatedImages;
  if (genImgs && typeof genImgs === 'object') {
    const sorted = Object.entries(genImgs).sort(([, a]: any, [, b]: any) => (a?.order ?? 0) - (b?.order ?? 0));
    for (const [, item] of sorted) {
      if ((item as any)?.imageUrl) addImg((item as any).imageUrl);
    }
  }

  // Reference / Swatch images
  const refImgs = product.referenceImages;
  if (Array.isArray(refImgs)) {
    for (const item of refImgs) {
      if (typeof item === 'string') addImg(item);
      else if (item?.url) addImg(item.url);
    }
  }

  // Cap at 5 images
  return images.slice(0, 5);
}

export function formatProductPayload(product: any, variantSize?: string): Record<string, any> {
  const masterStockCode = String(product.stockCode || product.stock_code || '').trim();
  const code1 = product.code1 || product.friendlyCode || product.friendly_code;
  const baseProductName = product.productName || product.title || product.whatsappCatalogueTitle || masterStockCode;
  const description = product.productDescription || product.description || product.whatsappRetail || '';
  const price = product.retailPrice ?? product.unitPrice ?? product.price ?? 0;
  const mrp = product.retailPrice ?? product.mrp ?? price;
  const baseQuantity = typeof product.quantity === 'number' ? product.quantity : parseInt(product.quantity, 10) || 0;
  const category = product.category?.name || (typeof product.category === 'string' ? product.category : '');
  const subCategory = product.subCategory?.name || (typeof product.subCategory === 'string' ? product.subCategory : '');

  // Extract up to 5 images for Picky Assist
  const imageList = extractProductImages(product);
  const image1 = imageList[0] || '';
  const image2 = imageList[1] || '';
  const image3 = imageList[2] || '';
  const image4 = imageList[3] || '';
  const image5 = imageList[4] || '';

  // Parse size inventory with multi-stock code support
  const rawSizeInv = product.sizeInventory || product.size_inventory;
  let normalizedSizes: Record<string, { quantity: number; stockCode: string | null; stockCodes?: string[] }> = {};
  if (rawSizeInv && typeof rawSizeInv === 'object') {
    for (const [sKey, sVal] of Object.entries(rawSizeInv)) {
      const trimmedSize = String(sKey).trim().toUpperCase();
      if (!trimmedSize) continue;
      if (typeof sVal === 'number') {
        normalizedSizes[trimmedSize] = { quantity: Math.max(0, sVal), stockCode: null, stockCodes: [] };
      } else if (typeof sVal === 'object' && sVal !== null) {
        const rawCodes = Array.isArray((sVal as any).stockCodes) ? (sVal as any).stockCodes.map(String).map((s: string) => s.trim()).filter(Boolean) : [];
        const rawCodeStr = (sVal as any).stockCode ? String((sVal as any).stockCode).trim() : null;
        const derivedCodes = rawCodes.length > 0
          ? rawCodes
          : (rawCodeStr ? rawCodeStr.split(/[,;|\s]+/).map((s: string) => s.trim()).filter(Boolean) : []);
        normalizedSizes[trimmedSize] = {
          quantity: Math.max(0, parseInt(String((sVal as any).quantity ?? 0), 10) || 0),
          stockCode: rawCodeStr || (derivedCodes[0] ?? null),
          stockCodes: derivedCodes,
        };
      }
    }
  }

  const sizeList = Object.keys(normalizedSizes);
  const availableSizes = sizeList.filter(s => (normalizedSizes[s]?.quantity ?? 0) > 0);

  // All distinct barcodes across all variants
  const allBarcodes: string[] = [];
  for (const item of Object.values(normalizedSizes)) {
    if (item.stockCodes && item.stockCodes.length > 0) {
      item.stockCodes.forEach(c => { if (!allBarcodes.includes(c)) allBarcodes.push(c); });
    } else if (item.stockCode && !allBarcodes.includes(item.stockCode)) {
      allBarcodes.push(item.stockCode);
    }
  }

  // If this payload is formatted specifically for a single size variant:
  let effectiveStockCode = masterStockCode;
  let effectiveProductName = baseProductName;
  let effectiveQuantity = baseQuantity;
  let effectiveSize = variantSize || (availableSizes.length > 0 ? availableSizes.join(', ') : (product.length_Size || product.size || 'Free Size'));

  // item_group_id must strictly be code1 (e.g. saree-05-cherry-red)
  const itemGroupId = String(code1 || masterStockCode || '').trim();

  // variant_code must be strictly created from code1 and the size: e.g. k-1-orchid-xl
  let variantCode = itemGroupId;
  let variantSpecificBarcode = '';
  let variantStockCodes: string[] = [];

  if (variantSize) {
    const sizeData = normalizedSizes[variantSize];
    const cleanSize = String(variantSize).trim().toLowerCase();
    variantCode = `${itemGroupId}-${cleanSize}`;
    effectiveQuantity = sizeData ? sizeData.quantity : baseQuantity;
    effectiveSize = variantSize;
    variantStockCodes = sizeData?.stockCodes || (sizeData?.stockCode ? [sizeData.stockCode] : []);
    variantSpecificBarcode = variantStockCodes[0] || sizeData?.stockCode || variantCode;
  } else if (availableSizes.length === 1 && availableSizes[0].toUpperCase() !== 'FREE') {
    const cleanSize = availableSizes[0].trim().toLowerCase();
    variantCode = `${itemGroupId}-${cleanSize}`;
    const singleData = normalizedSizes[availableSizes[0]];
    variantStockCodes = singleData?.stockCodes || (singleData?.stockCode ? [singleData.stockCode] : []);
    variantSpecificBarcode = variantStockCodes[0] || singleData?.stockCode || variantCode;
  }

  // Build nested variants array for Picky Assist catalog / CRM connectors that support batch variant objects
  const variantsList = Object.entries(normalizedSizes).map(([sz, sData]) => {
    const vCode = `${itemGroupId}-${sz.toLowerCase()}`;
    const vCodes = sData.stockCodes && sData.stockCodes.length > 0 ? sData.stockCodes : (sData.stockCode ? [sData.stockCode] : []);
    const vBarcode = vCodes[0] || sData.stockCode || vCode;

    return {
      id: vCode,
      product_id: vCode,
      productId: vCode,
      sku: vCode,
      SKU: vCode,
      variant_sku: vCode,
      variant_id: vCode,
      variant_code: vCode,
      variantCode: vCode,
      retailer_id: vCode,
      barcode: vBarcode,
      barcodes: vCodes.join(', '),
      stock_code: sData.stockCode || vBarcode || masterStockCode,
      stock_codes: vCodes,
      title: `${effectiveProductName} - ${sz}`,
      name: `${effectiveProductName} - ${sz}`,
      size: sz,
      variant: sz,
      variant_name: sz,
      color: String(product.color || '').trim(),
      material: String(product.clothType || product.cloth_type || 'Silk').trim(),
      cloth_type: String(product.clothType || product.cloth_type || 'Silk').trim(),
      option_name: 'Size',
      option_value: sz,
      option1_name: 'Size',
      option1_value: sz,
      price: price,
      unit_price: price,
      unitPrice: price,
      variant_price: price,
      variantPrice: price,
      regular_price: mrp,
      sale_price: price,
      mrp: mrp,
      retail_price: mrp,
      retailPrice: mrp,
      currency: 'INR',
      currency_code: 'INR',
      formatted_price: `${price} INR`,
      quantity: sData.quantity,
      qty: sData.quantity,
      stock: sData.quantity,
      image_link: image1,
      image_url: image1,
      image: image1,
    };
  });

  return {
    // 1. Identification & Variant Mapping (Covers Meta Catalog, Picky Assist & WhatsApp Commerce standards)
    product_id: variantCode,
    productId: variantCode,
    retailer_id: variantCode,
    id: variantCode,
    sku: variantCode,
    SKU: variantCode,
    variant_sku: variantCode,
    variant_id: variantCode,
    variant_code: variantCode,
    variantCode: variantCode,
    stock_code: masterStockCode,
    stockCode: masterStockCode,
    item_group_id: itemGroupId,
    itemGroupId: itemGroupId,
    code1: code1 || masterStockCode,
    barcode: variantSpecificBarcode || (allBarcodes[0] ?? variantCode),
    barcodes: allBarcodes.join(', '),
    stock_codes: variantStockCodes.length > 0 ? variantStockCodes : allBarcodes,

    // 2. Core Details & Variant Name
    title: effectiveProductName,
    name: effectiveProductName,
    productName: effectiveProductName,
    description: description,
    productDescription: description,
    color: String(product.color || '').trim(),
    cloth_type: String(product.clothType || product.cloth_type || 'Silk').trim(),
    material: String(product.clothType || product.cloth_type || 'Silk').trim(),
    fabric: String(product.clothType || product.cloth_type || 'Silk').trim(),
    tags: Array.isArray(product.tags) ? product.tags.join(', ') : String(product.tags || ''),
    category: category,
    sub_category: subCategory,
    status: product.status || (effectiveQuantity > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'),
    availability: effectiveQuantity > 0 ? 'in stock' : 'out of stock',

    // 3. Garment Specifications (Picky Assist custom catalog & CRM fields)
    embroidery_type: product.embroideryType || '',
    embroideryType: product.embroideryType || '',
    cut_style: product.cutStyle || '',
    cutStyle: product.cutStyle || '',
    border: product.border || '',
    kurta_length: product.kurtaLength || '',
    kurtaLength: product.kurtaLength || '',
    pant_style: product.pantStyle || '',
    pantStyle: product.pantStyle || '',
    location: product.location || '',
    design_number: product.productCode || product.designNumber || '',
    product_code: product.productCode || product.designNumber || '',
    design_no: product.productCode || product.designNumber || '',

    // 4. Pricing & Currency (Mapped per variant for Meta Catalog & WhatsApp Commerce)
    price: price,
    unit_price: price,
    unitPrice: price,
    variant_price: price,
    variantPrice: price,
    regular_price: mrp,
    regularPrice: mrp,
    sale_price: price,
    salePrice: price,
    mrp: mrp,
    retail_price: mrp,
    retailPrice: mrp,
    wholesale_price: product.dealerPrice ?? product.wholesalePrice ?? null,
    dealer_price: product.dealerPrice ?? product.wholesalePrice ?? null,
    currency: 'INR',
    currency_code: 'INR',
    formatted_price: `${price} INR`,
    price_formatted: `${price} INR`,

    // 5. Variant Attributes & Options (Pure strings only — never pass raw array here)
    quantity: effectiveQuantity,
    qty: effectiveQuantity,
    stock: effectiveQuantity,
    size: String(effectiveSize).trim(),
    variant: String(effectiveSize).trim(),
    variant_name: String(effectiveSize).trim(),
    variantName: String(effectiveSize).trim(),
    option_name: 'Size',
    option_value: String(effectiveSize).trim(),
    option1_name: 'Size',
    option1_value: String(effectiveSize).trim(),
    size_inventory: normalizedSizes,

    // 6. Nested Variants List (For connectors supporting structured variant arrays)
    variants: variantsList.length > 0 ? variantsList : undefined,

    // 7. Product Images (Direct public JPEG URLs < 5MB)
    image_link: image1,
    imageLink: image1,
    image_url: image1,
    imageUrl: image1,
    image: image1,
    cover_image_url: image1,
    coverImageUrl: image1,
    image_1: image1,
    image_2: image2,
    image_3: image3,
    image_4: image4,
    image_5: image5,

    // 8. WhatsApp Catalog & Broadcast Helpers
    whatsapp_catalogue_title: product.whatsappCatalogueTitle || effectiveProductName,
    whatsapp_retail: product.whatsappRetail || description,
    whatsapp_wholesale: product.whatsappWholesale || '',
    instagram_caption: product.instagramCaption || '',
    facebook_caption: product.facebookCaption || '',
    shopify_title: product.shopifyTitle || '',
  };
}

export async function searchPickyProduct(identifier: string): Promise<{ exists: boolean; product?: any; raw?: any }> {
  const webhookUrl = process.env.PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Picky Assist] PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL is not configured');
    return { exists: false };
  }

  const callbackUrl = process.env.PICKY_ASSIST_SEARCH_CALLBACK_URL || 'https://unshaken-runway-emit.ngrok-free.dev/api/webhooks/picky-assist/search-response';

  try {
    const payload = {
      search: identifier,
      stock_code: identifier,
      stockCode: identifier,
      code1: identifier,
      productCode: identifier,
      product_id: identifier,
      callback_url: callbackUrl,
      webhook_url: callbackUrl,
      reply_url: callbackUrl,
    };

    let response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let rawData: any = null;
    const text = await response.text();
    try {
      rawData = JSON.parse(text);
    } catch {
      rawData = text;
    }

    if (!response.ok) {
      // If endpoint returns 404, product is not found
      if (response.status === 404) {
        return { exists: false, raw: rawData };
      }
      console.warn(`[Picky Assist] Search returned status ${response.status}:`, rawData);
      return { exists: false, raw: rawData };
    }

    // Evaluate response format
    // Picky Assist connector search:
    // When Picky Assist executes "SEARCH RECORDS FROM CRM -> EXECUTED ( Total Records found - 1 )",
    // the connector endpoint returns HTTP 200 OK with an empty body "" or status: 200 with headers like PICKY-CONNECTOR-LOG.
    if (response.ok) {
      if (rawData === '' || rawData === null || rawData === undefined) {
        console.log(`[Picky Assist] Search triggered for '${identifier}'. Waiting for inbound callback on ${callbackUrl}...`);
        const callbackEntry = await waitForSearchResponse(identifier, 8000);
        if (callbackEntry) {
          return {
            exists: callbackEntry.found,
            product: callbackEntry.product,
            raw: callbackEntry.rawPayload,
          };
        }

        return {
          exists: false,
          raw: `HTTP 200 OK received from search connector, but no callback arrived within 3.5s. Please ensure your Picky Assist connector has a Webhook action posting search results to ${callbackUrl}`,
        };
      }

      if (typeof rawData === 'object') {
        if (
          rawData.exists === false ||
          rawData.found === false ||
          rawData.status === 'not_found' ||
          rawData.error === 'not_found' ||
          rawData.total_records === 0 ||
          rawData.count === 0
        ) {
          return { exists: false, raw: rawData };
        }
        if (
          rawData.exists === true ||
          rawData.found === true ||
          (typeof rawData.total_records === 'number' && rawData.total_records > 0) ||
          (typeof rawData.count === 'number' && rawData.count > 0)
        ) {
          return { exists: true, product: rawData.product || rawData.data || rawData, raw: rawData };
        }
        if (Array.isArray(rawData)) {
          if (rawData.length > 0) {
            return { exists: true, product: rawData[0], raw: rawData };
          }
          return { exists: false, raw: rawData };
        }
        if (Array.isArray(rawData.data) || Array.isArray(rawData.products) || Array.isArray(rawData.records) || Array.isArray(rawData.items)) {
          const list = rawData.data || rawData.products || rawData.records || rawData.items;
          if (list.length > 0) {
            return { exists: true, product: list[0], raw: rawData };
          }
          return { exists: false, raw: rawData };
        }
        // If it returns an object matching stockCode or id
        if (rawData.stock_code || rawData.stockCode || rawData.code1 || rawData.id || rawData.productName) {
          return { exists: true, product: rawData, raw: rawData };
        }
      }

      return { exists: false, raw: rawData };
    }

    return { exists: false, raw: rawData };
  } catch (err) {
    console.error(`[Picky Assist] Error searching for ${identifier}:`, err);
    return { exists: false, raw: String(err) };
  }
}

export async function addPickyProduct(
  product: any,
  options?: { pushVariants?: boolean }
): Promise<{ success: boolean; status?: number; data?: any; error?: string; variantsPushed?: number }> {
  const webhookUrl = process.env.PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL is not configured' };
  }

  const shouldPushVariants = options?.pushVariants !== false;
  const sizeInv = product.sizeInventory || product.size_inventory;
  let sizeEntries: string[] = [];

  if (shouldPushVariants && sizeInv && typeof sizeInv === 'object') {
    sizeEntries = Object.keys(sizeInv).filter(s => s.trim().toUpperCase() !== 'FREE');
  }

  try {
    // If the product has multiple size variants, push each size variant directly with the shared item_group_id.
    // We do NOT send a generic parent payload, as that creates an extra duplicate/phantom variant row in Picky Assist!
    if (sizeEntries.length > 1) {
      let variantsCount = 0;
      let firstStatus = 200;
      let firstData: any = null;

      for (const sz of sizeEntries) {
        try {
          const variantPayload = formatProductPayload(product, sz);
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variantPayload),
          });
          const text = await response.text();
          let data: any = text;
          try { data = JSON.parse(text); } catch { }

          if (variantsCount === 0) {
            firstStatus = response.status;
            firstData = data;
          }
          if (response.ok) {
            variantsCount++;
          } else {
            console.warn(`[Picky Assist] Variant ${sz} push status ${response.status}:`, data);
          }
        } catch (vErr) {
          console.warn(`[Picky Assist] Error pushing variant ${sz} for ${product.stockCode}:`, vErr);
        }
      }

      console.log(`[Picky Assist] ✅ Added ${variantsCount} size variants for ${product.stockCode}`);
      return { success: variantsCount > 0, status: firstStatus, data: firstData, variantsPushed: variantsCount };
    }

    // Single size or no size variants -> push single product payload
    const mainPayload = formatProductPayload(product, sizeEntries[0]);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mainPayload),
    });

    const text = await response.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { }

    if (!response.ok) {
      console.error(`[Picky Assist] Add failed for ${mainPayload.stock_code}. Status: ${response.status}`, data);
      return { success: false, status: response.status, data, error: `Picky Assist returned HTTP ${response.status}` };
    }

    console.log(`[Picky Assist] ✅ Added product ${mainPayload.stock_code}`);
    return { success: true, status: response.status, data, variantsPushed: 1 };
  } catch (err: any) {
    console.error(`[Picky Assist] Error adding product ${product.stockCode}:`, err);
    return { success: false, error: err.message || 'Network error adding product' };
  }
}

export async function updatePickyProduct(
  product: any,
  changedFields?: Record<string, any>,
  options?: { pushVariants?: boolean }
): Promise<{
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  variantsUpdated?: number;
  results?: Array<{ size: string; variantCode: string; success: boolean; status: number; data?: any; error?: string }>;
}> {
  const webhookUrl = process.env.PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) {
    return { success: false, error: 'PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL is not configured' };
  }

  const shouldPushVariants = options?.pushVariants !== false;
  const sizeInv = product.sizeInventory || product.size_inventory;
  let sizeEntries: string[] = [];

  if (shouldPushVariants && sizeInv && typeof sizeInv === 'object') {
    sizeEntries = Object.keys(sizeInv).filter(s => s.trim().toUpperCase() !== 'FREE');
  }

  try {
    // If the product has size variants, update each size variant directly as its own product
    // using variant_code as product_id and code1 as item_group_id
    if (sizeEntries.length > 0) {
      let variantsCount = 0;
      let firstStatus = 200;
      let firstData: any = null;
      const results: Array<{ size: string; variantCode: string; success: boolean; status: number; data?: any; error?: string }> = [];

      for (const sz of sizeEntries) {
        try {
          // 1. Format payload specifically for this variant (e.g. S, M, L)
          // product_id = variant_code (e.g. k-1-orchid-s), item_group_id = code1 (k-1-orchid), quantity = size S qty
          const formatted = formatProductPayload(product, sz);

          // 2. Apply changedFields, but strictly protect variant-specific fields from being overwritten
          const payload = { ...formatted };
          if (changedFields && typeof changedFields === 'object') {
            for (const [k, v] of Object.entries(changedFields)) {
              // Never overwrite variant identification, size, or variant-specific quantities
              const protectedKeys = [
                'product_id', 'productId', 'id', 'retailer_id', 'sku', 'SKU',
                'variant_sku', 'variant_id', 'variant_code', 'variantCode',
                'item_group_id', 'itemGroupId', 'code1',
                'quantity', 'qty', 'stock',
                'size', 'variant', 'variant_name', 'variantName',
                'option_value', 'option1_value',
                'barcode', 'barcodes', 'stock_codes'
              ];
              if (!protectedKeys.includes(k)) {
                payload[k] = v;
              }
            }
          }

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          const text = await response.text();
          let data: any = text;
          try { data = JSON.parse(text); } catch { }

          results.push({
            size: sz,
            variantCode: formatted.product_id,
            success: response.ok,
            status: response.status,
            data,
            error: !response.ok ? `HTTP ${response.status}` : undefined,
          });

          if (variantsCount === 0) {
            firstStatus = response.status;
            firstData = data;
          }
          if (response.ok) {
            variantsCount++;
          } else {
            console.warn(`[Picky Assist] Variant ${sz} (${formatted.product_id}) update status ${response.status}:`, data);
          }
        } catch (vErr: any) {
          console.warn(`[Picky Assist] Error updating variant ${sz} for ${product.stockCode}:`, vErr);
          results.push({
            size: sz,
            variantCode: `${product.code1 || product.stockCode}-${sz.toLowerCase()}`,
            success: false,
            status: 500,
            error: vErr.message,
          });
        }
      }

      console.log(`[Picky Assist] ✅ Updated ${variantsCount}/${sizeEntries.length} size variants for ${product.stockCode}`);
      return {
        success: variantsCount > 0,
        status: firstStatus,
        data: firstData,
        variantsUpdated: variantsCount,
        results,
      };
    }

    // Single size or no size variants -> update single product payload
    const formatted = formatProductPayload(product);
    const payload = { ...formatted };
    if (changedFields && typeof changedFields === 'object') {
      Object.assign(payload, changedFields);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { }

    if (!response.ok) {
      console.error(`[Picky Assist] Update failed for ${payload.stock_code}. Status: ${response.status}`, data);
      return { success: false, status: response.status, data, error: `Picky Assist returned HTTP ${response.status}` };
    }

    console.log(`[Picky Assist] ✅ Updated product ${payload.stock_code}`);
    return { success: true, status: response.status, data, variantsUpdated: 1 };
  } catch (err: any) {
    console.error(`[Picky Assist] Error updating product ${product.stockCode}:`, err);
    return { success: false, error: err.message || 'Network error updating product' };
  }
}

/**
 * Smart Sync:
 * 1. Checks PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL to see if product exists in Picky Assist.
 * 2. If NOT found -> calls PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL.
 * 3. If ALREADY exists -> computes differences (diff) and calls PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL.
 */
export async function syncPickyProductWithDiff(localProduct: any): Promise<{
  action: 'added' | 'updated' | 'no_change';
  success: boolean;
  message: string;
  diff?: Record<string, { local: any; remote: any }>;
  remoteProduct?: any;
}> {
  // 1. Try matching primary identifier (code1, stockCode, id)
  const primaryId = localProduct.code1 || localProduct.stockCode || localProduct.id;
  let searchResult = await searchPickyProduct(primaryId);

  // 2. If not found, and there is a secondary barcode / stockCode, search it too
  if (!searchResult.exists && localProduct.stockCode && localProduct.stockCode !== primaryId) {
    const secResult = await searchPickyProduct(localProduct.stockCode);
    if (secResult.exists) {
      searchResult = secResult;
    }
  }

  // 3. If still not found and product has size variants, check first size variant code (e.g. K-1-ORCHID-5x)
  if (!searchResult.exists) {
    const rawSizeInv = localProduct.sizeInventory || localProduct.size_inventory;
    if (rawSizeInv && typeof rawSizeInv === 'object') {
      const firstSize = Object.keys(rawSizeInv)[0];
      if (firstSize) {
        const itemGroupId = localProduct.code1 || localProduct.stockCode;
        const vCode = `${itemGroupId}-${firstSize.toLowerCase()}`;
        const vResult = await searchPickyProduct(vCode);
        if (vResult.exists) {
          searchResult = vResult;
        }
      }
    }
  }

  // 4. Product does NOT exist in Picky Assist -> ADD
  if (!searchResult.exists) {
    const addResult = await addPickyProduct(localProduct);
    if (!addResult.success) {
      return {
        action: 'added',
        success: false,
        message: addResult.error || 'Failed to add product to Picky Assist',
      };
    }
    return {
      action: 'added',
      success: true,
      message: `Product ${primaryId} was not in Picky Assist. Created new catalog entry.`,
    };
  }

  // 5. Product DOES exist -> Compare diff and UPDATE
  const remote = searchResult.product || {};
  const localFormatted = formatProductPayload(localProduct);

  const diff: Record<string, { local: any; remote: any }> = {};
  const changedFields: Record<string, any> = {};

  const fieldsToCompare = [
    { key: 'quantity', localVal: localFormatted.quantity, remoteVal: remote.quantity ?? remote.qty },
    { key: 'unitPrice', localVal: localFormatted.unitPrice, remoteVal: remote.unitPrice ?? remote.price },
    { key: 'retailPrice', localVal: localFormatted.retailPrice, remoteVal: remote.retailPrice ?? remote.mrp },
    { key: 'productName', localVal: localFormatted.productName, remoteVal: remote.productName ?? remote.title },
    { key: 'status', localVal: localFormatted.status, remoteVal: remote.status },
    { key: 'color', localVal: localFormatted.color, remoteVal: remote.color },
    { key: 'coverImageUrl', localVal: localFormatted.coverImageUrl, remoteVal: remote.coverImageUrl ?? remote.cover_image_url ?? remote.image_link },
    { key: 'description', localVal: localFormatted.description, remoteVal: remote.description ?? remote.productDescription },
    { key: 'size', localVal: localFormatted.size, remoteVal: remote.size ?? remote.length_Size },
    { key: 'size_inventory', localVal: JSON.stringify(localFormatted.size_inventory), remoteVal: remote.size_inventory ? JSON.stringify(remote.size_inventory) : undefined },
    { key: 'kurta_length', localVal: localFormatted.kurta_length, remoteVal: remote.kurta_length ?? remote.kurtaLength },
    { key: 'pant_style', localVal: localFormatted.pant_style, remoteVal: remote.pant_style ?? remote.pantStyle },
    { key: 'embroidery_type', localVal: localFormatted.embroidery_type, remoteVal: remote.embroidery_type ?? remote.embroideryType },
    { key: 'cut_style', localVal: localFormatted.cut_style, remoteVal: remote.cut_style ?? remote.cutStyle },
    { key: 'border', localVal: localFormatted.border, remoteVal: remote.border },
    { key: 'dealer_price', localVal: localFormatted.dealer_price, remoteVal: remote.dealer_price ?? remote.wholesale_price },
  ];

  for (const f of fieldsToCompare) {
    if (f.remoteVal !== undefined && f.remoteVal !== null) {
      const loc = f.localVal === undefined || f.localVal === null ? '' : String(f.localVal).trim();
      const rem = String(f.remoteVal).trim();

      if (loc !== rem) {
        diff[f.key] = { local: f.localVal, remote: f.remoteVal };
        changedFields[f.key] = f.key === 'size_inventory' ? localFormatted.size_inventory : f.localVal;
      }
    }
  }

  const hasDiff = Object.keys(diff).length > 0;
  const updateResult = await updatePickyProduct(localProduct, hasDiff ? changedFields : undefined);

  if (!updateResult.success) {
    return {
      action: 'updated',
      success: false,
      message: updateResult.error || 'Failed to update product in Picky Assist',
      diff,
      remoteProduct: remote,
    };
  }

  return {
    action: 'updated',
    success: true,
    message: hasDiff
      ? `Product ${primaryId} found in Picky Assist. Updated fields: ${Object.keys(diff).join(', ')}.`
      : `Product ${primaryId} found in Picky Assist. Updated stock & details.`,
    diff,
    remoteProduct: remote,
  };
}
