import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// In-memory store for rate limiting
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_MAX = 30; // max requests per minute for the catalog feed
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }
  if (now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, lastReset: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

export async function GET(request: Request) {
  try {
    // 1. Rate Limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // 2. Authentication check
    const authHeader = request.headers.get('authorization');
    // We expect "Bearer <TOKEN>"
    const token = authHeader?.split(' ')[1];
    
    if (!token || token !== (process.env.WHATSAPP_API_TOKEN || 'test-token')) {
       // Log unauthorized attempts for security auditing
       console.warn(`[Security] Unauthorized catalog access attempt from IP: ${ip}`);
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Pagination Support (Edge case: thousands of products crashing the API)
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '500', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Fetch active products with constraints
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        stockCode: true,
        friendlyCode: true,
        designNumber: true,
        whatsappCatalogueTitle: true,
        title: true,
        whatsappRetail: true,
        price: true,
        quantity: true,
        generatedImages: true,
      },
      take: limit > 1000 ? 1000 : limit, // Max limit 1000 per request
      skip: offset,
      orderBy: { updatedAt: 'desc' } // Give the freshest items first
    });

    // 4. Data Mapping
    const catalogFeed = products.map((product) => {
      let primaryImageUrl = '';
      if (product.generatedImages && typeof product.generatedImages === 'object') {
         const imagesObj = product.generatedImages as Record<string, any>;
         const firstPoseKey = Object.keys(imagesObj)[0];
         if (firstPoseKey && imagesObj[firstPoseKey]?.imageUrl) {
            primaryImageUrl = imagesObj[firstPoseKey].imageUrl;
         }
      }

      const stableId = product.friendlyCode || product.designNumber || product.stockCode;

      return {
        id: stableId,
        title: product.whatsappCatalogueTitle || product.title || 'Untitled Garment',
        description: product.whatsappRetail || 'Premium Garment',
        availability: product.quantity > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: `${product.price || 0} INR`,
        link: `https://your-store.com/product/${stableId}`,
        image_link: primaryImageUrl || 'https://your-store.com/placeholder.jpg',
        brand: 'Myra Couture',
      };
    });

    return NextResponse.json({ 
        metadata: {
            count: catalogFeed.length,
            limit,
            offset
        },
        products: catalogFeed 
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching catalog:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
