import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { StockItemData } from '@/app/types/stock';
import { auth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(req);
    const rateCheck = checkRateLimit('api:caption', ip, { windowMs: 60 * 1000, max: 30 });
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many caption requests. Please slow down.' }, { status: 429 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const { stockItem }: { stockItem: StockItemData } = await req.json();

    const prompt = `
You are a luxury brand copywriter. Generate three distinct pieces of copy for a product.
Return the response ONLY as a valid JSON object with three keys: "whatsapp", "instagram", and "website".

Product Details:
- Title: ${stockItem.title}
- Stock Code: ${stockItem.stockCode}
- Price: ${stockItem.price ? `₹${stockItem.price}` : 'Price on request'}
- Description: ${stockItem.rawDescription || 'A beautiful hand-crafted piece'}
- Category: ${stockItem.category || 'Apparel'}

Guidelines:
1. "whatsapp": Direct, conversational, include emojis, highlight exclusivity and price, and include a strong call to action (e.g. DM to reserve).
2. "instagram": Highly engaging, storytelling, luxurious, use relevant hashtags at the end (#luxury #fashion etc), invite engagement.
3. "website": Professional, structured, SEO-friendly description with a short overview and bullet points for specifications (fabric, care, authenticity). 

Return exactly valid JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(text);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('AI Caption Generation Error:', error);
    const errorMsg = process.env.NODE_ENV === 'production' ? 'Failed to generate captions' : (error?.message || 'Failed to generate captions');
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
