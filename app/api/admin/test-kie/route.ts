import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const cleanKey = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!cleanKey) {
      return NextResponse.json({
        ok: false,
        error: 'No KIE_API_KEY or PIAPI_API_KEY found in server environment variables.',
        hasKey: false,
      }, { status: 400 });
    }

    const maskedKey = cleanKey.length > 10
      ? `${cleanKey.slice(0, 6)}...${cleanKey.slice(-6)}`
      : '***';

    // 1. Check live credit balance from Kie.ai
    let creditStatus = null;
    let creditData = null;
    let creditError = null;
    try {
      const creditRes = await fetch('https://api.kie.ai/api/v1/chat/credit', {
        headers: { 'Authorization': `Bearer ${cleanKey}` },
      });
      creditStatus = creditRes.status;
      const creditJson = await creditRes.json();
      creditData = creditJson;
    } catch (cErr: any) {
      creditError = cErr?.message || String(cErr);
    }

    const isKeyExpired = creditData?.code === 401;
    const isCreditsEmpty = creditData?.code === 402 || (typeof creditData?.data === 'number' && creditData.data < 4);
    const balance = typeof creditData?.data === 'number' ? creditData.data : null;

    return NextResponse.json({
      ok: creditData?.code === 200,
      hasKey: true,
      maskedKey,
      keyLength: cleanKey.length,
      creditResponse: creditData,
      creditBalance: balance,
      isKeyExpired,
      isCreditsEmpty,
      diagnostics: {
        networkReachable: creditStatus !== null,
        httpStatus: creditStatus,
        kieCode: creditData?.code,
        kieMessage: creditData?.msg,
        balanceAvailable: balance !== null ? `${balance} credits` : 'Unknown',
        canGeneratePhotoshoot: balance !== null && balance >= 4,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || 'Failed to test Kie.ai connection',
    }, { status: 500 });
  }
}
