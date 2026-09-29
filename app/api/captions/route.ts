import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PLATFORM_INSTRUCTIONS = {
  whatsapp: `Write a WhatsApp broadcast message for a luxury Indian saree boutique. 
Rules: 
- Start with 2-3 relevant emojis
- Maximum 200 characters before the product details
- Include product name, SKU code, and price if available
- Friendly, conversational tone (South Indian boutique feel)
- End with a call-to-action like "DM to order" or "Limited stock!"
- Add boutique signature at end
- Total message: 300-400 characters max`,

  instagram: `Write an Instagram caption for a luxury Indian saree fashion post.
Rules:
- Start with an attention-grabbing first line (no hashtags here)
- 3-4 lines of poetic, aspirational description of the saree
- Include emojis tastefully (3-5 total)
- End with 20-25 relevant hashtags on a new line
- Hashtags: mix of broad (#saree #silksaree) and niche (#kanjivaram #southindianwedding #bridal)
- Professional fashion-forward tone (Vogue India vibes)`,

  facebook: `Write a Facebook post for a luxury Indian saree boutique page.
Rules:
- Warm, community-friendly tone
- 3-5 sentences describing the saree beautifully
- Mention any occasions this saree is perfect for
- Include a question to boost engagement (e.g., "Which occasion would you wear this for?")
- Include 5-8 relevant hashtags inline
- End with a clear call-to-action (shop link, DM, or visit store)`,

  website: `Write an e-commerce product description for a luxury Indian saree website.
Rules:
- Professional, SEO-optimized tone
- 3 paragraphs: (1) overview & first impression, (2) fabric & craftsmanship details, (3) styling & occasions
- Include fabric type, weave technique, color description
- Mention care instructions briefly
- No hashtags, formal English
- 200-300 words total`,
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      orderId,
      productName,
      stockCode,
      description,
      swatchAnalysis,
      price,
      platforms = ['whatsapp', 'instagram', 'facebook', 'website'],
    } = body;

    if (!productName) {
      return NextResponse.json({ error: 'productName is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    // Build garment context
    const fabricDetails: string[] = [];
    if (swatchAnalysis) {
      if (swatchAnalysis.craft) fabricDetails.push(`Craft: ${swatchAnalysis.craft}`);
      if (swatchAnalysis.primaryColor) fabricDetails.push(`Colors: ${swatchAnalysis.primaryColor}`);
      if (swatchAnalysis.bodyMotifs) fabricDetails.push(`Body Design: ${swatchAnalysis.bodyMotifs}`);
      if (swatchAnalysis.borderDesign) fabricDetails.push(`Border: ${swatchAnalysis.borderDesign}`);
      if (swatchAnalysis.palluDesign) fabricDetails.push(`Pallu: ${swatchAnalysis.palluDesign}`);
      if (swatchAnalysis.fabricNotes) fabricDetails.push(`Fabric: ${swatchAnalysis.fabricNotes}`);
    } else if (description) {
      fabricDetails.push(description);
    }

    const garmentContext = [
      `Product Name: ${productName}`,
      stockCode ? `SKU/Code: ${stockCode}` : '',
      price ? `Price: ₹${price}` : '',
      fabricDetails.length > 0 ? `Fabric Details: ${fabricDetails.join('. ')}` : '',
    ].filter(Boolean).join('\n');

    const captions: Record<string, string> = {};

    // Generate captions for each requested platform
    for (const platform of platforms) {
      const instruction = PLATFORM_INSTRUCTIONS[platform as keyof typeof PLATFORM_INSTRUCTIONS];
      if (!instruction) continue;

      const prompt = `You are an expert luxury Indian fashion brand copywriter.\n\nGarment Information:\n${garmentContext}\n\n${instruction}\n\nGenerate ONLY the caption/post text. No explanations, no "Here's your caption:" prefix. Just the final text.`;

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 600,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          captions[platform] = text.trim();
        } else {
          captions[platform] = `Caption generation failed for ${platform}. Please try again.`;
        }
      } catch (err) {
        console.error(`[Captions] Error generating ${platform} caption:`, err);
        captions[platform] = '';
      }
    }

    // Save captions to CustomerOrder if orderId is provided
    if (orderId) {
      try {
        await prisma.customerOrder.update({
          where: { id: orderId },
          data: { captions: captions as any },
        });
      } catch (err) {
        console.warn('[Captions] Failed to save captions to order:', err);
        // Not fatal — still return the captions
      }
    }

    return NextResponse.json({ captions }, { status: 200 });
  } catch (err) {
    console.error('[Captions] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
