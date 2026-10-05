import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
});

export const isCloudinaryConfigured = (): boolean => {
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) &&
    (process.env.CLOUDINARY_API_KEY || process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY) &&
    process.env.CLOUDINARY_API_SECRET
  );
};

export interface UploadOptions {
  folder: string;
  publicId?: string;
  tags?: string[];
  preserveQuality?: boolean;
}

/**
 * Uploads an image (base64 data URL, HTTP URL, or local path) to Cloudinary
 * with 100% original lossless quality and strict folder partitioning.
 */
export async function uploadToCloudinary(
  fileInput: string,
  options: UploadOptions
): Promise<{ url: string; publicId: string; format: string; width: number; height: number }> {
  if (!isCloudinaryConfigured()) {
    console.warn('[Cloudinary] Missing credentials. Returning original input.');
    return {
      url: fileInput,
      publicId: 'local_fallback',
      format: 'jpg',
      width: 1024,
      height: 1024,
    };
  }

  const uploadConfig: any = {
    folder: options.folder,
    resource_type: 'image',
    overwrite: true,
    invalidate: true,
  };

  if (options.publicId) {
    uploadConfig.public_id = options.publicId;
  }
  if (options.tags && options.tags.length > 0) {
    uploadConfig.tags = options.tags;
  }

  const result = await cloudinary.uploader.upload(fileInput, uploadConfig);

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
  };
}

/**
 * Helper: Upload Admin Template Cover & Pose Previews
 * Stored under: coutureai/admin/templates/{templateSlug}
 */
export async function uploadAdminTemplateAsset(
  fileInput: string,
  templateSlug: string,
  assetName: string
): Promise<string> {
  const res = await uploadToCloudinary(fileInput, {
    folder: `coutureai/admin/templates/${templateSlug}`,
    publicId: assetName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    tags: ['admin', 'template', templateSlug],
  });
  return res.url;
}

/**
 * Helper: Upload Admin Model Portrait
 * Stored under: coutureai/admin/models/{modelName}
 */
export async function uploadAdminModelAsset(
  fileInput: string,
  modelName: string
): Promise<string> {
  const res = await uploadToCloudinary(fileInput, {
    folder: 'coutureai/admin/models',
    publicId: modelName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    tags: ['admin', 'model', modelName],
  });
  return res.url;
}

/**
 * Helper: Upload Customer Swatch Image (Partitioned by User ID)
 * Stored under: coutureai/users/{userId}/swatches/{orderId}
 */
export async function uploadCustomerSwatchAsset(
  fileInput: string,
  userId: string,
  orderId: string,
  slotId: string
): Promise<string> {
  const res = await uploadToCloudinary(fileInput, {
    folder: `coutureai/users/${userId}/swatches/${orderId}`,
    publicId: `slot_${slotId}_${Date.now()}`,
    tags: ['customer', `user_${userId}`, `order_${orderId}`],
  });
  return res.url;
}

/**
 * Helper: Upload Generated Photoshoot Image (Partitioned by User ID)
 * Stored under: coutureai/users/{userId}/generated/{orderId}
 */
export async function uploadGeneratedAsset(
  fileInput: string,
  userId: string,
  orderId: string,
  poseId: string
): Promise<string> {
  const res = await uploadToCloudinary(fileInput, {
    folder: `coutureai/users/${userId}/generated/${orderId}`,
    publicId: `pose_${poseId}_${Date.now()}`,
    tags: ['generated', `user_${userId}`, `order_${orderId}`, `pose_${poseId}`],
  });
  return res.url;
}

export default cloudinary;
