import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '5121be04e91525bb3278414becc5d48a';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'fa7179cc28728cc0f5c77bd28bc5d8db';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '7c0261cf9524378259cfa1da5c573163245d57c8d785511a79b05d3a82ce3182';
const BUCKET_NAME = process.env.R2_IMAGES_BUCKET || 'images';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    const resolvedParams = await Promise.resolve(context.params);
    const key = Array.isArray(resolvedParams.path)
      ? resolvedParams.path.join('/')
      : (resolvedParams.path as any);

    if (!key) {
      return NextResponse.json({ error: 'Image path required' }, { status: 400 });
    }

    // 1. Try to fetch from Cloudflare R2 images bucket
    try {
      const s3Res = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );

      if (s3Res.Body) {
        const bytes = await s3Res.Body.transformToByteArray();
        const contentType = s3Res.ContentType || getMimeType(key);

        return new NextResponse(Buffer.from(bytes), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
    } catch (s3Err: any) {
      // If not found in R2, proceed to local fallback
    }

    // 2. Local fallback from public/ directory
    const localPath = path.join(process.cwd(), 'public', key);
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      const contentType = getMimeType(key);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  } catch (error: any) {
    console.error('[API /images Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
