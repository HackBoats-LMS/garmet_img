/**
 * Client-Side Image Compression Helper
 * Compresses and resizes images in the user's browser before upload.
 * Zero CPU overhead on the server, zero native C++ dependencies.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
  maxSizeBytes?: number; // Target max file size (guarantee < 4MB)
  sharpen?: boolean;
}

export async function compressImageOnClient(
  file: File,
  options: CompressionOptions = {}
): Promise<{ file: File; dataUrl: string }> {
  const {
    maxDimension = 2560,
    quality = 0.94,
    mimeType = 'image/jpeg',
    maxSizeBytes = 3.8 * 1024 * 1024, // 3.8 MB limit (strictly < 4MB)
  } = options;

  // If not an image, return raw file
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ file, dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    });
  }

  // Check: If file is already a standard web image under 3.8MB and doesn't exceed maxDimension,
  // do NOT re-compress or resample to avoid multi-generation compression loss.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image into browser canvas'));
      img.onload = () => {
        let { width, height } = img;
        const isStandardWeb = file.type === 'image/jpeg' || file.type === 'image/webp' || file.type === 'image/png';
        const isUnderLimit = file.size <= maxSizeBytes;
        const isWithinDimensions = width <= maxDimension && height <= maxDimension;

        // Bypass re-compression if already optimized & under 3.8MB
        if (isStandardWeb && isUnderLimit && isWithinDimensions) {
          return resolve({ file, dataUrl: rawDataUrl });
        }

        // Scale down proportionally if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ file, dataUrl: rawDataUrl });
        }

        // Clean high-quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Helper to ensure file strictly stays under maxSizeBytes (< 4MB)
        const exportWithQualityCheck = (currentQuality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                const fallbackData = canvas.toDataURL(mimeType, currentQuality);
                return resolve({ file, dataUrl: fallbackData });
              }

              // If blob is still larger than maxSizeBytes, gently step down quality
              if (blob.size > maxSizeBytes && currentQuality > 0.70) {
                exportWithQualityCheck(Math.max(0.70, currentQuality - 0.08));
                return;
              }

              const reader2 = new FileReader();
              reader2.onloadend = () => {
                const finalDataUrl = reader2.result as string;
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: mimeType,
                  lastModified: Date.now(),
                });
                resolve({ file: compressedFile, dataUrl: finalDataUrl });
              };
              reader2.readAsDataURL(blob);
            },
            mimeType,
            currentQuality
          );
        };

        exportWithQualityCheck(quality);
      };

      img.src = rawDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
