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
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim().replace(/^["']|["']$/g, '');
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim().replace(/^["']|["']$/g, '');

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
    // Required for Cloudflare R2 compatibility: disables modern AWS CRC32 checksum headers that trigger SignatureDoesNotMatch in R2
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export const isStorageConfigured = (): boolean => {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  const isR2 = Boolean(accountId && accessKeyId && secretAccessKey);
  const isCloudinary = Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
    (process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) &&
    process.env.CLOUDINARY_API_SECRET
  );
  return isR2 || isCloudinary;
};

export interface UploadOptions {
  folder: string;
  publicId?: string;
  tags?: string[];
  preserveQuality?: boolean;
  bucket?: string;
  productName?: string;
  stockCode?: string;
}

/**
 * Helper to convert various image formats to a Buffer
 * Uses O(1) index slicing instead of backtracking regex to handle large base64 payloads safely
 * Includes retry logic and content-type validation to prevent saving expired/broken URLs
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
    if (buffer.length < 50) {
      throw new Error(`Image buffer too small (${buffer.length} bytes) — likely corrupt or empty base64 data`);
    }
    return { buffer, mime, ext };
  }

  // If it's an HTTP URL, fetch it with retry and validation
  if (fileInput.startsWith('http')) {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
        const response = await fetch(fileInput, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch image from URL (HTTP ${response.status}): ${response.statusText} — URL: ${fileInput.substring(0, 120)}`
          );
        }

        const contentType = response.headers.get('content-type') || '';

        // Validate the response is actually an image, not an error page or JSON
        if (!contentType.includes('image/') && !contentType.includes('octet-stream')) {
          const bodyPreview = await response.text().catch(() => '(unreadable)');
          throw new Error(
            `URL did not return an image (Content-Type: ${contentType}). ` +
            `Response preview: ${bodyPreview.substring(0, 200)}. ` +
            `URL: ${fileInput.substring(0, 120)}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate minimum size — a real image should be > 50 bytes
        if (buffer.length < 50) {
          throw new Error(
            `Fetched image is suspiciously small (${buffer.length} bytes) — likely expired, empty, or error response. ` +
            `URL: ${fileInput.substring(0, 120)}`
          );
        }

        const mime = contentType.includes('image/') ? contentType.split(';')[0].trim() : 'image/jpeg';
        const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        return { buffer, mime, ext };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Storage] getImageBuffer attempt ${attempt}/3 failed:`, err?.message);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1000));
        }
      }
    }
    throw lastError || new Error(`Failed to fetch image from URL after 3 attempts: ${fileInput.substring(0, 120)}`);
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
  // Idempotent: return directly if already permanently stored in Cloudflare R2 or Cloudinary
  if (typeof fileInput === 'string' && (
    fileInput.includes('.r2.dev') ||
    fileInput.includes('.r2.cloudflarestorage.com') ||
    fileInput.includes('cloudinary.com') ||
    fileInput.includes('res.cloudinary.com')
  )) {
    console.log('[Storage] Image is already permanently stored:', fileInput);
    return {
      url: fileInput,
      publicId: fileInput.split('/').pop()?.split('.')[0] || 'existing',
      format: fileInput.split('.').pop() || 'jpg',
    };
  }
  const client = getS3Client();
  if (!client) {
    console.warn('[Storage] Cloudflare R2 is not configured. Engaging Cloudinary fallback...');
    try {
      const { uploadToCloudinary } = await import('@/lib/cloudinary');
      let { buffer, mime, ext } = await getImageBuffer(fileInput);
      const fileName = options.publicId ? `${options.publicId}.${ext}` : `${Date.now()}.${ext}`;
      const cldResult = await uploadToCloudinary({
        buffer,
        fileName,
        mimeType: mime,
        folder: options.folder,
        productName: options.productName,
        stockCode: options.stockCode,
      });
      if (cldResult?.url) {
        return {
          url: cldResult.url,
          publicId: cldResult.publicId,
          format: cldResult.format || ext,
        };
      }
    } catch (cldErr: any) {
      console.error('[Storage] Cloudinary fallback failed:', cldErr?.message || cldErr);
    }

    throw new Error(
      'Cloudflare R2 storage is not configured and Cloudinary fallback was unavailable.'
    );
  }

  try {
    let { buffer, mime, ext } = await getImageBuffer(fileInput);

    // Studio Master Quality & 5MB Guarantee: Bypass re-compression if already optimized & under 5MB
    try {
      const sharp = require('sharp');
      const meta = await sharp(buffer).metadata();
      const isOver5MB = buffer.length > 5 * 1024 * 1024;
      const needsDownscale = Boolean((meta.width && meta.width > 2560) || (meta.height && meta.height > 2560));
      const isStandardWeb = mime === 'image/jpeg' || mime === 'image/webp';

      // Re-encode ONLY if image exceeds 5MB, exceeds 2560px, or is a heavy raw format (e.g. uncompressed PNG/BMP)
      if (isOver5MB || needsDownscale || !isStandardWeb) {
        let targetQuality = 95;
        let jpegBuffer = await sharp(buffer)
          .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: targetQuality, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
          .toBuffer();

        // Safety fallback: if somehow still over 5MB, gently step down quality to guarantee < 5MB
        if (jpegBuffer.length > 5 * 1024 * 1024) {
          jpegBuffer = await sharp(buffer)
            .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
            .toBuffer();
        }

        buffer = jpegBuffer;
        mime = 'image/jpeg';
        ext = 'jpg';
      }
    } catch (sharpErr: any) {
      console.warn('[Storage] Sharp inspection fallback/skipped:', sharpErr?.message);
    }

    const fileName = options.publicId ? `${options.publicId}.${ext}` : `${Date.now()}.${ext}`;
    const objectKey = options.folder ? `${options.folder}/${fileName}` : fileName;
    const targetBucket = options.bucket || R2_GENERATED_BUCKET;

    console.log(`[Storage] Uploading ${Math.round(buffer.length / 1024)}KB to R2 bucket '${targetBucket}' key '${objectKey}'`);

    let uploadSuccess = false;
    let lastUploadError: any = null;
    for (let uAttempt = 1; uAttempt <= 3; uAttempt++) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: targetBucket,
            Key: objectKey,
            Body: buffer,
            ContentType: mime,
          })
        );
        uploadSuccess = true;
        break;
      } catch (putErr: any) {
        lastUploadError = putErr;
        console.warn(`[Storage] PutObjectCommand attempt ${uAttempt}/3 failed:`, putErr?.message);
        if (uAttempt < 3) {
          await new Promise(r => setTimeout(r, uAttempt * 1000));
        }
      }
    }
    if (!uploadSuccess) {
      console.warn(`[Storage] ⚠️ Cloudflare R2 upload failed after 3 attempts. Engaging Cloudinary failover...`);
      try {
        const { uploadToCloudinary } = await import('@/lib/cloudinary');
        const cldResult = await uploadToCloudinary({
          buffer,
          fileName,
          mimeType: mime,
          folder: options.folder,
          productName: options.productName,
          stockCode: options.stockCode,
        });

        if (cldResult?.url) {
          console.log(`[Storage] ✅ Cloudinary failover succeeded: ${cldResult.url}`);
          return {
            url: cldResult.url,
            publicId: cldResult.publicId,
            format: cldResult.format || ext,
          };
        }
      } catch (cldErr: any) {
        console.error('[Storage] Cloudinary failover exception:', cldErr?.message || cldErr);
      }

      throw lastUploadError || new Error(`Failed to upload object to R2 bucket '${targetBucket}' key '${objectKey}' and Cloudinary failover.`);
    }

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

    console.log(`[Storage] ✅ Upload successful: ${fileUrl}`);

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
  if (urlOrKey.includes('cloudinary.com')) {
    try {
      const { deleteFromCloudinary } = await import('@/lib/cloudinary');
      const success = await deleteFromCloudinary(urlOrKey);
      return { success, key: urlOrKey, bucket: 'cloudinary' };
    } catch (cldErr: any) {
      console.error('[Storage] Cloudinary delete failed:', cldErr?.message || cldErr);
      return { success: false, key: urlOrKey, bucket: 'cloudinary' };
    }
  }

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
  poseId: string,
  productInfo?: { productName?: string; stockCode?: string }
): Promise<string> {
  const res = await uploadToStorage(fileInput, {
    bucket: R2_GENERATED_BUCKET,
    folder: `coutureai/users/${userId}/generated/${orderId}`,
    publicId: `pose_${poseId}_${Date.now()}`,
    productName: productInfo?.productName,
    stockCode: productInfo?.stockCode,
  });
  return res.url;
}
