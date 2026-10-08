// ─────────────────────────────────────────────────────────────────────────────
// lib/picky-assist-push.ts
// ─────────────────────────────────────────────────────────────────────────────

/*
export interface PickyAssistProductPayload {
  stock_code: string;
  code1?: string;
  title?: string;
  description?: string;
  price?: number;
  mrp?: number;
  quantity?: number;
  color?: string;
  cloth_type?: string;
  cover_image_url?: string;
  tags?: string[];
  category?: string;
  sub_category?: string;
  whatsapp_catalogue_title?: string;
  instagram_caption?: string;
  status?: string;
}

function mapProductToPayload(product: any): PickyAssistProductPayload {
  return {
    stock_code: product.stockCode,
    code1: product.code1 ?? undefined,
    title: product.productName ?? undefined,
    description: product.productDescription ?? undefined,
    price: product.unitPrice ?? undefined,
    mrp: product.retailPrice ?? undefined,
    quantity: product.quantity ?? undefined,
    color: product.color ?? undefined,
    cloth_type: product.clothType ?? undefined,
    cover_image_url: product.coverImageUrl ?? undefined,
    tags: product.tags ?? undefined,
    category: product.category?.name ?? undefined,
    sub_category: product.subCategory?.name ?? undefined,
    whatsapp_catalogue_title: product.whatsappCatalogueTitle ?? undefined,
    instagram_caption: product.instagramCaption ?? undefined,
    status: product.status ?? undefined,
  };
}
*/

export async function addPickyProduct(product: any): Promise<void> {
  const webhookUrl = process.env.PICKY_ASSIST_ADD_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      console.error(`[Picky Assist] Add failed for ${product.stockCode}. Status: ${response.status}`);
    } else {
      console.log(`[Picky Assist] ✅ Added product ${product.stockCode}`);
    }
  } catch (err) {
    console.error(`[Picky Assist] Error adding ${product.stockCode}:`, err);
  }
}

export async function updatePickyProduct(product: any): Promise<void> {
  const webhookUrl = process.env.PICKY_ASSIST_UPDATE_PRODUCT_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      console.error(`[Picky Assist] Update failed for ${product.code1 || product.stockCode}. Status: ${response.status}`);
    } else {
      console.log(`[Picky Assist] ✅ Updated product ${product.code1 || product.stockCode}`);
    }
  } catch (err) {
    console.error(`[Picky Assist] Error updating ${product.code1 || product.stockCode}:`, err);
  }
}
