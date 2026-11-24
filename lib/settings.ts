import prisma from '@/lib/prisma';
import { encryptValue, decryptValue, maskSecret } from '@/lib/crypto';

// ── In-Memory Fast Cache (TTL: 60 seconds) ───────────────────────────────────
interface CacheEntry {
  value: string;
  expiresAt: number;
}
const settingsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export function invalidateSettingCache(key?: string) {
  if (key) {
    settingsCache.delete(key);
  } else {
    settingsCache.clear();
  }
}

// ── Schema Auto-Init ─────────────────────────────────────────────────────────
let tableInitialized = false;
export async function ensureSystemSettingsTable() {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL,
        "isSecret" BOOLEAN NOT NULL DEFAULT true,
        "category" TEXT NOT NULL DEFAULT 'general',
        "description" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableInitialized = true;
  } catch (err: any) {
    console.warn('[SystemSettings] Note checking/creating table:', err?.message);
  }
}

// ── Setting Definition Types ─────────────────────────────────────────────────
export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  category: 'ai' | 'picky_assist' | 'erp';
  isSecret: boolean;
  isUrl?: boolean;
  placeholder?: string;
}

export const KNOWN_SETTINGS: SettingDefinition[] = [
  // AI Generation Engines
  {
    key: 'KIE_API_KEY',
    label: 'Kie.ai API Key',
    description: 'Primary AI photoshoot generation engine (Qubico/flux1-dev models).',
    category: 'ai',
    isSecret: true,
    placeholder: 'sk_live_...',
  },
  {
    key: 'GEMINI_API_KEY',
    label: 'Google Gemini API Key',
    description: 'Powers AI product descriptions, auto-caption generation, and fabric swatch analysis.',
    category: 'ai',
    isSecret: true,
    placeholder: 'AIzaSy...',
  },

  // Picky Assist (WhatsApp Integration)
  {
    key: 'PICKY_ASSIST_API_TOKEN',
    label: 'Picky Assist Webhook Token',
    description: 'Bearer token to authenticate incoming customer orders placed on WhatsApp.',
    category: 'picky_assist',
    isSecret: true,
    placeholder: 'pa_token_...',
  },
  {
    key: 'PICKY_ASSIST_WEBHOOK_SECRET',
    label: 'Picky Assist Product Webhook Secret',
    description: 'Shared secret for inbound product sync events from Picky Assist.',
    category: 'picky_assist',
    isSecret: true,
    placeholder: 'pa_secret_...',
  },
  {
    key: 'PICKY_ASSIST_SEARCH_PRODUCT_WEBHOOK_URL',
    label: 'Picky Assist Search Webhook URL',
    description: 'Outbound webhook URL to check if a product already exists in Picky Assist before pushing.',
    category: 'picky_assist',
    isSecret: false,
    isUrl: true,
    placeholder: 'https://pickyassist.com/app/api/v2/push?token=...',
  },
  {
    key: 'PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL',
    label: 'Picky Assist Add Product Webhook URL',
    description: 'Outbound webhook URL to push new garments from Inventory to Picky Assist catalog.',
    category: 'picky_assist',
    isSecret: false,
    isUrl: true,
    placeholder: 'https://pickyassist.com/app/api/v2/push?token=...',
  },
  {
    key: 'PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL',
    label: 'Picky Assist Update Product Webhook URL',
    description: 'Outbound webhook URL to push stock, price, or description edits to Picky Assist.',
    category: 'picky_assist',
    isSecret: false,
    isUrl: true,
    placeholder: 'https://pickyassist.com/app/api/v2/push?token=...',
  },

  // ERP & Integrations
  {
    key: 'SYNC_API_KEY',
    label: 'Product Sync API Key',
    description: 'Bearer token securing external product sync and POS endpoints (/api/v1/products, /api/v1/sync/sale).',
    category: 'erp',
    isSecret: true,
    placeholder: 'sync_sec_...',
  },
  {
    key: 'PACT_WEBHOOK_SECRET',
    label: 'PACT ERP Webhook Secret',
    description: 'Secures inbound real-time stock sync and offline sale deductions from PACT POS.',
    category: 'erp',
    isSecret: true,
    placeholder: 'pact-secret-token',
  },
];

// ── Core Retrieval Function ──────────────────────────────────────────────────
/**
 * Retrieves a configuration setting.
 * Checks in-memory cache first -> queries PostgreSQL DB -> falls back to process.env.
 * Adds 0ms latency when cached.
 */
export async function getSetting(key: string, fallbackEnvValue?: string): Promise<string> {
  const now = Date.now();
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    await ensureSystemSettingsTable();

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "value", "isSecret" FROM "SystemSetting" WHERE "key" = $1 LIMIT 1;`,
      key
    );

    if (rows && rows.length > 0 && rows[0].value) {
      const row = rows[0];
      const decrypted = row.isSecret ? decryptValue(row.value) : row.value;

      if (decrypted && decrypted.trim().length > 0) {
        settingsCache.set(key, {
          value: decrypted.trim(),
          expiresAt: now + CACHE_TTL_MS,
        });
        return decrypted.trim();
      }
    }
  } catch (err: any) {
    console.warn(`[getSetting] Failed DB fetch for ${key}, falling back to env:`, err?.message);
  }

  // Graceful fallback to environment variable
  const envVal = fallbackEnvValue ?? process.env[key] ?? '';
  if (envVal) {
    settingsCache.set(key, {
      value: envVal.trim(),
      expiresAt: now + CACHE_TTL_MS,
    });
  }
  return envVal.trim();
}

// ── Core Update Function ────────────────────────────────────────────────────
/**
 * Sets or updates a configuration setting in PostgreSQL.
 * If isSecret is true, encrypts with AES-256-GCM before writing.
 */
export async function setSetting(
  key: string,
  value: string,
  options: { isSecret?: boolean; category?: string; description?: string } = {}
): Promise<void> {
  await ensureSystemSettingsTable();

  const isSecret = options.isSecret ?? true;
  const category = options.category ?? 'general';
  const description = options.description ?? null;
  const trimmed = (value || '').trim();

  const storedValue = isSecret ? encryptValue(trimmed) : trimmed;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "SystemSetting" ("key", "value", "isSecret", "category", "description", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "value" = EXCLUDED."value",
      "isSecret" = EXCLUDED."isSecret",
      "category" = EXCLUDED."category",
      "description" = COALESCE(EXCLUDED."description", "SystemSetting"."description"),
      "updatedAt" = NOW();
    `,
    key,
    storedValue,
    isSecret,
    category,
    description
  );

  // Update in-memory cache immediately with the decrypted plaintext
  settingsCache.set(key, {
    value: trimmed,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ── Admin Panel Overview Helper ─────────────────────────────────────────────
export interface SettingAdminItem extends SettingDefinition {
  isConfigured: boolean;
  source: 'database' | 'env' | 'none';
  maskedValue: string;
  updatedAt: string | null;
}

export async function getAllSettingsForAdmin(): Promise<SettingAdminItem[]> {
  await ensureSystemSettingsTable();

  let dbRows: any[] = [];
  try {
    dbRows = await prisma.$queryRawUnsafe(
      `SELECT "key", "value", "isSecret", "updatedAt" FROM "SystemSetting";`
    );
  } catch (err: any) {
    console.warn('[getAllSettingsForAdmin] Query note:', err?.message);
  }

  const dbMap = new Map<string, { value: string; isSecret: boolean; updatedAt: Date }>();
  for (const r of dbRows) {
    dbMap.set(r.key, {
      value: r.value,
      isSecret: r.isSecret,
      updatedAt: r.updatedAt,
    });
  }

  return KNOWN_SETTINGS.map((def) => {
    const dbEntry = dbMap.get(def.key);
    const envVal = process.env[def.key];

    let source: 'database' | 'env' | 'none' = 'none';
    let maskedValue = '';
    let updatedAt: string | null = null;

    if (dbEntry && dbEntry.value) {
      const raw = dbEntry.isSecret ? decryptValue(dbEntry.value) : dbEntry.value;
      if (raw && raw.trim().length > 0) {
        source = 'database';
        maskedValue = def.isSecret ? maskSecret(raw) : raw;
        updatedAt = dbEntry.updatedAt ? new Date(dbEntry.updatedAt).toISOString() : null;
      }
    }

    if (source === 'none' && envVal && envVal.trim().length > 0) {
      source = 'env';
      maskedValue = def.isSecret ? maskSecret(envVal) : envVal;
    }

    return {
      ...def,
      isConfigured: source !== 'none',
      source,
      maskedValue,
      updatedAt,
    };
  });
}
