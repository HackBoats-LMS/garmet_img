import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';

// XLSX column → Product field mapping
// Based on Project.xlsx columns
const COL_MAP: Record<string, string> = {
  'STOCK CODE':                                          'stockCode',
  'NEW CODE GENERATED':                                  'friendlyCode',
  'DESIGN NUMBER':                                       'designNumber',
  'SIZE':                                                'size',
  'SIZE ':                                               'size',       // trailing space variant
  'COLOUR':                                              'color',
  'LOCATION':                                            'location',
  'UNIT PRICE':                                          'price',
  'WHOLESALE PRICE':                                     'wholesalePrice',
  'RETAIL PRICE':                                        'mrp',
  'PRODUCT DESCRIPTION - TO BE USED FOR FURTHER GENERATIONS OF CAPTIONS': 'description',
  'FABRIC':                                              'clothType',
  'EMBROIDERY TYPE':                                     'embroideryType',
  'CUT STYLE':                                           'cutStyle',
  'BORDER':                                              'border',
  'KURTA LENGTH':                                        'kurtaLength',
  'PANT STYLE':                                          'pantStyle',
  'WHATSAPP RETAIL ':                                    'whatsappRetail',
  'WHATSAPP RETAIL':                                     'whatsappRetail',
  'WHATSAPP WHOLESALE':                                  'whatsappWholesale',
  'INSTAGRAM CAPTION AND #':                             'instagramCaption',
  'FACEBOOK CAPTION AND TAGS':                           'facebookCaption',
  'SHOPIFY TITLE AND DESCRIPTON':                        'shopifyTitle',
  'SHOPIFY TITLE AND DESCRIPTION':                       'shopifyTitle',
  'WHATSAPP CATALOUGE TITLE AND DESCRIPTION':            'whatsappCatalogueTitle',
  'WHATSAPP CATALOGUE TITLE AND DESCRIPTION':            'whatsappCatalogueTitle',
};

// POST /api/admin/products/import
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the spreadsheet' }, { status: 400 });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (const row of rows) {
      // Map columns
      const mapped: Record<string, any> = {};
      for (const [col, field] of Object.entries(COL_MAP)) {
        const val = row[col];
        if (val !== '' && val !== undefined && val !== null) {
          mapped[field] = val;
        }
      }

      // stockCode is required
      const stockCode = mapped.stockCode ? String(mapped.stockCode).trim() : '';
      if (!stockCode || stockCode === '0') {
        results.skipped++;
        continue;
      }

      // Build title from description or stock code
      const title = mapped.description
        ? String(mapped.description).substring(0, 80)
        : `Product ${stockCode}`;

      const data: any = {
        title,
        description: mapped.description ? String(mapped.description) : null,
        color: mapped.color ? String(mapped.color) : null,
        clothType: mapped.clothType ? String(mapped.clothType) : null,
        price: mapped.price ? parseFloat(mapped.price) : null,
        mrp: mapped.mrp ? parseFloat(mapped.mrp) : null,
        wholesalePrice: mapped.wholesalePrice ? parseFloat(mapped.wholesalePrice) : null,
        friendlyCode: mapped.friendlyCode ? String(mapped.friendlyCode).trim() || null : null,
        designNumber: mapped.designNumber ? String(mapped.designNumber) : null,
        size: mapped.size ? String(mapped.size) : null,
        location: mapped.location ? String(mapped.location) : null,
        embroideryType: mapped.embroideryType ? String(mapped.embroideryType) : null,
        cutStyle: mapped.cutStyle ? String(mapped.cutStyle) : null,
        border: mapped.border ? String(mapped.border) : null,
        kurtaLength: mapped.kurtaLength ? String(mapped.kurtaLength) : null,
        pantStyle: mapped.pantStyle ? String(mapped.pantStyle) : null,
        whatsappRetail: mapped.whatsappRetail ? String(mapped.whatsappRetail) : null,
        whatsappWholesale: mapped.whatsappWholesale ? String(mapped.whatsappWholesale) : null,
        instagramCaption: mapped.instagramCaption ? String(mapped.instagramCaption) : null,
        facebookCaption: mapped.facebookCaption ? String(mapped.facebookCaption) : null,
        shopifyTitle: mapped.shopifyTitle ? String(mapped.shopifyTitle) : null,
        whatsappCatalogueTitle: mapped.whatsappCatalogueTitle ? String(mapped.whatsappCatalogueTitle) : null,
      };

      try {
        const existing = await prisma.product.findUnique({ where: { stockCode } });
        let product: any;
        if (existing) {
          product = await prisma.product.update({ where: { stockCode }, data });
          results.updated++;
        } else {
          product = await prisma.product.create({ data: { ...data, stockCode, quantity: 0, tags: [] } });
          results.created++;
        }

        // Auto-link to design group if design number present
        const dn = mapped.designNumber ? String(mapped.designNumber).trim() : '';
        if (dn) {
          let group = await prisma.productDesignGroup.findUnique({ where: { designNumber: dn } });
          if (!group) {
            group = await prisma.productDesignGroup.create({
              data: {
                designNumber: dn,
                title: title.substring(0, 120),
                description: mapped.description ? String(mapped.description) : null,
                color: mapped.color ? String(mapped.color) : null,
                clothType: mapped.clothType ? String(mapped.clothType) : null,
                tags: [],
              },
            });
          }
          // Link this product to the group if not already linked
          if (product.designGroupId !== group.id) {
            await prisma.product.update({
              where: { id: product.id },
              data: { designGroupId: group.id },
            });
          }
        }
      } catch (rowErr: any) {
        results.errors.push(`Row ${stockCode}: ${rowErr.message}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      message: `Import complete — ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
    });
  } catch (error: any) {
    console.error('[Products Import]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
