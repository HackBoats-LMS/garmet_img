import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface RecordedSearchResponse {
  id: string;
  searchId?: string;
  timestamp: string;
  query?: string;
  found: boolean;
  product?: any;
  rawPayload: any;
  summary: string;
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const SEARCH_RESPONSES_FILE = IS_SERVERLESS
  ? path.join('/tmp', 'picky-assist-search-responses.json')
  : path.join(process.cwd(), 'app', 'api', 'admin', 'picky-test', 'search-responses.json');

// Global event emitter for asynchronous waiting
declare global {
  var __pickySearchEmitter: EventEmitter | undefined;
}

const emitter: EventEmitter = global.__pickySearchEmitter || new EventEmitter();
global.__pickySearchEmitter = emitter;

let inMemorySearchStore: RecordedSearchResponse[] = [];

try {
  if (fs.existsSync(SEARCH_RESPONSES_FILE)) {
    const data = fs.readFileSync(SEARCH_RESPONSES_FILE, 'utf-8');
    inMemorySearchStore = JSON.parse(data);
  }
} catch {
  inMemorySearchStore = [];
}

function hasProductFields(obj: any): boolean {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Boolean(
    obj.stock_code ||
      obj.stockCode ||
      obj.product_id ||
      obj.productId ||
      obj.retailer_id ||
      obj.sku ||
      obj.SKU ||
      obj.variant_code ||
      obj.variantCode ||
      obj.code1 ||
      obj.item_group_id ||
      obj.product_name ||
      obj.productName ||
      obj.title ||
      obj.name
  );
}

/**
 * Extracts product details and query from a Picky Assist search callback payload
 */
export function parseSearchCallbackPayload(payload: any): {
  searchId?: string;
  query?: string;
  found: boolean;
  product?: any;
  summary: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { found: false, summary: 'Empty or invalid payload' };
  }

  const searchId = payload.searchId || payload.search_id || undefined;
  let product: any = null;
  let query =
    payload.query ||
    payload.search ||
    payload.stock_code ||
    payload.stockCode ||
    payload.code1 ||
    payload.identifier;

  // Unwrap nested result/data/product strings or objects (supports both {...} and [...] JSON strings)
  let unwrapped: any = payload;
  let cameFromNestedField = false;

  if (typeof payload.result === 'string') {
    const trimmedRes = payload.result.trim();
    if (trimmedRes.startsWith('{') || trimmedRes.startsWith('[')) {
      try {
        unwrapped = JSON.parse(trimmedRes);
        cameFromNestedField = true;
      } catch {
        // Keep raw payload if JSON parse fails
      }
    }
  } else if (payload.result && typeof payload.result === 'object') {
    unwrapped = payload.result;
    cameFromNestedField = true;
  } else if (payload.data && typeof payload.data === 'object') {
    unwrapped = payload.data;
    cameFromNestedField = true;
  } else if (payload.product && typeof payload.product === 'object') {
    unwrapped = payload.product;
    cameFromNestedField = true;
  }

  // Check array of records
  let records: any[] = [];
  if (Array.isArray(unwrapped)) {
    records = unwrapped;
  } else if (unwrapped && typeof unwrapped === 'object') {
    if (Array.isArray(unwrapped.records)) {
      records = unwrapped.records;
    } else if (Array.isArray(unwrapped.data)) {
      records = unwrapped.data;
    } else if (Array.isArray(unwrapped.items)) {
      records = unwrapped.items;
    } else if (Array.isArray(unwrapped.products)) {
      records = unwrapped.products;
    } else if (Array.isArray(unwrapped.result)) {
      records = unwrapped.result;
    }
  }

  const isExplicitEmptyResult =
    payload.result === '' ||
    payload.result === null ||
    payload.result === '0' ||
    payload.result === 0 ||
    payload.result === false ||
    payload.result === 'false' ||
    payload.total_records === 0 ||
    payload.count === 0 ||
    payload.exists === false ||
    payload.found === false;

  if (records.length > 0) {
    product = records[0];
  } else if (!isExplicitEmptyResult && unwrapped && typeof unwrapped === 'object') {
    // Only treat root payload as a product if it wasn't just query params + empty result
    if (cameFromNestedField ? hasProductFields(unwrapped) : Boolean(unwrapped.stock_code || unwrapped.stockCode || unwrapped.product_id || unwrapped.sku || unwrapped.retailer_id || unwrapped.code1 || unwrapped.product_name || unwrapped.productName)) {
      product = unwrapped;
    }
  }

  let found = false;
  let summary = '';

  if (product && typeof product === 'object' && Object.keys(product).length > 0) {
    found = true;
    const title = product.product_name || product.title || product.productName || product.name || 'Product';
    const code =
      product.stock_code ||
      product.stockCode ||
      product.product_id ||
      product.sku ||
      product.code1 ||
      query ||
      'item';
    summary = `Found product '${title}' (${code}) in Picky Assist`;
    if (!query) query = code;
  } else if (
    payload.exists === true ||
    payload.found === true ||
    payload.result === '1' ||
    payload.result === 1 ||
    payload.result === true ||
    payload.result === 'true' ||
    (typeof payload.result === 'number' && payload.result > 0) ||
    (typeof payload.total_records === 'number' && payload.total_records > 0) ||
    (typeof payload.count === 'number' && payload.count > 0)
  ) {
    found = true;
    summary = `Product exists in Picky Assist (${payload.result || payload.total_records || payload.count || 1} match found)`;
  } else if (isExplicitEmptyResult) {
    found = false;
    summary = 'Picky Assist returned 0 records (product not found)';
  } else {
    found = false;
    summary = 'Search callback received with no matching product data';
  }

  return { searchId, query, found, product, summary };
}

/**
 * Saves an incoming search callback response
 */
export function saveSearchResponse(payload: any): RecordedSearchResponse {
  const { searchId, query, found, product, summary } = parseSearchCallbackPayload(payload);
  const id = `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const entry: RecordedSearchResponse = {
    id,
    searchId,
    timestamp: new Date().toISOString(),
    query,
    found,
    product,
    rawPayload: payload,
    summary,
  };

  inMemorySearchStore.unshift(entry);
  if (inMemorySearchStore.length > 30) {
    inMemorySearchStore = inMemorySearchStore.slice(0, 30);
  }

  // Non-blocking asynchronous file persistence to prevent event loop freeze
  const dataToFlush = JSON.stringify(inMemorySearchStore, null, 2);
  const dir = path.dirname(SEARCH_RESPONSES_FILE);
  fs.promises.mkdir(dir, { recursive: true })
    .then(() => fs.promises.writeFile(SEARCH_RESPONSES_FILE, dataToFlush, 'utf-8'))
    .catch((err) => {
      console.warn('[Search Store] Async file persist note:', err?.message || err);
    });

  if (searchId) {
    emitter.emit(`searchId:${searchId}`, entry);
  }
  if (query) {
    emitter.emit(`search:${String(query).toLowerCase().trim()}`, entry);
  }
  emitter.emit('search:any', entry);

  return entry;
}

/**
 * Returns latest recorded search responses
 */
export function getLatestSearchResponses(): RecordedSearchResponse[] {
  try {
    if (fs.existsSync(SEARCH_RESPONSES_FILE)) {
      const data = fs.readFileSync(SEARCH_RESPONSES_FILE, 'utf-8');
      inMemorySearchStore = JSON.parse(data);
    }
  } catch (readErr) {
    console.warn('[Search Store] Could not parse search response file from disk:', readErr);
  }
  return inMemorySearchStore;
}

function matchesWaitCriteria(
  entry: RecordedSearchResponse,
  cleanKey: string,
  minTimestamp: number,
  searchId?: string
): boolean {
  const entryTs = new Date(entry.timestamp).getTime();
  if (Number.isNaN(entryTs) || entryTs < minTimestamp) {
    return false;
  }

  // If searchId was supplied and the callback echoed a DIFFERENT searchId, do not match
  if (searchId && entry.searchId && entry.searchId !== searchId) {
    return false;
  }
  if (searchId && entry.searchId === searchId) {
    return true;
  }

  // Otherwise match by query identifier, or unlabelled response (e.g. bare {"result":""}) arriving after startedAt
  if (!entry.query) return true;
  return String(entry.query).toLowerCase().trim() === cleanKey;
}

/**
 * Asynchronously waits for a search response to arrive via webhook.
 * Strictly ignores stale responses recorded before `startedAt`.
 */
export async function waitForSearchResponse(
  identifier: string,
  timeoutMs: number = 8000,
  opts?: { startedAt?: number; searchId?: string }
): Promise<RecordedSearchResponse | null> {
  const cleanKey = identifier.toLowerCase().trim();
  const minTimestamp = opts?.startedAt ?? Date.now();
  const searchId = opts?.searchId;

  // 1. Check only entries recorded AFTER this search began (never return stale cache!)
  const immediate = inMemorySearchStore.find((r) => matchesWaitCriteria(r, cleanKey, minTimestamp, searchId));
  if (immediate) return immediate;

  // 2. Wait for event listener + lightweight file poll fallback (handles worker/process separation)
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (entry: RecordedSearchResponse | null) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(entry);
      }
    };

    const onSearchResponse = (entry: RecordedSearchResponse) => {
      if (matchesWaitCriteria(entry, cleanKey, minTimestamp, searchId)) {
        finish(entry);
      }
    };

    const pollInterval = setInterval(() => {
      try {
        if (fs.existsSync(SEARCH_RESPONSES_FILE)) {
          const data = fs.readFileSync(SEARCH_RESPONSES_FILE, 'utf-8');
          const diskList: RecordedSearchResponse[] = JSON.parse(data);
          const match = diskList.find((r) => matchesWaitCriteria(r, cleanKey, minTimestamp, searchId));
          if (match) {
            finish(match);
          }
        }
      } catch {
        // Ignore transient read/parse races during concurrent write
      }
    }, 350);

    const timer = setTimeout(() => {
      finish(null);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(pollInterval);
      if (searchId) {
        emitter.removeListener(`searchId:${searchId}`, onSearchResponse);
      }
      emitter.removeListener(`search:${cleanKey}`, onSearchResponse);
      emitter.removeListener('search:any', onSearchResponse);
    };

    if (searchId) {
      emitter.on(`searchId:${searchId}`, onSearchResponse);
    }
    emitter.on(`search:${cleanKey}`, onSearchResponse);
    emitter.on('search:any', onSearchResponse);
  });
}
