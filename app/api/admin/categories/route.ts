import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/admin/categories — full category tree
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subCategories: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ categories });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/categories — create category
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, subCategories } = body;

    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        subCategories: subCategories?.length
          ? {
              create: subCategories.map((s: string, i: number) => ({
                name: s,
                slug: s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { subCategories: true },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/categories — update or add sub-category
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { categoryId, subCategoryName, action } = body;

    if (action === 'add-sub' && categoryId && subCategoryName) {
      const slug = subCategoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const sub = await prisma.subCategory.create({
        data: { categoryId, name: subCategoryName, slug },
      });
      return NextResponse.json({ subCategory: sub });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/categories?id=...&subId=...
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const subId = searchParams.get('subId');
    const id = searchParams.get('id');

    if (subId) {
      await prisma.subCategory.delete({ where: { id: subId } });
    } else if (id) {
      await prisma.category.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
