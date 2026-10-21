import fs from 'fs';
import path from 'path';

export interface RecordedRequest {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  ip: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: any;
  rawBody?: string;
  responseStatus: number;
  detectedType?: string;
  mappingResult?: any;
}

// In serverless environments (Vercel), process.cwd() is read-only.
// We write to /tmp or fallback to in-memory store.
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const LOG_FILE = IS_SERVERLESS
  ? path.join('/tmp', 'picky-assist-requests.json')
  : path.join(process.cwd(), 'app', 'api', 'admin', 'picky-test', 'requests.json');

// In-memory cache attached to global to survive HMR in dev
declare global {
  var __pickyRequestStore: RecordedRequest[] | undefined;
}

let inMemoryStore: RecordedRequest[] = global.__pickyRequestStore || [];
global.__pickyRequestStore = inMemoryStore;

try {
  if (fs.existsSync(LOG_FILE)) {
    const data = fs.readFileSync(LOG_FILE, 'utf-8');
    inMemoryStore = JSON.parse(data);
    global.__pickyRequestStore = inMemoryStore;
  }
} catch {
  // in-memory fallback
}

export function detectPayloadType(body: any): string {
  if (!body || typeof body !== 'object') return 'Plain/Unknown';
  if (body.items && Array.isArray(body.items)) return 'WhatsApp Catalog Order';
  if (body.product_items && Array.isArray(body.product_items)) return 'WhatsApp Product Items Order';
  if (body.order && (body.order.items || body.order.product_items)) return 'WhatsApp Nested Order';
  if (body.event && body.product) return `Product Event (${body.event})`;
  if (body.product_retailer_id !== undefined && (body.quantity !== undefined || body.qty !== undefined)) return 'Catalog Single Item Purchase';
  if ((body.stock_code !== undefined || body.code1 !== undefined) && (body.quantity !== undefined || body.qty_change !== undefined)) return 'Direct Stock Update / Sale';
  if (body.result === '' && Object.keys(body).length === 1) return 'Picky Assist Empty Webhook Ping';
  if (body.order_id !== undefined || body.order_reference !== undefined) return 'Picky Assist Order Event';
  return 'Custom JSON Object';
}

export function saveRequest(req: RecordedRequest) {
  if (!req.detectedType) {
    req.detectedType = detectPayloadType(req.body);
  }
  inMemoryStore.unshift(req);
  if (inMemoryStore.length > 50) {
    inMemoryStore = inMemoryStore.slice(0, 50);
  }
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
  } catch (err) {
    // Silently continue with in-memory store in read-only environments
  }
}

export function updateRecordedRequest(id: string, updates: Partial<RecordedRequest>) {
  const index = inMemoryStore.findIndex((r) => r.id === id);
  if (index !== -1) {
    inMemoryStore[index] = { ...inMemoryStore[index], ...updates };
    try {
      fs.writeFileSync(LOG_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
    } catch (err) {
      // in-memory fallback
    }
  }
}

export function getRecordedRequests(): RecordedRequest[] {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const data = fs.readFileSync(LOG_FILE, 'utf-8');
      inMemoryStore = JSON.parse(data);
      global.__pickyRequestStore = inMemoryStore;
    }
  } catch {
    // fallback to inMemoryStore
  }
  return inMemoryStore;
}

export function clearRecordedRequests() {
  inMemoryStore = [];
  global.__pickyRequestStore = [];
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    // in-memory fallback
  }
}
