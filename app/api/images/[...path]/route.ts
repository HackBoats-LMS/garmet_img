import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { getS3Client } from '@/lib/storage';

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

    // 1. Try to fetch from Cloudflare R2 (checks generated, images, and models buckets dynamically)
    const s3Client = getS3Client();
    if (s3Client) {
      const imagesBucket = (process.env.R2_IMAGES_BUCKET || process.env.R2_BUCKET_NAME || 'images').trim();
      const generatedBucket = (process.env.R2_GENERATED_BUCKET || process.env.R2_BUCKET_NAME || 'generatedimages').trim();
      const modelsBucket = (process.env.R2_MODELS_BUCKET || process.env.R2_BUCKET_NAME || 'models').trim();
      const rawOrder = key.includes('models')
        ? [modelsBucket, imagesBucket, generatedBucket]
        : key.includes('generated')
        ? [generatedBucket, imagesBucket, modelsBucket]
        : [imagesBucket, generatedBucket, modelsBucket];
      const bucketsToCheck = Array.from(new Set(rawOrder.filter(Boolean)));

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
    const safePrefix = publicRoot.endsWith(path.sep) ? publicRoot : publicRoot + path.sep;

    // Security: Ensure resolved path stays strictly within the public/ directory
    if (localPath !== publicRoot && !localPath.startsWith(safePrefix)) {
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
