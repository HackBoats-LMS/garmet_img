import * as XLSX from 'xlsx';

export const FIELD_MATCHERS: Record<string, string[]> = {
  id: ['id', '_id', 'itemid', 'dbid'],
  stockCode: [
    'stockcode', 'stockno', 'stockid', 'sku', 'itemcode', 'itemno',
    'barcode', 'barcode1', 'barcodeno', 'productid'
  ],
  code1: [
    'newcodegenerated', 'newcode', 'code1', 'code', 'altcode',
    'friendlycode', 'itemalias'
  ],
  productCode: [
    'designnumber', 'designno', 'designnum', 'design', 'productcode',
    'styleno', 'stylecode', 'modelno', 'itemdesign'
  ],
  productName: [
    'productname', 'itemname', 'title', 'name', 'producttitle',
    'itemdescription', 'articlename'
  ],
  length_Size: [
    'lengthsize', 'size', 'sizes', 'dimension', 'dimensions'
  ],
  quantity: [
    'qty', 'quantity', 'stock', 'units', 'pieces', 'pcs',
    'stockqty', 'inventory', 'totalqty'
  ],
  dealerPrice: [
    'wholesaleprice', 'dealerprice', 'wholesale', 'dealer',
    'wp', 'dp', 'trade_price'
  ],
  retailPrice: [
    'retailprice', 'mrp', 'sellingprice', 'sp', 'price',
    'sale_price', 'listprice'
  ],
  unitPrice: [
    'unitprice', 'costprice', 'cp', 'cost', 'purchaseprice',
    'buyingprice'
  ],
  color: [
    'colour', 'color', 'shade', 'colors', 'colours', 'colorname'
  ],
  clothType: [
    'fabric', 'clothtype', 'material', 'fabrictype', 'quality'
  ],
  embroideryType: [
    'embroiderytype', 'embroidery', 'work', 'worktype'
  ],
  cutStyle: [
    'cutstyle', 'pattern', 'style'
  ],
  border: [
    'border', 'bordertype', 'borderdetails'
  ],
  kurtaLength: [
    'kurtalength', 'toplength'
  ],
  pantStyle: [
    'pantstyle', 'bottomstyle'
  ],
  location: [
    'location', 'rack', 'shelf', 'bin', 'store', 'godown'
  ],
  productDescription: [
    'productdescriptiontobeusedforfurthergenerationsofcaptions',
    'productdescription', 'description', 'desc', 'details', 'about'
  ],
  whatsappRetail: ['whatsappretail'],
  whatsappWholesale: ['whatsappwholesale'],
  instagramCaption: ['instagramcaptionand', 'instagramcaption'],
  facebookCaption: ['facebookcaptionandtags', 'facebookcaption'],
  shopifyTitle: ['shopifytitleanddescripton', 'shopifytitleanddescription', 'shopifytitle'],
  whatsappCatalogueTitle: ['whatsappcatalougetitleanddescription', 'whatsappcataloguetitleanddescription', 'whatsappcataloguetitle'],
};

export function normalizeKey(str: any): string {
  return String(str || '').trim().toLowerCase().replace(/[\s_\-#]+/g, '');
}

export function parseNumeric(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function parseInteger(val: any, fallback = 0): number {
  const num = parseNumeric(val);
  return num !== null ? Math.round(num) : fallback;
}

/**
 * Scans the first 15 rows of a worksheet to detect the true header row,
 * skipping blank lines, company headers, or report banners.
 */
export function parseSheetSmart(sheet: XLSX.WorkSheet): Record<string, any>[] {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return [];

  const allKeywords = Object.values(FIELD_MATCHERS).flat();

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const rowTexts = row.map(cell => normalizeKey(cell));
    const matches = rowTexts.filter(cell => cell && allKeywords.includes(cell));
    if (matches.length >= 2) {
      headerRowIdx = i;
      break;
    }
  }

  return XLSX.utils.sheet_to_json(sheet, { range: headerRowIdx, defval: '' });
}

export interface MappedProduct {
  id?: string | null;
  stockCode: string;
  code1: string | null;
  productCode: string | null;
  productName: string;
  productDescription: string | null;
  color: string | null;
  clothType: string | null;
  unitPrice: number | null;
  retailPrice: number | null;
  dealerPrice: number | null;
  quantity: number;
  length_Size: string | null;
  location: string | null;
  embroideryType: string | null;
  cutStyle: string | null;
  border: string | null;
  kurtaLength: string | null;
  pantStyle: string | null;
  whatsappRetail: string | null;
  whatsappWholesale: string | null;
  instagramCaption: string | null;
  facebookCaption: string | null;
  shopifyTitle: string | null;
  whatsappCatalogueTitle: string | null;
  sizeInventory?: Record<string, number> | null;
}

/**
 * Normalizes a raw spreadsheet row into a typed product payload.
 */
export function mapSpreadsheetRow(row: Record<string, any>): MappedProduct {
  const mapped: Record<string, any> = {};

  for (const [colName, val] of Object.entries(row)) {
    if (val === '' || val === undefined || val === null) continue;
    const norm = normalizeKey(colName);
    for (const [field, keywords] of Object.entries(FIELD_MATCHERS)) {
      if (keywords.includes(norm) && !mapped[field]) {
        mapped[field] = val;
        break;
      }
    }
  }

  // Stock code fallback resolution
  const rawStock = mapped.stockCode ? String(mapped.stockCode).trim() : '';
  const rawCode1 = mapped.code1 ? String(mapped.code1).trim() : '';
  const rawProdCode = mapped.productCode ? String(mapped.productCode).trim() : '';

  let stockCode = rawStock;
  if (!stockCode || stockCode === '0' || stockCode === '-') {
    stockCode = rawCode1 || rawProdCode;
  }

  const title = mapped.productName
    ? String(mapped.productName).trim().substring(0, 120)
    : mapped.productDescription
      ? String(mapped.productDescription).trim().substring(0, 80)
      : stockCode ? `Product ${stockCode}` : '';

  return {
    id: mapped.id ? String(mapped.id).trim() : null,
    stockCode,
    code1: rawCode1 || null,
    productCode: rawProdCode || null,
    productName: title,
    productDescription: mapped.productDescription ? String(mapped.productDescription) : null,
    color: mapped.color ? String(mapped.color) : null,
    clothType: mapped.clothType ? String(mapped.clothType) : null,
    unitPrice: parseNumeric(mapped.unitPrice),
    retailPrice: parseNumeric(mapped.retailPrice),
    dealerPrice: parseNumeric(mapped.dealerPrice),
    quantity: parseInteger(mapped.quantity, 0),
    length_Size: mapped.length_Size ? String(mapped.length_Size) : null,
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
}
