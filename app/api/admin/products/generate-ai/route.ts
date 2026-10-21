import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for AI generation & image fetch

// Preferred models in order of cost and speed (cheapest first)
const MODELS_TO_TRY = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

/**
 * Fetches and prepares an image (data URL or remote URL) to base64 for Gemini AI.
 * Images are pre-compressed client-side, eliminating CPU-heavy server resizing.
 */
async function fetchAndOptimizeImage(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    // If it's already a client-compressed data URL
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        return {
          mimeType: match[1],
          base64: match[2],
        };
      }
    }

    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      console.warn(`[generate-ai] Failed to fetch image: ${url} (status: ${res.status})`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';

    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  } catch (err: any) {
    console.error('[generate-ai] Error fetching image:', err.message);
    return null;
  }
}

/**
 * Execute content generation with model cascade fallback
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  parts: any[],
  generationConfig?: any
): Promise<string> {
  let lastError: any = null;

  for (const model of MODELS_TO_TRY) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: generationConfig,
      });

      if (response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`[generate-ai] Generation with ${model} failed: ${err.message}. Retrying next model...`);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed to respond');
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured in .env' }, { status: 500 });
    }

    const body = await req.json();
    const {
      mode = 'both', // 'name' | 'captions' | 'both'
      targetPlatform, // optional single platform e.g. 'whatsappRetail'
      imageUrl,
      images,
      productName = '',
      color = '',
      clothType = '',
      category = 'Saree',
      embroideryType = '',
      cutStyle = '',
      border = '',
      kurtaLength = '',
      pantStyle = '',
      stockCode = '',
      designNumber = '',
      price = '',
      retailPrice = '',
      unitPrice = '',
      wholesalePrice = '',
      description = '',
      keywords = '', // e.g. "chikankari, modal cotton, summer pastel"
    } = body;

    // Resolve prices cleanly
    const finalRetailPrice = retailPrice || price || '';
    const finalWholesalePrice = wholesalePrice || '';

    // Clean user keywords (can be string or array)
    const keywordsList: string[] = Array.isArray(keywords)
      ? keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : typeof keywords === 'string'
        ? keywords.split(',').map(k => k.trim()).filter(Boolean)
        : [];
    const keywordsStr = keywordsList.join(', ');

    // Pick best image URL
    const activeImageUrl = imageUrl || (Array.isArray(images) && images.length > 0 ? images[0] : null);
    let imagePart: any = null;

    if (activeImageUrl) {
      const opt = await fetchAndOptimizeImage(activeImageUrl);
      if (opt) {
        imagePart = {
          inlineData: {
            mimeType: opt.mimeType,
            data: opt.base64,
          },
        };
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const result: Record<string, any> = {};

    // ─── 1. PRODUCT NAME & CATALOGUE TITLE GENERATION ─────────────────────────
    if (mode === 'name' || mode === 'both') {
      const namePrompt = `You are the product-namer for RGJ Dass — a 75-year-old Secunderabad women's everyday saree & kurti house. Look at the uploaded photo and give the piece a name.

READ THE VIBE from four cues in the image:
- COLOUR: the dominant fabric colour + any accent (this carries the most weight).
- MOTIF / PRINT: florals, stripes, checks, plain, border/pallu detail.
- SETTING / BACKGROUND: garden, sunlight, studio, indoor warmth — read the mood it suggests (fresh, festive, calm, everyday).
- POSE / STYLING: relaxed and everyday, or poised and occasion-ready.
Weight it colour + motif first; use background and pose only to sense the mood, not as facts about the product.

BRAND FEEL (carry quietly, NEVER write the words "self-expression"): the version of herself today calls for — quietly impressive, everyday, confident. Names should feel warm and real, never loud.

NAMING RULES:
- Ground the name in something concrete you can SEE: the colour, the motif, or the mood — not free-floating poetry.
- 1–3 words, Title Case.
- BANNED words (never use): Timeless, Elegance, Elegant, Ethereal, Grace, Graceful, Serene, Serenity, Bliss, Divine, Majestic, Eternal, Radiance, Essence, Charm, Allure, Whisper, Dream, Aura, Enchant.
- Do NOT invent fabric, weave or origin — you cannot reliably see fabric, so never put it in the name.
- Good examples: "Coral Bloom", "Quiet Monday", "Terracotta Noon", "Festive Ease", "Sunlit Daisy".
${keywordsStr ? `- MANDATORY USER KEYWORDS: Incorporate or reflect these specific keywords in the naming or catalogue title where appropriate: "${keywordsStr}". (For example, if "chikankari" is requested, reflect it in the catalogue title like "<Name> — Chikankari Kurti Set").` : ''}

Additional context if visible:
Category: ${category || 'Saree'}
Fabric/Details: ${clothType || ''} ${color ? `(Color: ${color})` : ''}
${keywordsStr ? `User Requested Keywords: ${keywordsStr}` : ''}

OUTPUT exactly this, nothing else:
Name: <the design name>
Catalogue: <Name> — <main colour + accent> <Saree/Kurti Set>   (searchable, e.g. "Coral Bloom — White & Coral Floral Saree")`;

      const parts: any[] = [{ text: namePrompt }];
      if (imagePart) parts.push(imagePart);

      const nameOutput = await generateWithFallback(ai, parts, { temperature: 0.95 });

      // Parse Name: and Catalogue:
      let parsedName = '';
      let parsedCatalogue = '';

      const nameMatch = nameOutput.match(/Name:\s*([^\n\r]+)/i);
      const catalogueMatch = nameOutput.match(/Catalogue:\s*([^\n\r]+)/i);

      if (nameMatch) parsedName = nameMatch[1].trim();
      if (catalogueMatch) parsedCatalogue = catalogueMatch[1].trim();

      // Fallbacks if regex didn't catch clean tags
      if (!parsedName) {
        const lines = nameOutput.split('\n').map(l => l.trim()).filter(Boolean);
        parsedName = lines[0] || 'Quiet Classic';
      }
      if (!parsedCatalogue) {
        parsedCatalogue = `${parsedName} — ${color || 'Classic'} ${category || 'Saree'}`;
      }

      result.productName = parsedName;
      result.catalogueTitle = parsedCatalogue;
    }

    // ─── 2. PLATFORM CAPTIONS GENERATION ────────────────────────────────────
    if (mode === 'captions' || mode === 'both') {
      const activeName = result.productName || productName || 'RGJ Dass Signature Piece';
      const activeCatalogue = result.catalogueTitle || `${activeName} — ${color || 'Fine'} ${category || 'Saree'}`;

      const captionsPrompt = `You are the lead brand copywriter for R.G.J.Dass — a 75-year-old textile family house in Sindhi Colony, Secunderabad, Hyderabad, creating everyday sarees & kurti sets for modern women.

BRAND SOUL & STRATEGY CONTEXT:
- Philosophy: "We don't sell sarees. We sell the best 4 minutes of her day." (The ritual before 8am where she makes one beautiful decision and carries quiet confidence all day).
- Category: "The Elegant Middle" — Everyday Sarees & Kurti Sets. Not plain/ordinary, not heavy/festive. The piece she reaches for on a Tuesday morning.
- Two Key Customers (ICPs):
  1. The Home CEO (Sunita/Kavitha, 35-55, Sindhi Colony): Runs her household & social life like a CEO. Events: Kitty parties, Satsang, temple, hosting. Fear: Looking ordinary ("Fraud of Presence"). Desires the "Mirror Moment" — 30-second certainty reset.
  2. The Professional Connoisseur (Dr. Ananya/Preethi, 30-48, doctor/VP/consultant): Needs "wear everywhere range": Monday hospital/office, Thursday PTM, Saturday kitty. 60-second sorted morning. Anti-fast-fashion.
- BANNED WORDS (NEVER use these words or variants): Timeless, Elegance, Elegant, Ethereal, Grace, Graceful, Serene, Serenity, Bliss, Divine, Majestic, Eternal, Radiance, Essence, Charm, Allure, Whisper, Dream, Aura, Enchant. Never write the literal words "self-expression".
- Brand voice: Warm, grounded, quiet, real, quietly impressive, confident, never loud.

PRODUCT DETAILS GIVEN:
- Design Name: ${activeName}
- Catalogue Title: ${activeCatalogue}
- Category: ${category || 'Saree'}
- Dominant Colour: ${color || 'As shown in garment'}
- Fabric / Cloth Type: ${clothType || 'Breathable daily weave'}
- Embroidery / Work: ${embroideryType || 'Traditional fine detailing'}
- Cut / Style: ${cutStyle || ''}
- Border: ${border || ''}
- Kurta Length / Pant Style: ${kurtaLength || ''} ${pantStyle || ''}
- Stock Code / Barcode: ${stockCode || ''}
- Design Number: ${designNumber || ''}
- Retail Price (B2C Customers): ${finalRetailPrice ? `₹${finalRetailPrice}` : 'Available on request'}
- Dealer / Wholesale Price (B2B Only): ${finalWholesalePrice ? `₹${finalWholesalePrice}` : 'Available on request'}
- Existing Notes: ${description || ''}
${keywordsStr ? `- REQUIRED KEYWORDS TO FEATURE: "${keywordsStr}". (You MUST naturally weave these exact keywords or craft highlights into the captions, highlights, description and hashtags!).` : ''}

PRICING RULES FOR EACH CAPTION (VERY IMPORTANT):
1. "whatsappRetail": MUST use the Retail Price (${finalRetailPrice ? `₹${finalRetailPrice}` : 'Price on request'}). NEVER mention wholesale or dealer price here under any circumstances.
2. "whatsappWholesale": MUST use the Dealer/Wholesale Price (${finalWholesalePrice ? `₹${finalWholesalePrice}` : 'Price on inquiry'}). If retail price is also mentioned, clearly distinguish: e.g. "Wholesale: ₹${finalWholesalePrice} | Suggested Retail/MRP: ₹${finalRetailPrice}".
3. "whatsappCatalogueTitle": Mention Retail Price (${finalRetailPrice ? `₹${finalRetailPrice}` : ''}) if including price.
4. "instagramCaption", "facebookCaption", "shopifyTitle": Use Retail Price (${finalRetailPrice ? `₹${finalRetailPrice}` : ''}) if including price, NEVER wholesale price.

${targetPlatform ? `TASK: Generate ONLY the caption for the platform: "${targetPlatform}". Return a JSON object with this single key.` : `TASK: Generate all platform captions and a polished product description. Return your answer ONLY as a valid JSON object with the following exact keys:`}
{
  "whatsappRetail": "WhatsApp broadcast message for retail customers (warm, personal, boutique feel, 2-3 emojis, details product & retail price (₹${finalRetailPrice || 'on request'}), naturally incorporates requested keywords '${keywordsStr || ''}', ends with 'The best 4 minutes of your day. R.G.J.Dass · Sindhi Colony, Secunderabad')",
  "whatsappWholesale": "WhatsApp message for B2B wholesale buyers/store owners (professional, design code, fabric/print, 4-colour pack, dealer price (₹${finalWholesalePrice || 'on inquiry'}), margin info, direct dispatch from Secunderabad warehouse)",
  "whatsappCatalogueTitle": "Short catalogue listing title + 2-3 line searchable description with retail price and keywords",
  "instagramCaption": "Engaging Instagram caption with a stop-scroll hook for our ICPs, quiet confident storytelling featuring keywords '${keywordsStr || ''}', 3-4 tasteful emojis, and 15-20 curated hashtags",
  "facebookCaption": "Community-focused Facebook post highlighting 75 years of textile craft in Secunderabad, everyday wearability, requested keywords, engaging question, and store visit/order info",
  "shopifyTitle": "SEO-optimised Shopify title and 3-paragraph product description (The Morning Drape, Fabric & Motifs, Occasion Styling & Specs)",
  "productDescription": "A concise, evocative 2-3 sentence product description highlighting weave, craft${keywordsStr ? `, specifically featuring '${keywordsStr}'` : ''}, drape and feel for cataloguing and customer reference"
}`;

      const captionParts: any[] = [{ text: captionsPrompt }];
      if (imagePart) captionParts.push(imagePart);

      const captionsOutput = await generateWithFallback(ai, captionParts, {
        temperature: 0.85,
        responseMimeType: 'application/json',
      });

      try {
        const parsedCaptions = JSON.parse(captionsOutput);
        Object.assign(result, parsedCaptions);
      } catch (jsonErr) {
        console.warn('[generate-ai] Failed to parse JSON response directly, sanitizing:', jsonErr);
        const cleaned = captionsOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedCaptions = JSON.parse(cleaned);
        Object.assign(result, parsedCaptions);
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Admin Generate AI Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate AI metadata' },
      { status: 500 }
    );
  }
}
