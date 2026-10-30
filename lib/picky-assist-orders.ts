import prisma from '@/lib/prisma';
import { findSizeByStockCode, deductSizeStock, normalizeSizeInventory } from '@/lib/size-inventory';
import { syncOrderToPactERP } from '@/lib/pact-sync';

export interface ExtractedOrderItem {
  rawItem: any;
  stockCode: string;
  quantity: number;
  size?: string;
  price?: number;
  title?: string;
  sourceFieldStockCode: string;
  sourceFieldQuantity: string;
  sourceFieldSize?: string;
}

export interface ExtractedOrderMeta {
  orderId: string;
  customerPhone: string;
  customerName: string;
  notes?: string;
  totalAmount?: number;
  paymentStatus?: string;
  sourceFieldOrderId: string;
  sourceFieldPhone: string;
}

export interface FieldMappingEntry {
  sourceField: string;
  sourceValue: any;
  targetDbField: string;
  description: string;
  matchStatus: 'matched' | 'warning' | 'unmapped' | 'fallback';
  detail?: string;
}

export interface ProcessedItemReport {
  stockCodeRequested: string;
  sourceField: string;
  quantityRequested: number;
  sizeRequested?: string;
  matched: boolean;
  product?: {
    id: string;
    productName: string;
    stockCode: string;
    code1?: string | null;
    coverImageUrl?: string | null;
    oldQuantity: number;
    newQuantity: number;
    sizeMatched?: string;
    sizeBreakdown?: Record<string, any>;
  };
  status: 'deducted' | 'simulated' | 'insufficient_stock' | 'not_found' | 'invalid';
  reason?: string;
}

export interface ProcessOrderResult {
  success: boolean;
  actionTaken: 'INVENTORY_DEDUCTED' | 'SIMULATED' | 'NO_ITEMS_FOUND' | 'PRODUCTS_NOT_FOUND' | 'ERROR';
  orderMeta: ExtractedOrderMeta;
  itemsProcessed: ProcessedItemReport[];
  fieldMappings: FieldMappingEntry[];
  summaryMessage: string;
  rawPayloadSummary: any;
}

/**
 * Normalizes all object keys by trimming surrounding whitespace (e.g. "order_id " -> "order_id")
 */
export function cleanPayloadKeys(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  if (Array.isArray(raw)) return raw.map(cleanPayloadKeys);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) {
    const cleanKey = k.trim();
    out[cleanKey] = v && typeof v === 'object' ? cleanPayloadKeys(v) : v;
  }
  return out;
}

/**
 * Universal body parser that accepts Request / NextRequest / raw string / object.
 * Robustly parses:
 * - Clean JSON
 * - application/x-www-form-urlencoded
 * - Nested JSON strings in fields like 'result', 'data', 'payload', 'order'
 */
export async function parsePickyAssistWebhookBody(
  reqOrBody: Request | any,
  providedRawText?: string
): Promise<{ parsedBody: any; rawBody: string; contentType: string }> {
  let contentType = '';
  let rawBody = '';

  if (typeof (reqOrBody as any)?.text === 'function') {
    contentType = (reqOrBody as Request).headers.get('content-type') || '';
    try {
      rawBody = await (reqOrBody as Request).text();
    } catch (err: any) {
      rawBody = `[Error reading request body: ${err.message}]`;
    }
  } else if (typeof reqOrBody === 'string') {
    rawBody = reqOrBody;
  } else if (typeof providedRawText === 'string') {
    rawBody = providedRawText;
  } else if (reqOrBody && typeof reqOrBody === 'object') {
    const cleaned = cleanPayloadKeys(reqOrBody);
    return {
      parsedBody: cleaned,
      rawBody: JSON.stringify(cleaned, null, 2),
      contentType: 'application/json',
    };
  }

  if (!rawBody || !rawBody.trim()) {
    return { parsedBody: {}, rawBody: '', contentType };
  }

  const trimmed = rawBody.trim();

  // 1. Try direct JSON parse
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        parsedBody: cleanPayloadKeys(unwrapNestedJson(parsed)),
        rawBody,
        contentType: contentType || 'application/json',
      };
    } catch {
      // fallback to urlencoded
    }
  }

  // 2. Try URLSearchParams (form-urlencoded)
  try {
    const params = new URLSearchParams(trimmed);
    const formObj: Record<string, any> = {};
    let hasKeys = false;

    params.forEach((val, key) => {
      hasKeys = true;
      const cleanKey = key.trim();
      let parsedVal: any = val;
      const valTrimmed = String(val).trim();
      if ((valTrimmed.startsWith('{') && valTrimmed.endsWith('}')) || (valTrimmed.startsWith('[') && valTrimmed.endsWith(']'))) {
        try {
          parsedVal = JSON.parse(valTrimmed);
        } catch {
          parsedVal = val;
        }
      }
      formObj[cleanKey] = parsedVal;
    });

    if (hasKeys) {
      return {
        parsedBody: cleanPayloadKeys(unwrapNestedJson(formObj)),
        rawBody,
        contentType: contentType || 'application/x-www-form-urlencoded',
      };
    }
  } catch {
    // not valid url params
  }

  // 3. Fallback as raw text wrapper
  return {
    parsedBody: { raw_text: rawBody },
    rawBody,
    contentType: contentType || 'text/plain',
  };
}

/**
 * If Picky Assist encapsulates data in `{ data: "..." }` or `{ result: "{...}" }` or `{ order: "..." }`,
 * safely unwrap and parse inner JSON.
 */
function unwrapNestedJson(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key of ['data', 'payload', 'result', 'order', 'event_data', 'webhook_data']) {
    if (typeof obj[key] === 'string') {
      const trimmed = obj[key].trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const inner = JSON.parse(trimmed);
          obj[key] = unwrapNestedJson(inner);
        } catch {
          // ignore
        }
      }
    }
  }

  return obj;
}

/**
 * Extracts items and order metadata from any Picky Assist / WhatsApp webhook schema.
 */
export function extractOrderFromPayload(rawPayload: any): {
  meta: ExtractedOrderMeta;
  items: ExtractedOrderItem[];
  fieldMappings: FieldMappingEntry[];
} {
  const fieldMappings: FieldMappingEntry[] = [];
  const p = cleanPayloadKeys(rawPayload || {});

  // Support WhatsApp Cloud API / Meta message structure
  // e.g. entry[0].changes[0].value.messages[0].order
  let waOrder: any = null;
  let waSender: any = null;
  if (Array.isArray(p.entry)) {
    for (const ent of p.entry) {
      if (Array.isArray(ent?.changes)) {
        for (const ch of ent.changes) {
          const val = ch?.value;
          if (val) {
            if (val.contacts && val.contacts[0]) {
              waSender = val.contacts[0];
            }
            if (Array.isArray(val.messages)) {
              for (const msg of val.messages) {
                if (msg?.order) {
                  waOrder = msg.order;
                  if (!waSender && msg.from) {
                    waSender = { phone: msg.from };
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  // Find root object if wrapped
  const target = waOrder || p.order || p.data?.order || p.data || p.result?.order || p.result || p.payload?.order || p.payload || p;

  // 1. Extract Order ID (handling "order_id", "order_reference", etc.)
  let orderId = '';
  let sourceFieldOrderId = '';
  if (target.order_reference) {
    orderId = String(target.order_reference).trim();
    sourceFieldOrderId = 'order_reference';
  } else if (target.order_id) {
    orderId = String(target.order_id).trim();
    sourceFieldOrderId = 'order_id';
  } else if (target.orderId) {
    orderId = String(target.orderId).trim();
    sourceFieldOrderId = 'orderId';
  } else if (target.order_record_id) {
    orderId = String(target.order_record_id).trim();
    sourceFieldOrderId = 'order_record_id';
  } else if (target.id) {
    orderId = String(target.id).trim();
    sourceFieldOrderId = 'id';
  } else {
    orderId = `PA-ORD-${Date.now()}`;
    sourceFieldOrderId = '(auto-generated fallback)';
  }

  fieldMappings.push({
    sourceField: sourceFieldOrderId,
    sourceValue: orderId,
    targetDbField: 'InventoryLog.note (Order Reference)',
    description: 'Unique order identifier from Picky Assist used for audit log tracking',
    matchStatus: sourceFieldOrderId.includes('fallback') ? 'fallback' : 'matched',
  });

  // 2. Extract Customer Phone
  let customerPhone = '';
  let sourceFieldPhone = '';
  if (waSender?.phone || waSender?.wa_id) {
    customerPhone = String(waSender.phone || waSender.wa_id).trim();
    sourceFieldPhone = 'whatsapp.sender';
  } else if (target.customer?.phone) {
    customerPhone = String(target.customer.phone).trim();
    sourceFieldPhone = 'customer.phone';
  } else if (target.phone) {
    customerPhone = String(target.phone).trim();
    sourceFieldPhone = 'phone';
  } else if (target.from) {
    customerPhone = String(target.from).trim();
    sourceFieldPhone = 'from';
  } else if (target.mobile) {
    customerPhone = String(target.mobile).trim();
    sourceFieldPhone = 'mobile';
  } else if (target.sender) {
    customerPhone = String(target.sender).trim();
    sourceFieldPhone = 'sender';
  } else {
    customerPhone = 'Unknown Phone';
    sourceFieldPhone = '(none)';
  }

  fieldMappings.push({
    sourceField: sourceFieldPhone,
    sourceValue: customerPhone,
    targetDbField: 'InventoryLog.note (Customer Phone)',
    description: 'WhatsApp number of customer who ordered',
    matchStatus: customerPhone !== 'Unknown Phone' ? 'matched' : 'fallback',
  });

  // 3. Customer Name
  const customerName = waSender?.profile?.name || target.customer?.name || target.name || target.customer_name || 'WhatsApp Customer';
  if (waSender?.profile?.name || target.customer?.name || target.name) {
    fieldMappings.push({
      sourceField: waSender?.profile?.name ? 'whatsapp.profile.name' : target.customer?.name ? 'customer.name' : 'name',
      sourceValue: customerName,
      targetDbField: 'InventoryLog.note (Customer Name)',
      description: 'Customer contact name',
      matchStatus: 'matched',
    });
  }

  // 4. Extract Items
  const items: ExtractedOrderItem[] = [];

  // Check array candidate locations
  let rawList: any[] | null = null;
  let listSourcePath = '';

  if (Array.isArray(target.product_items)) {
    rawList = target.product_items;
    listSourcePath = 'product_items';
  } else if (Array.isArray(target.items)) {
    rawList = target.items;
    listSourcePath = 'items';
  } else if (Array.isArray(target.products)) {
    rawList = target.products;
    listSourcePath = 'products';
  } else if (Array.isArray(target.line_items)) {
    rawList = target.line_items;
    listSourcePath = 'line_items';
  } else if (Array.isArray(p.product_items)) {
    rawList = p.product_items;
    listSourcePath = 'product_items';
  } else if (Array.isArray(p.items)) {
    rawList = p.items;
    listSourcePath = 'items';
  } else if (Array.isArray(p.data?.items)) {
    rawList = p.data.items;
    listSourcePath = 'data.items';
  } else if (Array.isArray(p.data?.product_items)) {
    rawList = p.data.product_items;
    listSourcePath = 'data.product_items';
  }

  if (rawList && rawList.length > 0) {
    rawList.forEach((rawItem, idx) => {
      const prefix = `${listSourcePath}[${idx}]`;

      // Find stockCode identifier
      let stockCode = '';
      let sourceFieldStockCode = '';

      if (rawItem.product_retailer_id) {
        stockCode = String(rawItem.product_retailer_id).trim();
        sourceFieldStockCode = `${prefix}.product_retailer_id`;
      } else if (rawItem.product_id) {
        stockCode = String(rawItem.product_id).trim();
        sourceFieldStockCode = `${prefix}.product_id`;
      } else if (rawItem.productId) {
        stockCode = String(rawItem.productId).trim();
        sourceFieldStockCode = `${prefix}.productId`;
      } else if (rawItem.variant_code) {
        stockCode = String(rawItem.variant_code).trim();
        sourceFieldStockCode = `${prefix}.variant_code`;
      } else if (rawItem.stock_code) {
        stockCode = String(rawItem.stock_code).trim();
        sourceFieldStockCode = `${prefix}.stock_code`;
      } else if (rawItem.stockCode) {
        stockCode = String(rawItem.stockCode).trim();
        sourceFieldStockCode = `${prefix}.stockCode`;
      } else if (rawItem.code1) {
        stockCode = String(rawItem.code1).trim();
        sourceFieldStockCode = `${prefix}.code1`;
      } else if (rawItem.sku) {
        stockCode = String(rawItem.sku).trim();
        sourceFieldStockCode = `${prefix}.sku`;
      } else if (rawItem.barcode) {
        stockCode = String(rawItem.barcode).trim();
        sourceFieldStockCode = `${prefix}.barcode`;
      } else if (rawItem.id) {
        stockCode = String(rawItem.id).trim();
        sourceFieldStockCode = `${prefix}.id`;
      }

      // Quantity
      let quantity = 1;
      let sourceFieldQuantity = '';

      if (rawItem.quantity !== undefined && rawItem.quantity !== '') {
        quantity = parseInt(String(rawItem.quantity), 10);
        sourceFieldQuantity = `${prefix}.quantity`;
      } else if (rawItem.qty !== undefined && rawItem.qty !== '') {
        quantity = parseInt(String(rawItem.qty), 10);
        sourceFieldQuantity = `${prefix}.qty`;
      } else if (rawItem.quantity_ordered !== undefined && rawItem.quantity_ordered !== '') {
        quantity = parseInt(String(rawItem.quantity_ordered), 10);
        sourceFieldQuantity = `${prefix}.quantity_ordered`;
      } else if (rawItem.units !== undefined && rawItem.units !== '') {
        quantity = parseInt(String(rawItem.units), 10);
        sourceFieldQuantity = `${prefix}.units`;
      } else {
        quantity = 1;
        sourceFieldQuantity = '(default: 1)';
      }

      if (isNaN(quantity) || quantity <= 0) quantity = 1;

      // Size
      let size: string | undefined = undefined;
      let sourceFieldSize: string | undefined = undefined;

      if (rawItem.size && String(rawItem.size).trim()) {
        size = String(rawItem.size).trim().toUpperCase();
        sourceFieldSize = `${prefix}.size`;
      } else if (rawItem.variant_id && String(rawItem.variant_id).trim()) {
        size = String(rawItem.variant_id).trim().toUpperCase();
        sourceFieldSize = `${prefix}.variant_id`;
      } else if (rawItem.variant && String(rawItem.variant).trim()) {
        size = String(rawItem.variant).trim().toUpperCase();
        sourceFieldSize = `${prefix}.variant`;
      }

      const price = parseFloat(String(rawItem.item_price || rawItem.unit_price || rawItem.price || 0)) || 0;
      const title = rawItem.product_name || rawItem.productName || rawItem.title || rawItem.name || '';

      if (stockCode || title) {
        items.push({
          rawItem,
          stockCode: stockCode || title,
          quantity,
          size,
          price,
          title,
          sourceFieldStockCode: sourceFieldStockCode || `${prefix}.product_name`,
          sourceFieldQuantity,
          sourceFieldSize,
        });

        fieldMappings.push({
          sourceField: sourceFieldStockCode || `${prefix}.product_name`,
          sourceValue: stockCode || title,
          targetDbField: 'Product.stockCode / Product.code1 / sizeInventory',
          description: `Item #${idx + 1} product identifier`,
          matchStatus: 'matched',
        });

        fieldMappings.push({
          sourceField: sourceFieldQuantity,
          sourceValue: quantity,
          targetDbField: `Product.quantity (Deduction: -${quantity})`,
          description: `Item #${idx + 1} ordered quantity to subtract`,
          matchStatus: 'matched',
        });

        if (size) {
          fieldMappings.push({
            sourceField: sourceFieldSize || `${prefix}.size`,
            sourceValue: size,
            targetDbField: `Product.sizeInventory[${size}].quantity`,
            description: `Size variant specific stock deduction`,
            matchStatus: 'matched',
          });
        }
      }
    });
  }

  // 5. If no array items found, check if root payload itself represents a single item sale
  if (items.length === 0) {
    let singleCode = '';
    let singleSourceField = '';

    if (target.product_id) {
      singleCode = String(target.product_id).trim();
      singleSourceField = 'product_id';
    } else if (target.productId) {
      singleCode = String(target.productId).trim();
      singleSourceField = 'productId';
    } else if (target.product_retailer_id) {
      singleCode = String(target.product_retailer_id).trim();
      singleSourceField = 'product_retailer_id';
    } else if (target.stock_code) {
      singleCode = String(target.stock_code).trim();
      singleSourceField = 'stock_code';
    } else if (target.stockCode) {
      singleCode = String(target.stockCode).trim();
      singleSourceField = 'stockCode';
    } else if (target.code1) {
      singleCode = String(target.code1).trim();
      singleSourceField = 'code1';
    } else if (target.sku) {
      singleCode = String(target.sku).trim();
      singleSourceField = 'sku';
    } else if (target.item_code) {
      singleCode = String(target.item_code).trim();
      singleSourceField = 'item_code';
    } else if (target.barcode) {
      singleCode = String(target.barcode).trim();
      singleSourceField = 'barcode';
    } else if (target.product_code) {
      singleCode = String(target.product_code).trim();
      singleSourceField = 'product_code';
    } else if (target.product_name) {
      singleCode = String(target.product_name).trim();
      singleSourceField = 'product_name';
    }

    if (singleCode) {
      let singleQty = 1;
      let singleQtyField = '';

      if (target.quantity !== undefined && target.quantity !== '') {
        singleQty = Math.abs(parseInt(String(target.quantity), 10));
        singleQtyField = 'quantity';
      } else if (target.qty !== undefined && target.qty !== '') {
        singleQty = Math.abs(parseInt(String(target.qty), 10));
        singleQtyField = 'qty';
      } else if (target.sold_qty !== undefined && target.sold_qty !== '') {
        singleQty = Math.abs(parseInt(String(target.sold_qty), 10));
        singleQtyField = 'sold_qty';
      } else if (target.quantity_ordered !== undefined && target.quantity_ordered !== '') {
        singleQty = Math.abs(parseInt(String(target.quantity_ordered), 10));
        singleQtyField = 'quantity_ordered';
      } else if (target.qty_change !== undefined && target.qty_change !== '') {
        singleQty = Math.abs(parseInt(String(target.qty_change), 10));
        singleQtyField = 'qty_change';
      } else {
        singleQty = 1;
        singleQtyField = '(default: 1)';
      }

      if (isNaN(singleQty) || singleQty <= 0) singleQty = 1;

      const singleSize = target.size && String(target.size).trim() ? String(target.size).trim().toUpperCase() : undefined;
      const title = target.product_name || target.productName || target.title || target.name || '';

      items.push({
        rawItem: target,
        stockCode: singleCode,
        quantity: singleQty,
        size: singleSize,
        price: parseFloat(String(target.price || target.unit_price || 0)) || 0,
        title,
        sourceFieldStockCode: singleSourceField,
        sourceFieldQuantity: singleQtyField,
        sourceFieldSize: singleSize ? 'size' : undefined,
      });

      fieldMappings.push({
        sourceField: singleSourceField,
        sourceValue: singleCode,
        targetDbField: 'Product.stockCode / Product.code1 / sizeInventory',
        description: 'Product identifier from webhook',
        matchStatus: 'matched',
      });

      fieldMappings.push({
        sourceField: singleQtyField,
        sourceValue: singleQty,
        targetDbField: `Product.quantity (Deduction: -${singleQty})`,
        description: 'Single item quantity to subtract',
        matchStatus: 'matched',
      });

      if (title && singleSourceField !== 'product_name') {
        fieldMappings.push({
          sourceField: 'product_name',
          sourceValue: title,
          targetDbField: 'Product.productName (Reference & Fallback Matcher)',
          description: 'Product title passed in webhook payload',
          matchStatus: 'matched',
        });
      }

      if (singleSize) {
        fieldMappings.push({
          sourceField: 'size',
          sourceValue: singleSize,
          targetDbField: `Product.sizeInventory[${singleSize}].quantity`,
          description: `Size variant specific stock deduction`,
          matchStatus: 'matched',
        });
      }
    }
  }

  const meta: ExtractedOrderMeta = {
    orderId,
    customerPhone,
    customerName,
    notes: target.notes || target.order_notes || '',
    totalAmount: parseFloat(String(target.total_amount || target.total || target.amount || 0)) || 0,
    paymentStatus: target.payment_status || target.status || 'paid',
    sourceFieldOrderId,
    sourceFieldPhone,
  };

  return { meta, items, fieldMappings };
}

/**
 * Executes or simulates order processing against the Prisma Database.
 * Deducts quantities from Product and variant sizeInventory, and logs to InventoryLog.
 */
export async function processPickyAssistOrder(
  payload: any,
  options: { dryRun?: boolean } = {}
): Promise<ProcessOrderResult> {
  const { meta, items, fieldMappings } = extractOrderFromPayload(payload);
  const itemsProcessed: ProcessedItemReport[] = [];

  if (items.length === 0) {
    return {
      success: false,
      actionTaken: 'NO_ITEMS_FOUND',
      orderMeta: meta,
      itemsProcessed: [],
      fieldMappings,
      summaryMessage: 'No product items or stock codes detected in the incoming payload.',
      rawPayloadSummary: typeof payload === 'object' ? Object.keys(payload) : typeof payload,
    };
  }

  let anyDeducted = false;

  for (const item of items) {
    const code = item.stockCode;
    const qty = item.quantity;

    try {
      // ── MULTI-TIER VARIANT RESOLVER ──
      // Handles size-variant codes, barcodes, code1 suffixes, and direct product IDs
      let product: any = null;
      let detectedSize = item.size ? String(item.size).trim().toUpperCase() : undefined;
      let variantStockCode: string | undefined = undefined;
      let matchMethod = 'direct';

      const cleanCode = code.trim();
      const cleanCodeLower = cleanCode.toLowerCase();

      // 1. Check for matching variant barcode / stockCode in sizeInventory (OPTIMIZED: Push to PostgreSQL)
      // Guarded with jsonb_typeof and try/catch to ensure non-object JSON values never crash the resolver
      try {
        const variantMatch = await prisma.$queryRaw<{
          id: string;
          stockCode: string;
          code1: string | null;
          productName: string;
          quantity: number;
          sizeInventory: any;
        }[]>`
          SELECT id, "stockCode", "code1", "productName", quantity, "sizeInventory"
          FROM "Product"
          WHERE "sizeInventory" IS NOT NULL
            AND jsonb_typeof("sizeInventory") = 'object'
            AND EXISTS (
              SELECT 1
              FROM jsonb_each("sizeInventory") AS kv(key, val)
              WHERE (val->>'stockCode') ILIKE ${cleanCode}
            )
          LIMIT 1
        `;

        if (variantMatch.length > 0) {
          const matched = variantMatch[0];
          product = matched;
          matchMethod = 'variant_barcode_match';
          // Extract the matched size key from sizeInventory
          const sizeInv = matched.sizeInventory as Record<string, any>;
          for (const [sizeKey, sizeVal] of Object.entries(sizeInv)) {
            if (sizeVal?.stockCode && String(sizeVal.stockCode).toLowerCase() === cleanCodeLower) {
              detectedSize = sizeKey.toUpperCase();
              variantStockCode = sizeVal.stockCode;
              break;
            }
          }
        }
      } catch (rawErr) {
        // Graceful fallback to standard lookup if raw query fails
        console.warn(`[Picky Assist Orders] variant barcode raw query skipped for ${cleanCode}`);
      }

      // 2. If not found by variant barcode, check if code contains a size suffix:
      // e.g. "KPD-2-NAVY-XL", "saree-05-cherry-red-m", "KP-39-MAROON-3XL", "5020000204-5XL"
      if (!product) {
        const lastDash = Math.max(cleanCode.lastIndexOf('-'), cleanCode.lastIndexOf('_'));
        if (lastDash > 0) {
          const potentialBase = cleanCode.slice(0, lastDash).trim();
          const potentialSize = cleanCode.slice(lastDash + 1).trim().toUpperCase();

          const pCandidate = await prisma.product.findFirst({
            where: {
              OR: [
                { code1: { equals: potentialBase, mode: 'insensitive' } },
                { stockCode: { equals: potentialBase, mode: 'insensitive' } },
                { productCode: { equals: potentialBase, mode: 'insensitive' } },
              ],
            },
          });

          if (pCandidate) {
            product = pCandidate;
            matchMethod = 'variant_suffix_match';
            // Verify if potentialSize exists in sizeInventory
            const norm = pCandidate.sizeInventory ? Object.keys(pCandidate.sizeInventory as any).map(s => s.toUpperCase()) : [];
            if (norm.includes(potentialSize)) {
              detectedSize = potentialSize;
            } else if (!detectedSize) {
              detectedSize = potentialSize;
            }
          }
        }
      }

      // 3. Search database for direct Product match by stockCode, code1, productCode, or id
      if (!product) {
        product = await prisma.product.findFirst({
          where: {
            OR: [
              { stockCode: { equals: cleanCode, mode: 'insensitive' } },
              { code1: { equals: cleanCode, mode: 'insensitive' } },
              { productCode: { equals: cleanCode, mode: 'insensitive' } },
              ...(cleanCode.length > 20 ? [{ id: cleanCode }] : []),
            ],
          },
        });
        if (product) matchMethod = 'product_code_match';
      }

      // 4. Fallback search by Product Name / Title if code not found directly
      if (!product && item.title) {
        const cleanTitle = item.title.trim();
        product = await prisma.product.findFirst({
          where: {
            productName: { contains: cleanTitle, mode: 'insensitive' },
          },
          orderBy: { quantity: 'desc' },
        });
        if (product) matchMethod = 'product_title_fallback';
      }

      // If product found, resolve exact size variant if not yet determined
      if (product && product.sizeInventory) {
        const sizeMap = product.sizeInventory as Record<string, any>;
        const sizeKeys = Object.keys(sizeMap);

        if (!detectedSize) {
          // If explicit size in item.size
          if (item.size && String(item.size).trim()) {
            detectedSize = String(item.size).trim().toUpperCase();
          } else if (item.title) {
            // Check if size is mentioned in title (e.g. "KURTA PANT - XL")
            for (const sz of sizeKeys) {
              const regex = new RegExp(`\\b${sz}\\b`, 'i');
              if (regex.test(item.title)) {
                detectedSize = sz.toUpperCase();
                break;
              }
            }
          }

          // If still no size and only 1 size variant exists in sizeInventory
          if (!detectedSize && sizeKeys.length === 1) {
            detectedSize = sizeKeys[0].toUpperCase();
          }
        }
      }

      if (!product) {
        itemsProcessed.push({
          stockCodeRequested: code,
          sourceField: item.sourceFieldStockCode,
          quantityRequested: qty,
          sizeRequested: item.size,
          matched: false,
          status: 'not_found',
          reason: `Variant code / identifier '${code}'${item.title ? ` ('${item.title}')` : ''} not found in database.`,
        });
        continue;
      }

      // Check stock availability at size-variant level and total product level
      let sizeAvailable = product.quantity;
      if (detectedSize && product.sizeInventory) {
        const norm = normalizeSizeInventory(product.sizeInventory);
        if (norm[detectedSize]) {
          sizeAvailable = norm[detectedSize].quantity;
        }
      }

      if (sizeAvailable < qty) {
        itemsProcessed.push({
          stockCodeRequested: code,
          sourceField: item.sourceFieldStockCode,
          quantityRequested: qty,
          sizeRequested: detectedSize,
          matched: true,
          product: {
            id: product.id,
            productName: product.productName,
            stockCode: product.stockCode,
            code1: product.code1,
            coverImageUrl: product.coverImageUrl,
            oldQuantity: product.quantity,
            newQuantity: product.quantity,
            sizeMatched: detectedSize,
            sizeBreakdown: product.sizeInventory as any,
          },
          status: 'insufficient_stock',
          reason: detectedSize
            ? `Insufficient stock for size ${detectedSize} of '${product.productName}'. Available: ${sizeAvailable}, requested: ${qty}`
            : `Insufficient inventory for '${product.productName}'. Available: ${product.quantity}, requested: ${qty}`,
        });
        continue;
      }

      // Calculate size-specific deduction if applicable
      let nextSizeInv = product.sizeInventory;
      let finalQty = Math.max(0, product.quantity - qty);

      if (detectedSize && product.sizeInventory) {
        const deductRes = deductSizeStock(product.sizeInventory, detectedSize, qty);
        if (deductRes.success) {
          nextSizeInv = deductRes.sizeInventory as any;
          finalQty = deductRes.totalQuantity;
        }
      }

      const autoStatus = finalQty === 0 ? 'OUT_OF_STOCK' : product.status;

      // If dry run, do not commit to DB
      if (options.dryRun) {
        itemsProcessed.push({
          stockCodeRequested: code,
          sourceField: item.sourceFieldStockCode,
          quantityRequested: qty,
          sizeRequested: detectedSize,
          matched: true,
          product: {
            id: product.id,
            productName: product.productName,
            stockCode: product.stockCode,
            code1: product.code1,
            coverImageUrl: product.coverImageUrl,
            oldQuantity: product.quantity,
            newQuantity: finalQty,
            sizeMatched: detectedSize,
            sizeBreakdown: nextSizeInv as any,
          },
          status: 'simulated',
          reason: detectedSize
            ? `Simulated size deduction for '${product.productName}' (${detectedSize}): Size stock ${sizeAvailable} -> ${Math.max(0, sizeAvailable - qty)}, Total stock ${product.quantity} -> ${finalQty}`
            : `Simulated deduction for '${product.productName}': ${product.quantity} -> ${finalQty}`,
        });
        anyDeducted = true;
        continue;
      }

      // Commit to Database in a transaction
      await prisma.$transaction([
        prisma.product.update({
          where: { id: product.id },
          data: {
            quantity: finalQty,
            reservedQty: product.reservedQty + qty,
            soldQty: product.soldQty + qty,
            sizeInventory: (nextSizeInv as any) ?? undefined,
            status: autoStatus,
          },
        }),
        prisma.inventoryLog.create({
          data: {
            productId: product.id,
            action: 'picky_assist_sale',
            qtyChange: -qty,
            qtyAfter: finalQty,
            note: `Picky Assist Order ${meta.orderId} | Phone: ${meta.customerPhone}${detectedSize ? ` | Size: ${detectedSize}` : ''} | VariantCode: ${code} (${product.productName})${variantStockCode ? ` | Barcode: ${variantStockCode}` : ''}`.trim(),
            source: 'picky_assist',
          },
        }),
      ]);

      anyDeducted = true;

      itemsProcessed.push({
        stockCodeRequested: code,
        sourceField: item.sourceFieldStockCode,
        quantityRequested: qty,
        sizeRequested: detectedSize,
        matched: true,
        product: {
          id: product.id,
          productName: product.productName,
          stockCode: product.stockCode,
          code1: product.code1,
          coverImageUrl: product.coverImageUrl,
          oldQuantity: product.quantity,
          newQuantity: finalQty,
          sizeMatched: detectedSize,
          sizeBreakdown: nextSizeInv as any,
        },
        status: 'deducted',
        reason: detectedSize
          ? `Deducted ${qty} unit(s) from size ${detectedSize} of '${product.productName}'. Size stock: ${sizeAvailable} -> ${Math.max(0, sizeAvailable - qty)}. Total stock: ${product.quantity} -> ${finalQty}`
          : `Deducted ${qty} unit(s) from '${product.productName}'. New stock: ${finalQty}`,
      });
    } catch (err: any) {
      console.error(`[Picky Assist Orders] DB update failed for ${code}:`, err);
      itemsProcessed.push({
        stockCodeRequested: code,
        sourceField: item.sourceFieldStockCode,
        quantityRequested: qty,
        sizeRequested: item.size,
        matched: false,
        status: 'invalid',
        reason: `Database error: ${err.message}`,
      });
    }
  }

  // Forward successful items to PACT ERP if not dry run
  if (!options.dryRun && anyDeducted) {
    const successItems = itemsProcessed
      .filter((r) => r.status === 'deducted' && r.product)
      .map((r) => ({
        sku: r.product!.stockCode,
        quantity: r.quantityRequested,
        price: 0,
      }));

    if (successItems.length > 0) {
      syncOrderToPactERP({
        source_channel: 'WhatsApp',
        order_reference: meta.orderId,
        order_date: new Date().toISOString(),
        customer_name: meta.customerName,
        customer_phone: meta.customerPhone,
        items: successItems,
        total_price: meta.totalAmount || 0,
      });
    }
  }

  const successCount = itemsProcessed.filter((i) => i.status === 'deducted' || i.status === 'simulated').length;
  const notFoundCount = itemsProcessed.filter((i) => i.status === 'not_found').length;

  let actionTaken: ProcessOrderResult['actionTaken'] = 'PRODUCTS_NOT_FOUND';
  let summaryMessage = '';

  if (options.dryRun) {
    actionTaken = 'SIMULATED';
    summaryMessage = `Simulated order ${meta.orderId}: ${successCount}/${itemsProcessed.length} items mapped successfully.`;
  } else if (successCount > 0) {
    actionTaken = 'INVENTORY_DEDUCTED';
    summaryMessage = `Order ${meta.orderId} processed: Successfully deducted inventory for ${successCount} item(s).`;
  } else if (notFoundCount > 0) {
    actionTaken = 'PRODUCTS_NOT_FOUND';
    summaryMessage = `Order ${meta.orderId} received: ${notFoundCount} product(s) could not be found in DB.`;
  }

  return {
    success: successCount > 0,
    actionTaken,
    orderMeta: meta,
    itemsProcessed,
    fieldMappings,
    summaryMessage,
    rawPayloadSummary: typeof payload === 'object' ? Object.keys(payload) : typeof payload,
  };
}
