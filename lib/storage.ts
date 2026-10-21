import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure S3 Client for Cloudflare R2
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';

// 1. Bucket for Generated AI Photoshoots & Customer Uploads
export const R2_GENERATED_BUCKET = process.env.R2_GENERATED_BUCKET || process.env.R2_BUCKET_NAME || 'generatedimages';
export const R2_GENERATED_PUBLIC_URL = (process.env.R2_GENERATED_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// 2. Bucket for Templates, Covers & Pose Guides
export const R2_IMAGES_BUCKET = process.env.R2_IMAGES_BUCKET || 'images';
export const R2_IMAGES_PUBLIC_URL = (process.env.R2_IMAGES_PUBLIC_URL || '').replace(/\/$/, '');

// 3. Bucket for Model Portraits & Face References
export const R2_MODELS_BUCKET = process.env.R2_MODELS_BUCKET || 'models';
export const R2_MODELS_PUBLIC_URL = (process.env.R2_MODELS_PUBLIC_URL || '').replace(/\/$/, '');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const isStorageConfigured = (): boolean => {
  return Boolean(
    R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    (R2_GENERATED_PUBLIC_URL || R2_IMAGES_PUBLIC_URL || R2_MODELS_PUBLIC_URL)
  );
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
 */
async function getImageBuffer(fileInput: string): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  // If it's a base64 data URL
  if (fileInput.startsWith('data:image/')) {
    const matches = fileInput.match(/^data:image\/(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }
    const ext = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    return { buffer, mime: `image/${ext}`, ext };
  }

  // If it's an HTTP URL, fetch it
  if (fileInput.startsWith('http')) {
    const response = await fetch(fileInput);
    if (!response.ok) throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = response.headers.get('content-type') || 'image/jpeg';
    const ext = mime.split('/')[1] || 'jpg';
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
  if (!isStorageConfigured()) {
    console.warn('[Storage] Missing R2 credentials. Returning original input.');
    return {
      url: fileInput,
      publicId: 'local_fallback',
      format: 'jpg',
    };
  }

  try {
    let { buffer, mime, ext } = await getImageBuffer(fileInput);

    // Always ensure the image is in high-quality JPEG format (.jpg) and well within Picky Assist's 5MB limit
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
    } catch (sharpErr) {
      console.warn('[Storage] Sharp conversion fallback:', (sharpErr as any)?.message);
      // Fallback: if already jpeg, keep it; otherwise leave buffer intact
      if (mime !== 'image/jpeg') {
        mime = 'image/jpeg';
        ext = 'jpg';
      }
    }

    const fileName = options.publicId ? `${options.publicId}.${ext}` : `${Date.now()}.${ext}`;
    const objectKey = options.folder ? `${options.folder}/${fileName}` : fileName;
    const targetBucket = options.bucket || R2_GENERATED_BUCKET;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: targetBucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mime,
      })
    );

    let fileUrl: string;
    if (targetBucket === R2_IMAGES_BUCKET) {
      fileUrl = R2_IMAGES_PUBLIC_URL ? `${R2_IMAGES_PUBLIC_URL}/${objectKey}` : `/api/images/${objectKey}`;
    } else if (targetBucket === R2_MODELS_BUCKET) {
      fileUrl = R2_MODELS_PUBLIC_URL ? `${R2_MODELS_PUBLIC_URL}/${objectKey}` : `/api/images/${objectKey}`;
    } else {
      // Default generatedimages bucket public dev URL
      fileUrl = R2_GENERATED_PUBLIC_URL ? `${R2_GENERATED_PUBLIC_URL}/${objectKey}` : `/api/images/${objectKey}`;
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
