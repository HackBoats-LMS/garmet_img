import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export interface RecordedDeleteResponse {
  id: string;
  timestamp: string;
  identifier?: string;
  deleted: boolean;
  rawPayload: any;
  summary: string;
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DELETE_RESPONSES_FILE = IS_SERVERLESS
  ? path.join('/tmp', 'picky-assist-delete-responses.json')
  : path.join(process.cwd(), 'app', 'api', 'admin', 'picky-test', 'delete-responses.json');

declare global {
  var __pickyDeleteEmitter: EventEmitter | undefined;
}

const emitter: EventEmitter = global.__pickyDeleteEmitter || new EventEmitter();
global.__pickyDeleteEmitter = emitter;

let inMemoryDeleteStore: RecordedDeleteResponse[] = [];

try {
  if (fs.existsSync(DELETE_RESPONSES_FILE)) {
    const data = fs.readFileSync(DELETE_RESPONSES_FILE, 'utf-8');
    inMemoryDeleteStore = JSON.parse(data);
  }
} catch {
  inMemoryDeleteStore = [];
}

/**
 * Extracts deletion confirmation details and product code from a Picky Assist delete callback payload
 */
export function parseDeleteCallbackPayload(payload: any): {
  identifier?: string;
  deleted: boolean;
  summary: string;
} {
  if (!payload || typeof payload !== 'object') {
    return { deleted: false, summary: 'Empty or invalid delete response payload' };
  }

  let unwrapped = payload;
  if (typeof payload.result === 'string' && payload.result.trim().startsWith('{')) {
    try {
      unwrapped = JSON.parse(payload.result);
    } catch {}
  } else if (payload.data && typeof payload.data === 'object') {
    unwrapped = payload.data;
  }

  const identifier =
    payload.identifier ||
    payload.stock_code ||
    payload.stockCode ||
    payload.code1 ||
    payload.product_id ||
    payload.productId ||
    payload.query ||
    unwrapped.stock_code ||
    unwrapped.stockCode ||
    unwrapped.code1 ||
    unwrapped.id;

  // Determine if response indicates success
  const isDeleted =
    payload.deleted === true ||
    payload.deleted === 'true' ||
    payload.success === true ||
    payload.success === 'true' ||
    payload.status === 'deleted' ||
    payload.status === 'success' ||
    payload.status === 200 ||
    payload.status === '200' ||
    unwrapped.status === 'deleted' ||
    unwrapped.deleted === true ||
    (typeof payload.result === 'string' && /deleted|removed|success/i.test(payload.result)) ||
    payload.result === '1' ||
    payload.result === 1 ||
    payload.result === true;

  const summary = isDeleted
    ? `Product ${identifier || 'item'} successfully deleted from Picky Assist`
    : `Picky Assist delete callback received for ${identifier || 'item'}: ${typeof payload.result === 'string' ? payload.result : JSON.stringify(payload)}`;

  return {
    identifier,
    deleted: isDeleted,
    summary,
  };
}

/**
 * Saves an incoming delete callback response
 */
export function saveDeleteResponse(payload: any): RecordedDeleteResponse {
  const { identifier, deleted, summary } = parseDeleteCallbackPayload(payload);
  const id = `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const entry: RecordedDeleteResponse = {
    id,
    timestamp: new Date().toISOString(),
    identifier,
    deleted,
    rawPayload: payload,
    summary,
  };

  inMemoryDeleteStore.unshift(entry);
  if (inMemoryDeleteStore.length > 30) {
    inMemoryDeleteStore = inMemoryDeleteStore.slice(0, 30);
  }

  try {
    fs.writeFileSync(DELETE_RESPONSES_FILE, JSON.stringify(inMemoryDeleteStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Delete Store] Failed to persist delete responses to disk:', err);
  }

  if (identifier) {
    emitter.emit(`delete:${identifier.toLowerCase().trim()}`, entry);
  }
  emitter.emit('delete:any', entry);

  return entry;
}

/**
 * Returns latest recorded delete responses
 */
export function getLatestDeleteResponses(): RecordedDeleteResponse[] {
  try {
    if (fs.existsSync(DELETE_RESPONSES_FILE)) {
      const data = fs.readFileSync(DELETE_RESPONSES_FILE, 'utf-8');
      inMemoryDeleteStore = JSON.parse(data);
    }
  } catch {}
  return inMemoryDeleteStore;
}

/**
 * Asynchronously waits for a delete callback to arrive via webhook
 */
export async function waitForDeleteResponse(
  identifier: string,
  timeoutMs: number = 8000
): Promise<RecordedDeleteResponse | null> {
  const cleanKey = identifier.toLowerCase().trim();

  // 1. Check if a very recent response already arrived (in last 5 seconds)
  const recent = inMemoryDeleteStore.find((r) => {
    if (!r.identifier) return false;
    const isMatch = r.identifier.toLowerCase().trim() === cleanKey;
    const isFresh = Date.now() - new Date(r.timestamp).getTime() < 5000;
    return isMatch && isFresh;
  });

  if (recent) return recent;

  // 2. Wait for event listener
  return new Promise((resolve) => {
    let resolved = false;

    const onDeleteResponse = (entry: RecordedDeleteResponse) => {
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
      emitter.removeListener(`delete:${cleanKey}`, onDeleteResponse);
      emitter.removeListener('delete:any', onAnyResponse);
    };

    const onAnyResponse = (entry: RecordedDeleteResponse) => {
      if (!entry.identifier || entry.identifier.toLowerCase().trim() === cleanKey) {
        onDeleteResponse(entry);
      }
    };

    emitter.once(`delete:${cleanKey}`, onDeleteResponse);
    emitter.on('delete:any', onAnyResponse);
  });
}
