import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// 1. Bucket for Generated AI Photoshoots & Customer Uploads
export const R2_GENERATED_BUCKET = process.env.R2_GENERATED_BUCKET || process.env.R2_BUCKET_NAME || 'generatedimages';
export const R2_GENERATED_PUBLIC_URL = (process.env.R2_GENERATED_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// 2. Bucket for Templates, Covers & Pose Guides
export const R2_IMAGES_BUCKET = process.env.R2_IMAGES_BUCKET || 'images';
export const R2_IMAGES_PUBLIC_URL = (process.env.R2_IMAGES_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// 3. Bucket for Model Portraits & Face References
export const R2_MODELS_BUCKET = process.env.R2_MODELS_BUCKET || 'models';
export const R2_MODELS_PUBLIC_URL = (process.env.R2_MODELS_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

/**
 * Returns a dynamic S3Client instance using current runtime environment variables.
 * Prevents cold-start undefined endpoint bugs on Vercel serverless functions.
 */
export function getS3Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export const isStorageConfigured = (): boolean => {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  return Boolean(accountId && accessKeyId && secretAccessKey);
};

export interface UploadOptions {
  folder: string;
  publicId?: string;
  tags?: string[];
  preserveQuality?: boolean;
  bucket?: string;
}

/**
 * Helper to convert various image formats to a Buffer
 * Uses O(1) index slicing instead of backtracking regex to handle large base64 payloads safely
 */
async function getImageBuffer(fileInput: string): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  // If it's a base64 data URL
  if (fileInput.startsWith('data:image/')) {
    const commaIdx = fileInput.indexOf(',');
    if (commaIdx === -1) {
      throw new Error('Invalid base64 image data: missing data comma separator');
    }
    const meta = fileInput.slice(0, commaIdx);
    const base64Data = fileInput.slice(commaIdx + 1);

    const mimeMatch = meta.match(/data:(image\/[^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
    const rawExt = mime.split('/')[1] || 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt.replace(/[^a-z0-9]/gi, '');
    const buffer = Buffer.from(base64Data, 'base64');
    return { buffer, mime, ext };
  }

  // If it's an HTTP URL, fetch it
  if (fileInput.startsWith('http')) {
    const response = await fetch(fileInput);
    if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = response.headers.get('content-type') || 'image/jpeg';
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    return { buffer, mime, ext };
  }

  throw new Error('Unsupported image input format. Must be base64 data URL or HTTP URL.');
}

/**
 * Uploads an image (base64 data URL or HTTP URL) to Cloudflare R2
 */
export async function uploadToStorage(
  fileInput: string,
  options: UploadOptions
): Promise<{ url: string; publicId: string; format: string }> {
  const client = getS3Client();
  if (!client || !isStorageConfigured()) {
    console.error('[Storage Error] Cloudflare R2 environment variables are missing on this server.');
    throw new Error(
      'Cloudflare R2 storage is not configured. Please add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL to your Vercel Environment Variables.'
    );
  }

  try {
    let { buffer, mime, ext } = await getImageBuffer(fileInput);

    // Uses Studio Master Quality (Q=92, mozjpeg, full 4:4:4 color chroma) to preserve 100% visual fidelity
    try {
      const sharp = require('sharp');
      const jpegBuffer = await sharp(buffer)
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
        .toBuffer();

      buffer = jpegBuffer;
      mime = 'image/jpeg';
      ext = 'jpg';
    } catch (sharpErr: any) {
      console.warn('[Storage] Sharp conversion fallback/skipped:', sharpErr?.message);
      if (mime !== 'image/jpeg') {
        mime = 'image/jpeg';
        ext = 'jpg';
      }
    }

    const fileName = options.publicId ? `${options.publicId}.${ext}` : `${Date.now()}.${ext}`;
    const objectKey = options.folder ? `${options.folder}/${fileName}` : fileName;
    const targetBucket = options.bucket || R2_GENERATED_BUCKET;

    await client.send(
      new PutObjectCommand({
        Bucket: targetBucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mime,
      })
    );

    const genPubUrl = (process.env.R2_GENERATED_PUBLIC_URL || process.env.R2_PUBLIC_URL || R2_GENERATED_PUBLIC_URL || '').replace(/\/$/, '');
    const imgPubUrl = (process.env.R2_IMAGES_PUBLIC_URL || process.env.R2_PUBLIC_URL || R2_IMAGES_PUBLIC_URL || '').replace(/\/$/, '');
    const modPubUrl = (process.env.R2_MODELS_PUBLIC_URL || process.env.R2_PUBLIC_URL || R2_MODELS_PUBLIC_URL || '').replace(/\/$/, '');

    let fileUrl: string;
    if (targetBucket === R2_IMAGES_BUCKET) {
      fileUrl = imgPubUrl ? `${imgPubUrl}/${objectKey}` : `/api/images/${objectKey}`;
    } else if (targetBucket === R2_MODELS_BUCKET) {
      fileUrl = modPubUrl ? `${modPubUrl}/${objectKey}` : `/api/images/${objectKey}`;
    } else {
      fileUrl = genPubUrl ? `${genPubUrl}/${objectKey}` : `/api/images/${objectKey}`;
    }

    return {
      url: fileUrl,
      publicId: objectKey,
      format: ext,
    };
  } catch (error) {
    console.error('[Storage Upload Error]:', error);
    throw error;
  }
}

/**
 * Deletes an image from Cloudflare R2 given its public URL or object key
 */
export async function deleteFromStorage(
  urlOrKey: string,
  customBucket?: string
): Promise<{ success: boolean; key: string; bucket: string }> {
  const client = getS3Client();
  if (!client) {
    console.warn('[Storage] Cannot delete from R2: S3Client not configured.');
    return { success: false, key: urlOrKey, bucket: '' };
  }

  let key = urlOrKey.trim();
  let bucket = customBucket || process.env.R2_GENERATED_BUCKET || process.env.R2_BUCKET_NAME || 'generatedimages';

  // If it's a full public URL, extract the object key and determine bucket
  if (key.startsWith('http://') || key.startsWith('https://')) {
    try {
      const parsed = new URL(key);
      key = parsed.pathname.replace(/^\/+/, ''); // remove leading slashes

      const genUrl = (process.env.R2_GENERATED_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      const imgUrl = (process.env.R2_IMAGES_PUBLIC_URL || '').replace(/\/$/, '');
      const modUrl = (process.env.R2_MODELS_PUBLIC_URL || '').replace(/\/$/, '');

      if (imgUrl && urlOrKey.startsWith(imgUrl)) {
        bucket = process.env.R2_IMAGES_BUCKET || 'images';
      } else if (modUrl && urlOrKey.startsWith(modUrl)) {
        bucket = process.env.R2_MODELS_BUCKET || 'models';
      } else if (genUrl && urlOrKey.startsWith(genUrl)) {
        bucket = process.env.R2_GENERATED_BUCKET || process.env.R2_BUCKET_NAME || 'generatedimages';
      }
    } catch {
      key = key.replace(/^https?:\/\/[^\/]+\//, '');
    }
  } else if (key.startsWith('/api/images/')) {
    key = key.replace(/^\/api\/images\//, '');
    if (key.includes('models/')) {
      bucket = process.env.R2_MODELS_BUCKET || 'models';
    } else if (key.includes('templates/')) {
      bucket = process.env.R2_IMAGES_BUCKET || 'images';
    }
  }

  if (!key) {
    throw new Error('Invalid key or URL provided for deletion');
  }

  console.log(`[Storage] Deleting object '${key}' from Cloudflare R2 bucket '${bucket}'...`);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return { success: true, key, bucket };
  } catch (delErr: any) {
    console.error(`[Storage Delete Error] Failed to delete '${key}':`, delErr?.message);
    throw delErr;
  }
}

/**
 * Helper: Upload Admin Template Cover & Pose Previews
 * Stored under Cloudflare R2 bucket: images
 */
export async function uploadAdminTemplateAsset(
  fileInput: string,
  templateSlug: string,
  assetName: string
): Promise<string> {
  const res = await uploadToStorage(fileInput, {
    bucket: R2_IMAGES_BUCKET,
    folder: `templates/${templateSlug}`,
    publicId: assetName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  });
  return res.url;
}

/**
 * Helper: Upload Admin Model Portrait
 * Stored under Cloudflare R2 bucket: models
 */
export async function uploadAdminModelAsset(
  fileInput: string,
  modelName: string
): Promise<string> {
  const res = await uploadToStorage(fileInput, {
    bucket: R2_MODELS_BUCKET,
    folder: 'coutureai/admin/models',
    publicId: modelName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  });
  return res.url;
}

/**
 * Helper: Upload Customer Swatch Image (Partitioned by User ID)
 * Stored under Cloudflare R2 bucket: generatedimages
 */
export async function uploadCustomerSwatchAsset(
  fileInput: string,
  userId: string,
  orderId: string,
  slotId: string
): Promise<string> {
  const res = await uploadToStorage(fileInput, {
    bucket: R2_GENERATED_BUCKET,
    folder: `coutureai/users/${userId}/swatches/${orderId}`,
    publicId: `slot_${slotId}_${Date.now()}`,
  });
  return res.url;
}

/**
 * Helper: Upload Generated Photoshoot Image (Partitioned by User ID)
 * Stored under Cloudflare R2 bucket: generatedimages
 */
export async function uploadGeneratedAsset(
  fileInput: string,
  userId: string,
  orderId: string,
  poseId: string
): Promise<string> {
  const res = await uploadToStorage(fileInput, {
    bucket: R2_GENERATED_BUCKET,
    folder: `coutureai/users/${userId}/generated/${orderId}`,
    publicId: `pose_${poseId}_${Date.now()}`,
  });
  return res.url;
}
