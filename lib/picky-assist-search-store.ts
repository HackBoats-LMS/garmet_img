import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface RecordedSearchResponse {
  id: string;
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

/**
 * Extracts product details and query from a Picky Assist search callback payload
 */
export function parseSearchCallbackPayload(payload: any): {
  query?: string;
  found: boolean;
  product?: any;
  summary: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { found: false, summary: 'Empty or invalid payload' };
  }

  // Find candidate product object
  let product: any = null;
  let query = payload.query || payload.search || payload.stock_code || payload.stockCode || payload.code1 || payload.identifier;

  // If payload has 'result' that is a string containing JSON
  let unwrapped = payload;
  if (typeof payload.result === 'string' && payload.result.trim().startsWith('{')) {
    try {
      unwrapped = JSON.parse(payload.result);
    } catch {}
  } else if (payload.data && typeof payload.data === 'object') {
    unwrapped = payload.data;
  } else if (payload.product && typeof payload.product === 'object') {
    unwrapped = payload.product;
  }

  // Check array of records
  let records: any[] = [];
  if (Array.isArray(unwrapped)) {
    records = unwrapped;
  } else if (Array.isArray(unwrapped.records)) {
    records = unwrapped.records;
  } else if (Array.isArray(unwrapped.data)) {
    records = unwrapped.data;
  } else if (Array.isArray(unwrapped.items)) {
    records = unwrapped.items;
  } else if (Array.isArray(unwrapped.result)) {
    records = unwrapped.result;
  }

  if (records.length > 0) {
    product = records[0];
  } else if (unwrapped.stock_code || unwrapped.stockCode || unwrapped.product_id || unwrapped.code1 || unwrapped.product_name) {
    product = unwrapped;
  }

  let found = false;
  let summary = '';

  if (product && Object.keys(product).length > 0) {
    found = true;
    const title = product.product_name || product.title || product.productName || 'Product';
    const code = product.stock_code || product.stockCode || product.product_id || product.code1 || query || 'item';
    summary = `Found product '${title}' (${code}) in Picky Assist`;
    if (!query) query = code;
  } else if (
    payload.result === '1' ||
    payload.result === 1 ||
    payload.result === true ||
    payload.result === 'true' ||
    (typeof payload.result === 'number' && payload.result > 0) ||
    (typeof payload.total_records === 'number' && payload.total_records > 0)
  ) {
    found = true;
    summary = `Product exists in Picky Assist (${payload.result || payload.total_records} match found)`;
  } else if (
    payload.result === '' ||
    payload.result === null ||
    payload.result === '0' ||
    payload.result === 0 ||
    payload.result === false ||
    payload.result === 'false' ||
    payload.total_records === 0
  ) {
    found = false;
    summary = 'Picky Assist returned 0 records (product not found)';
  } else {
    found = false;
    summary = 'Search callback received with no matching product data';
  }

  return { query, found, product, summary };
}

/**
 * Saves an incoming search callback response
 */
export function saveSearchResponse(payload: any): RecordedSearchResponse {
  const { query, found, product, summary } = parseSearchCallbackPayload(payload);
  const id = `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const entry: RecordedSearchResponse = {
    id,
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

  try {
    fs.writeFileSync(SEARCH_RESPONSES_FILE, JSON.stringify(inMemorySearchStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Search Store] Failed to persist search responses to disk:', err);
  }

  // Emit event for any asynchronous awaiter
  if (query) {
    emitter.emit(`search:${query.toLowerCase().trim()}`, entry);
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
  } catch {}
  return inMemorySearchStore;
}

/**
 * Asynchronously waits for a search response to arrive via webhook
 */
export async function waitForSearchResponse(
  identifier: string,
  timeoutMs: number = 3500
): Promise<RecordedSearchResponse | null> {
  const cleanKey = identifier.toLowerCase().trim();

  // 1. Check if a very recent response already arrived (in last 4 seconds)
  const recent = inMemorySearchStore.find((r) => {
    if (!r.query) return false;
    const isMatch = r.query.toLowerCase().trim() === cleanKey;
    const isFresh = Date.now() - new Date(r.timestamp).getTime() < 5000;
    return isMatch && isFresh;
  });

  if (recent) return recent;

  // 2. Wait for event listener
  return new Promise((resolve) => {
    let resolved = false;

    const onSearchResponse = (entry: RecordedSearchResponse) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(entry);
      }
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      emitter.removeListener(`search:${cleanKey}`, onSearchResponse);
      emitter.removeListener('search:any', onAnyResponse);
    };

    const onAnyResponse = (entry: RecordedSearchResponse) => {
      // If query matches or if response arrived without a query tag (e.g. empty result {"result":""})
      if (!entry.query || entry.query.toLowerCase().trim() === cleanKey) {
        onSearchResponse(entry);
      }
    };

    emitter.once(`search:${cleanKey}`, onSearchResponse);
    emitter.on('search:any', onAnyResponse);
  });
}
