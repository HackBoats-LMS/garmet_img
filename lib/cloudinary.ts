import crypto from 'crypto';

export interface CloudinaryUploadOptions {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
  productName?: string;
  stockCode?: string;
}

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  format: string;
}

/**
 * Returns true if Cloudinary credentials are configured in the environment
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
    (process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Builds a clean, hierarchical folder path in Cloudinary.
 * In backfire/failover mode, groups assets into product folders (e.g., "coutureai/products/SK-1001 - Red Silk Kurti").
 */
export function getCloudinaryFolder(options: {
  folder?: string;
  productName?: string;
  stockCode?: string;
}): string {
  const { folder, productName, stockCode } = options;

  if (stockCode || productName) {
    const rawName = [stockCode, productName].filter(Boolean).join(' - ');
    const sanitized = rawName
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    return `coutureai/products/${sanitized || 'unnamed_product'}`;
  }

  if (folder) {
    return folder.replace(/^\/+|\/+$/g, '');
  }

  return 'coutureai/failover';
}

/**
 * Uploads an image Buffer to Cloudinary via signed direct REST API.
 * Creates product-specific folders automatically for clean asset organization.
 */
export async function uploadToCloudinary(
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ''
  ).trim();
  const apiKey = (
    process.env.CLOUDINARY_API_KEY ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
    ''
  ).trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      '[Cloudinary] Missing Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).'
    );
  }

  const { buffer, fileName, mimeType, folder, productName, stockCode } = options;

  const targetFolder = getCloudinaryFolder({ folder, productName, stockCode });

  // Sanitize public ID (without file extension)
  const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const publicId = `${baseName}_${Date.now()}`;

  const timestamp = Math.floor(Date.now() / 1000);

  // Parameters to sign (sorted alphabetically by key)
  const paramsToSign: Record<string, string | number> = {
    folder: targetFolder,
    public_id: publicId,
    timestamp: timestamp,
  };

  const sortedKeys = Object.keys(paramsToSign).sort();
  const signatureString =
    sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  console.log(
    `[Cloudinary] Uploading to folder '${targetFolder}' as public_id '${publicId}' (${buffer.length} bytes)...`
  );

  const dataUri = `data:${mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`;

  const formData = new FormData();
  formData.append('file', dataUri);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('folder', targetFolder);
  formData.append('public_id', publicId);
  formData.append('signature', signature);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(
          json.error?.message || `HTTP ${response.status}: ${JSON.stringify(json)}`
        );
      }

      const secureUrl = json.secure_url || json.url;
      console.log(`[Cloudinary] ✅ Upload successful: ${secureUrl}`);

      return {
        url: secureUrl,
        publicId: json.public_id,
        format: json.format || 'jpg',
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Cloudinary] Upload attempt ${attempt}/3 failed:`, err?.message || err);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw new Error(`[Cloudinary] Failed to upload image after 3 attempts: ${lastError?.message}`);
}

/**
 * Deletes an image from Cloudinary given its public_id or full URL
 */
export async function deleteFromCloudinary(publicIdOrUrl: string): Promise<boolean> {
  const cloudName = (
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    ''
  ).trim();
  const apiKey = (
    process.env.CLOUDINARY_API_KEY ||
    process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
    ''
  ).trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[Cloudinary] Cannot delete: credentials not configured.');
    return false;
  }

  let publicId = publicIdOrUrl;
  if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://')) {
    // Extract public_id from Cloudinary URL: e.g. .../image/upload/v12345/folder/id.jpg
    const match = publicIdOrUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    if (match) {
      publicId = decodeURIComponent(match[1]);
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureString = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new FormData();
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp.toString());
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    return json.result === 'ok';
  } catch (err: any) {
    console.error('[Cloudinary Delete Error]:', err?.message || err);
    return false;
  }
}

