import { BrandStrategyRules, StockItemData } from '@/app/types/stock';

export const DEFAULT_BRAND_STRATEGY: BrandStrategyRules = {
  brandName: 'rgjdass Heritage & Couture',
  tagline: 'Timeless Handcrafted Silks & Haute Couture',
  tone: 'Royal, Exquisite, Artisanal & Highly Trustworthy',
  keyPhrases: [
    'Pure Silk Mark Certified',
    'Authentic Handloom Masterpiece',
    'Heirloom Zari Weaving',
    'Bespoke Bridal Craftsmanship',
    'Direct Loom to Wardrobe',
  ],
  fabricQualityClaims: [
    '100% Pure Mulberry Silk / Kanchipuram Weave',
    'Tested & Certified Pure Gold/Silver Zari Threads',
    'Heavy Fall & Authentic Silk Luster',
    'Hand-finished by Master Weavers',
  ],
  whatsappSignature: '📲 To Reserve / Inquire: Reply with Stock Code or Tap WhatsApp Link\n✨ Worldwide Express Shipping | Custom Maggam Blouse Stitching Available',
  instagramHashtags: [
    '#rgjdassCouture',
    '#KanchipuramSilk',
    '#PurePattuSaree',
    '#HandloomSilk',
    '#BridalSaree',
    '#SouthIndianBride',
    '#ZariBorder',
    '#IndianCouture',
    '#SilkMarkCertified',
    '#WeddingWear',
  ],
};

/**
 * Generates WhatsApp Direct Sales & Broadcast copy with clean emojis, price breakdown, and direct CTA.
 */
export function generateWhatsAppCopy(
  item: StockItemData,
  rules: BrandStrategyRules = DEFAULT_BRAND_STRATEGY
): string {
  const priceFormatted = item.price ? `₹${item.price.toLocaleString('en-IN')}` : 'Price on Request';
  const mrpFormatted = item.mrp ? ` (MRP: ₹${item.mrp.toLocaleString('en-IN')})` : '';

  return `✨ *${rules.brandName} • EXCLUSIVE DROP* ✨
━━━━━━━━━━━━━━━━━━━━━
🏷️ *Stock Code:* \`${item.stockCode}\`
👑 *Collection:* ${item.title || 'Pure Handloom Silk Edition'}
💎 *Offer Price:* *${priceFormatted}*${mrpFormatted}

📜 *Piece Description & Artistry:*
${item.rawDescription || 'Handcrafted with intricate motifs and pure zari borders.'}

🌟 *Craft & Quality Hallmarks:*
• ${rules.keyPhrases[0]}
• ${rules.keyPhrases[1]}
• ${rules.fabricQualityClaims[1]}

📸 *Album Photos:* 5 HD angles attached above for weave & border inspection.

━━━━━━━━━━━━━━━━━━━━━
${rules.whatsappSignature}
📦 *Stock Status:* Available (Single Exclusive Piece)`;
}

/**
 * Generates Instagram Post / Reel narrative with luxury storytelling and high-reach hashtags.
 */
export function generateInstagramCopy(
  item: StockItemData,
  rules: BrandStrategyRules = DEFAULT_BRAND_STRATEGY
): string {
  const priceSnippet = item.price ? `Price: ₹${item.price.toLocaleString('en-IN')}` : 'DM for Price & Details';

  return `A symphony of warp, weft, and timeless heritage. ✨

Presenting the ${item.title || 'Heirloom Handloom Edition'} [Stock Code: ${item.stockCode}].

Every inch tells a story of royal craftsmanship — ${item.rawDescription || 'Featuring grand temple borders, rich contrasting tones, and authentic gold zari micro-reflections.'}

✨ Fabric: Pure Certified Silk
✨ Artwork: Traditional Handloom Weave
✨ Details: ${priceSnippet}

DM us or WhatsApp to reserve this one-of-a-kind piece before it is billed.

.
.
${rules.instagramHashtags.join(' ')}`;
}

/**
 * Generates E-Commerce / Website product page copy with SEO formatting and specifications.
 */
export function generateWebsiteCopy(
  item: StockItemData,
  rules: BrandStrategyRules = DEFAULT_BRAND_STRATEGY
): string {
  return `### Product Overview: ${item.title} (Stock #${item.stockCode})

${item.rawDescription}

#### Specifications & Details:
- **Product Code:** ${item.stockCode}
- **Category:** ${item.category.toUpperCase()}
- **Fabric:** Pure Handwoven Silk (${rules.fabricQualityClaims[0]})
- **Zari Type:** ${rules.fabricQualityClaims[1]}
- **Blouse Piece:** Included (Matching / Contrast Designer Cut)
- **Care Instructions:** Professional Dry Clean Only. Store in breathable cotton muslin cloth.
- **Authenticity:** Guaranteed ${rules.brandName} Quality Seal & Silk Mark Certified.

*Note: Handcrafted pieces may have subtle natural variations in weave, which is the hallmark of authentic handloom artistry.*`;
}

/**
 * Convenience helper to generate all 3 platform formats at once.
 */
export function generateAllPlatformCopies(
  item: StockItemData,
  rules: BrandStrategyRules = DEFAULT_BRAND_STRATEGY
) {
  return {
    whatsapp: generateWhatsAppCopy(item, rules),
    instagram: generateInstagramCopy(item, rules),
    website: generateWebsiteCopy(item, rules),
  };
}
