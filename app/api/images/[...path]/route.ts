import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Security: Never hardcode credentials — always read from environment only
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET_NAME = process.env.R2_IMAGES_BUCKET || 'images';

const s3Client = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

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
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await context.params;
    const key = Array.isArray(resolvedParams.path)
      ? resolvedParams.path.join('/')
      : (resolvedParams.path as any);

    if (!key) {
      return NextResponse.json({ error: 'Image path required' }, { status: 400 });
    }

    // 1. Try to fetch from Cloudflare R2 (checks images and models buckets)
    if (s3Client) {
      const bucketsToCheck = key.includes('models')
        ? [process.env.R2_MODELS_BUCKET || 'models', BUCKET_NAME]
        : [BUCKET_NAME, process.env.R2_MODELS_BUCKET || 'models'];

      for (const bucket of bucketsToCheck) {
        try {
          const s3Res = await s3Client.send(
            new GetObjectCommand({
              Bucket: bucket,
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
          // If not found in this bucket, check the next bucket
        }
      }
    }

    // 2. Local fallback from public/ directory (with path traversal protection)
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const publicRoot = path.resolve(process.cwd(), 'public');
    const localPath = path.resolve(publicRoot, normalizedKey);

    // Security: Ensure resolved path stays within the public/ directory
    if (!localPath.startsWith(publicRoot)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
