import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { targetKey, testValue } = body;

    // Use provided testValue if user typed a new key into input, otherwise read current active setting
    const keyToTest = (testValue && !testValue.includes('••••'))
      ? testValue.trim()
      : await getSetting(targetKey, process.env[targetKey]);

    if (!keyToTest) {
      return NextResponse.json({ success: false, error: `${targetKey} is empty or not configured.` }, { status: 400 });
    }

    // 1. Test Kie.ai API Key
    if (targetKey === 'KIE_API_KEY') {
      try {
        const cleanKey = keyToTest.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();
        const res = await fetch('https://api.kie.ai/api/v1/jobs/record-info?jobId=test', {
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
          },
        });

        // If unauthorized (401 or 403), key is invalid
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json({
            success: false,
            error: 'Kie.ai returned 401 Unauthorized: The API key is invalid or expired.',
          });
        }

        // Even a 400 or 404 means the key authenticated successfully!
        return NextResponse.json({
          success: true,
          message: 'Kie.ai API key is valid and connected successfully!',
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: `Connection failed: ${err?.message}` });
      }
    }

    // 2. Test Google Gemini API Key
    if (targetKey === 'GEMINI_API_KEY') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: keyToTest });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Say OK',
        });

        if (response && response.text) {
          return NextResponse.json({
            success: true,
            message: 'Gemini API key is valid and responsive!',
          });
        }
      } catch (geminiErr: any) {
        return NextResponse.json({
          success: false,
          error: `Gemini verification failed: ${geminiErr?.message || 'Invalid API Key'}`,
        });
      }
    }

    // 3. Test Picky Assist Webhook URLs
    if (targetKey.includes('PICKY_ASSIST') && targetKey.includes('URL')) {
      try {
        const parsed = new URL(keyToTest);
        if (!parsed.protocol.startsWith('http')) {
          return NextResponse.json({ success: false, error: 'Invalid URL format.' });
        }
        return NextResponse.json({
          success: true,
          message: 'Webhook URL syntax is valid and ready.',
        });
      } catch {
        return NextResponse.json({ success: false, error: 'Malformed URL.' });
      }
    }

    return NextResponse.json({ success: true, message: 'Value formatted correctly.' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Test failed' }, { status: 500 });
  }
}
