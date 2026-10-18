import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadToStorage, isStorageConfigured, R2_GENERATED_BUCKET } from '@/lib/storage';

const PHOTOS_LIBRARY_BASE = 'https://photoslibrary.googleapis.com/v1';

interface ExportAlbumRequestBody {
  token?: string; // Optional client-side GIS token
  albumTitle: string; // e.g. Code1 or Product Name
  productId?: string;
  images: Array<{
    imageUrl: string;
    description?: string;
    filename?: string;
  }>;
}

/**
 * Uploads an image stream directly to Google Photos upload endpoint.
 * Returns the upload token required to attach the image to an album.
 */
async function uploadBytesToGooglePhotos(imageBuffer: Buffer, token: string, mimeType = 'image/jpeg'): Promise<string> {
  const uploadRes = await fetch(`${PHOTOS_LIBRARY_BASE}/uploads`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-type': 'application/octet-stream',
      'X-Goog-Upload-Content-Type': mimeType,
      'X-Goog-Upload-Protocol': 'raw',
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload photo bytes to Google Photos (${uploadRes.status}): ${errText}`);
  }

  return await uploadRes.text(); // Google Photos returns raw uploadToken as text
}

/**
 * POST /api/google/photos/export-album
 * 
 * 1. Ensures images are saved in Cloudflare R2 (backed up permanently)
 * 2. Finds or creates a Google Photos Album titled after Code1
 * 3. Uploads the photos into the Google Photos album
 * 4. Syncs product record in DB if productId is provided
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ExportAlbumRequestBody = await req.json();
    const { albumTitle, productId, images, token: clientToken } = body;

    if (!albumTitle || !albumTitle.trim()) {
      return NextResponse.json({ error: 'albumTitle (e.g. Code1) is required' }, { status: 400 });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided for export' }, { status: 400 });
    }

    // Determine Google OAuth Token
    const authToken = clientToken || (session.user as any)?.accessToken;
    if (!authToken) {
      return NextResponse.json({
        error: 'Google OAuth token is missing or expired. Please sign in with Google.',
        needsAuth: true
      }, { status: 401 });
    }

    const cleanAlbumTitle = albumTitle.trim();
    const userId = (session.user as any)?.id || 'admin';

    // ── STEP 1: Ensure all images are backed up in Cloudflare R2 ──
    const r2BackedUpImages: Array<{ r2Url: string; buffer: Buffer; mime: string; filename: string }> = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.imageUrl) continue;

      try {
        let buffer: Buffer;
        let mime = 'image/jpeg';
        let ext = 'jpg';

        if (img.imageUrl.startsWith('data:image/')) {
          const match = img.imageUrl.match(/^data:image\/(.+);base64,(.+)$/);
          if (match) {
            ext = match[1];
            mime = `image/${ext}`;
            buffer = Buffer.from(match[2], 'base64');
          } else {
            continue;
          }
        } else {
          const fetched = await fetch(img.imageUrl);
          if (!fetched.ok) continue;
          const ab = await fetched.arrayBuffer();
          buffer = Buffer.from(ab);
          mime = fetched.headers.get('content-type') || 'image/jpeg';
          ext = mime.split('/')[1] || 'jpg';
        }

        const safeCodeName = cleanAlbumTitle.toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
        const filename = img.filename || `${safeCodeName}_pose_${i + 1}.${ext}`;

        // Upload to Cloudflare R2 if not already an R2 URL
        let r2Url = img.imageUrl;
        if (isStorageConfigured() && !img.imageUrl.includes('r2.cloudflarestorage.com') && !img.imageUrl.includes(process.env.R2_GENERATED_PUBLIC_URL || '')) {
          const r2Res = await uploadToStorage(img.imageUrl, {
            bucket: R2_GENERATED_BUCKET,
            folder: `coutureai/products/${safeCodeName}`,
            publicId: `pose_${i + 1}_${Date.now()}`,
          });
          r2Url = r2Res.url;
        }

        r2BackedUpImages.push({
          r2Url,
          buffer,
          mime,
          filename,
        });
      } catch (err) {
        console.warn(`[Export Album] Failed to prepare image ${i + 1}:`, err);
      }
    }

    if (r2BackedUpImages.length === 0) {
      return NextResponse.json({ error: 'Failed to process any of the provided images for export' }, { status: 400 });
    }

    // ── STEP 2: Find or Create Google Photos Album named Code1 ──
    // A. List existing user albums to see if album already exists
    let targetAlbumId: string | null = null;
    let targetAlbumUrl: string | null = null;

    try {
      const listAlbumsRes = await fetch(`${PHOTOS_LIBRARY_BASE}/albums?pageSize=50`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });

      if (listAlbumsRes.ok) {
        const albumsData = await listAlbumsRes.json();
        const existingAlbum = (albumsData.albums || []).find(
          (a: any) => (a.title || '').trim().toLowerCase() === cleanAlbumTitle.toLowerCase()
        );
        if (existingAlbum) {
          targetAlbumId = existingAlbum.id;
          targetAlbumUrl = existingAlbum.productUrl || null;
        }
      }
    } catch (listErr) {
      console.warn('[Export Album] Error checking existing albums:', listErr);
    }

    // B. Create new album if not found
    if (!targetAlbumId) {
      const createAlbumRes = await fetch(`${PHOTOS_LIBRARY_BASE}/albums`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          album: { title: cleanAlbumTitle },
        }),
      });

      if (!createAlbumRes.ok) {
        const errData = await createAlbumRes.json().catch(() => ({}));
        const msg = errData?.error?.message || createAlbumRes.statusText;
        return NextResponse.json({
          error: `Google Photos Album Creation Failed: ${msg}`,
          details: errData?.error,
        }, { status: createAlbumRes.status });
      }

      const newAlbumData = await createAlbumRes.json();
      targetAlbumId = newAlbumData.id;
      targetAlbumUrl = newAlbumData.productUrl || null;
    }

    // ── STEP 3: Upload Photos to Google Photos and attach to Album ──
    const newMediaItems: Array<{ description: string; simpleMediaItem: { uploadToken: string; fileName: string } }> = [];

    for (const item of r2BackedUpImages) {
      try {
        const uploadToken = await uploadBytesToGooglePhotos(item.buffer, authToken, item.mime);
        newMediaItems.push({
          description: `${cleanAlbumTitle} - RGJ Dass Couture`,
          simpleMediaItem: {
            uploadToken,
            fileName: item.filename,
          },
        });
      } catch (uploadErr) {
        console.error(`[Export Album] Error uploading image ${item.filename} to Google Photos:`, uploadErr);
      }
    }

    if (newMediaItems.length === 0) {
      return NextResponse.json({
        error: 'Images were backed up to Cloudflare R2, but Google Photos refused upload tokens.',
      }, { status: 502 });
    }

    // Batch create media items in the target album (up to 50 items per call)
    const batchCreateRes = await fetch(`${PHOTOS_LIBRARY_BASE}/mediaItems:batchCreate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        albumId: targetAlbumId,
        newMediaItems,
      }),
    });

    const batchData = await batchCreateRes.json();
    if (!batchCreateRes.ok) {
      const msg = batchData?.error?.message || batchCreateRes.statusText;
      return NextResponse.json({
        error: `Failed to attach photos to album in Google Photos: ${msg}`,
        details: batchData?.error,
      }, { status: batchCreateRes.status });
    }

    // ── STEP 4: Sync to Product in Database if productId provided ──
    if (productId) {
      try {
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (product) {
          const existingGen = (product.generatedImages as Record<string, any>) || {};
          // Update images with the permanent R2 URLs
          const updatedGen: Record<string, any> = { ...existingGen };
          r2BackedUpImages.forEach((item, idx) => {
            const key = `synced_${Date.now()}_${idx}`;
            if (!Object.values(existingGen).some((g: any) => g.imageUrl === item.r2Url)) {
              updatedGen[key] = {
                imageUrl: item.r2Url,
                prompt: `${cleanAlbumTitle} Photo #${idx + 1}`,
                order: Object.keys(updatedGen).length,
              };
            }
          });

          await prisma.product.update({
            where: { id: productId },
            data: {
              generatedImages: updatedGen as any,
              coverImageUrl: product.coverImageUrl || r2BackedUpImages[0]?.r2Url,
            },
          });
        }
      } catch (dbErr) {
        console.warn('[Export Album] Failed to sync to Product in DB:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      albumId: targetAlbumId,
      albumTitle: cleanAlbumTitle,
      albumUrl: targetAlbumUrl,
      photosUploaded: newMediaItems.length,
      r2BackedUpCount: r2BackedUpImages.length,
      message: `Successfully saved ${newMediaItems.length} photos to Google Photos album "${cleanAlbumTitle}" and Cloudflare R2!`,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Google Photos Export Album Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
