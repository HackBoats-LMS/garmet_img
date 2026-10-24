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

    // 3. Pagination Support - Cursor-based (preferred) with offset fallback
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const cursorId = url.searchParams.get('cursor'); // CUID cursor

    // Use cursor pagination if cursor provided, otherwise fall back to offset
    const useCursor = !!cursorId;
    const take = limit + 1;

    // Fetch active products with constraints
    let products;
    if (useCursor) {
      products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          stockCode: true,
          code1: true,
          productCode: true,
          whatsappCatalogueTitle: true,
          productName: true,
          whatsappRetail: true,
          unitPrice: true,
          quantity: true,
          generatedImages: true,
          length_Size: true,
          sizeInventory: true,
        },
        orderBy: { id: 'desc' },
        cursor: { id: cursorId },
        take,
      });
    } else {
      products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          stockCode: true,
          code1: true,
          productCode: true,
          whatsappCatalogueTitle: true,
          productName: true,
          whatsappRetail: true,
          unitPrice: true,
          quantity: true,
          generatedImages: true,
          length_Size: true,
          sizeInventory: true,
        },
        orderBy: { id: 'desc' },
        take: limit > 1000 ? 1000 : limit,
        skip: offset,
      });
    }

    // Determine if there's a next page
    const hasNextPage = products.length > limit;
    const items = hasNextPage ? products.slice(0, limit) : products;

    // Generate next cursor from last item
    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      nextCursor = items[items.length - 1].id;
    }

    // 4. Data Mapping
    const catalogFeed = items.map((product) => {
      let primaryImageUrl = '';
      if (product.generatedImages && typeof product.generatedImages === 'object') {
         const imagesObj = product.generatedImages as Record<string, any>;
         const firstPoseKey = Object.keys(imagesObj)[0];
         if (firstPoseKey && imagesObj[firstPoseKey]?.imageUrl) {
            primaryImageUrl = imagesObj[firstPoseKey].imageUrl;
         }
      }

      const stableId = product.code1 || product.productCode || product.stockCode;
      const sizeInv = (product.sizeInventory && typeof product.sizeInventory === 'object') ? product.sizeInventory as Record<string, number> : {};
      const availableSizes = Object.entries(sizeInv)
        .filter(([_, q]) => q > 0)
        .map(([s]) => s);

      const sizeDisplay = availableSizes.length > 0 ? availableSizes.join(', ') : (product.length_Size || 'Free Size');

      return {
        id: stableId,
        productName: product.whatsappCatalogueTitle || product.productName || 'Untitled Garment',
        description: `${product.whatsappRetail || 'Premium Garment'}${sizeDisplay ? ` | Sizes: ${sizeDisplay}` : ''}`,
        availability: product.quantity > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        unitPrice: `${product.unitPrice || 0} INR`,
        size: sizeDisplay,
        size_inventory: sizeInv,
        available_sizes: availableSizes,
        link: `https://your-store.com/product/${stableId}`,
        image_link: primaryImageUrl || 'https://your-store.com/placeholder.jpg',
        brand: 'rgjdass Couture',
      };
    });

    return NextResponse.json({ 
        metadata: {
            count: catalogFeed.length,
            limit,
            nextCursor,
            hasNextPage,
            ...(!useCursor && { offset }),
        },
        products: catalogFeed 
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching catalog:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
