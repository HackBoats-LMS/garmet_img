import { NextRequest, NextResponse } from 'next/server';
import { analyzeSwatchBuffer } from '@/lib/swatchAnalyzer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * High-Precision Saree Swatch Analyzer using Google Gemini Vision.
 * Accurately extracts morphological anatomy, exact physical sizing, and negative spacing rules.
 */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageUrl } = await req.json();

    let buffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let base64String = '';

    if (imageBase64 && typeof imageBase64 === 'string') {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64String = match[2];
        buffer = Buffer.from(base64String, 'base64');
      } else {
        base64String = imageBase64;
        buffer = Buffer.from(base64String, 'base64');
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      if (imageUrl.startsWith('data:image/')) {
        const match = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64String = match[2];
          buffer = Buffer.from(base64String, 'base64');
        }
      } else if (imageUrl.startsWith('http')) {
        const imgRes = await fetch(imageUrl);
        const arrayBuf = await imgRes.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
        mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        base64String = buffer.toString('base64');
      }
    }

    if (!buffer || !base64String) {
      return NextResponse.json({ error: 'No valid image data provided' }, { status: 400 });
    }

    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const kieApiKey = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    const rawGoogleKey = process.env.GEMINI_API_KEY || '';
    const googleGeminiKey = rawGoogleKey.trim().replace(/^["']|["']$/g, '');

    const visionPrompt = `You are a highly precise textile and ethnic wear analysis AI. Analyze the uploaded blurry/low-contrast fabric image and extract the structural types, shapes, arrangement patterns, and color profiles of the woven or embroidered motifs (buttis).

You must return ONLY a raw JSON object. Do not wrap it in markdown code blocks or add any conversational text. Use the following schema:

{
  "fabric_background": {
    "base_color": "string",
    "texture_notes": "string"
  },
  "detected_buttis": [
    {
      "motif_id": "integer",
      "shape_type": "string",
      "structure_details": "string",
      "primary_colors": ["string"],
      "secondary_colors": ["string"],
      "layout_arrangement": "string",
      "visibility_confidence": "low/medium/high"
    }
  ]
}`;

    // Helper: Parse Gemini response text whether it is single JSON or SSE stream chunks
    const extractJsonFromGeminiResponse = (rawText: string): any | null => {
      if (!rawText) return null;
      try {
        const direct = JSON.parse(rawText);
        if (direct?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return JSON.parse(direct.candidates[0].content.parts[0].text);
        }
        if (direct?.detected_buttis || direct?.distinctMotifs || direct?.layoutGrid) {
          return direct;
        }
      } catch (e) {}

      // Try SSE stream parsing (lines starting with 'data:')
      let sseCombined = '';
      const lines = rawText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const chunkStr = trimmed.slice(5).trim();
          if (chunkStr && chunkStr !== '[DONE]') {
            try {
              const chunkObj = JSON.parse(chunkStr);
              const partText = chunkObj?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (partText) sseCombined += partText;
            } catch (e) {}
          }
        }
      }

      if (sseCombined) {
        try {
          return JSON.parse(sseCombined);
        } catch (e) {
          const match = sseCombined.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
        }
      }

      // Last fallback regex extract
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {}
      }
      return null;
    };

    // Helper: Build structured vision response from user's schema & format for Kie.ai Nano-Banana
    const buildStructuredVisionResult = (parsed: any, modelLabel: string) => {
      const rawButtis: any[] = Array.isArray(parsed.detected_buttis)
        ? parsed.detected_buttis
        : Array.isArray(parsed.distinctMotifs)
        ? parsed.distinctMotifs.map((m: any, i: number) => ({
            motif_id: m.id || i + 1,
            shape_type: m.name || 'Floral/Geometric Motif',
            structure_details: m.anatomy || m.paletteDescription || '',
            primary_colors: m.colors || [],
            secondary_colors: [],
            layout_arrangement: 'staggered diagonal repeat',
            visibility_confidence: 'high'
          }))
        : [];

      const baseColor = parsed.fabric_background?.base_color || 'authentic fabric ground';
      const textureNotes = parsed.fabric_background?.texture_notes || 'natural weave texture';

      // Format each detected butti into bullet lines with structural details and color profiles
      const buttiBulletLines = rawButtis.map((b, idx) => {
        const pColors = Array.isArray(b.primary_colors) ? b.primary_colors.join(', ') : (b.primary_colors || '');
        const sColors = Array.isArray(b.secondary_colors) ? b.secondary_colors.join(', ') : (b.secondary_colors || '');
        const colorDesc = [pColors, sColors].filter(Boolean).join(' with accents of ');
        return `• Motif #${b.motif_id || (idx + 1)} (${b.shape_type}): ${b.structure_details}${colorDesc ? ` [Colors: ${colorDesc}]` : ''} | Arrangement: ${b.layout_arrangement || 'staggered diamond repeat'}`;
      });

      // Construct a comprehensive high-precision prompt directive for Kie.ai Nano-Banana
      const detailedDirective =
        `AUTHENTIC BUTTI STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
        `1. FABRIC BACKGROUND: Base color: ${baseColor} | Weave & texture: ${textureNotes}.\n` +
        `2. VERIFIED MOTIFS (${rawButtis.length} Distinct Styles Detected):\n` +
        `${buttiBulletLines.join('\n')}\n` +
        `3. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
        `- The AI must faithfully replicate each of the detected motif types above across the saree body, front waist pleats, and chest drape.\n` +
        `- Maintain exact miniature real-world scale (approx 1.0 cm to 1.5 cm) UNIFORMLY across all zones (chest drape, bust, waist, front pleats, and skirt). Under NO circumstances should buttis on the chest be enlarged or magnified compared to pleats.\n` +
        `- Motifs must extend continuously right to the very folded top edge and shoulder seam of the chest drape with ZERO blank margins or empty stripes.\n` +
        `- Preserve wide, airy 10x to 15x negative spacing of solid base fabric between motifs (approx 15 cm to 20 cm between buttis in an alternating staggered diagonal repeat matching the flat fabric swatch). Strictly forbid dense clustering, high butti density, or crowded buttis.`;

      const distinctMotifs = rawButtis.map((b, idx) => ({
        id: b.motif_id || (idx + 1),
        name: b.shape_type,
        category: (b.shape_type || '').toLowerCase().includes('flower') || (b.shape_type || '').toLowerCase().includes('petal') ? 'floral' : 'geometric',
        anatomy: b.structure_details,
        paletteDescription: `Primary: ${(b.primary_colors || []).join(', ')}. Secondary: ${(b.secondary_colors || []).join(', ')}. Layout: ${b.layout_arrangement}`,
        colors: [...(b.primary_colors || []), ...(b.secondary_colors || [])],
        technique: textureNotes,
        estimatedSizeCm: '1.2-1.5cm',
      }));

      const bodyMotifsText = rawButtis.length > 1
        ? `Dual alternating motifs: ${rawButtis.map(b => b.shape_type).join(' and ')} in an alternating staggered repeat grid with generous negative space`
        : (rawButtis[0]?.shape_type || 'Delicate repeating woven buttis with generous negative space');

      const visionResult = {
        isMultiMotif: rawButtis.length > 1,
        motifCount: rawButtis.length,
        layoutGrid: rawButtis.length > 1 ? 'alternating_staggered_grid' : 'single_motif_repeat',
        hasGoldOrTan: JSON.stringify(rawButtis).toLowerCase().includes('gold') || JSON.stringify(rawButtis).toLowerCase().includes('tan') || JSON.stringify(rawButtis).toLowerCase().includes('zari'),
        fabric_background: parsed.fabric_background,
        detected_buttis: rawButtis,
        distinctMotifs,
        spacingAndLayout: {
          gridPattern: 'alternating_staggered_grid',
          negativeSpacingRatio: '4x to 6x motif diameter of clean base silk',
          distributionRule: 'Uniform staggered distribution across skirt, pleats, and chest wrap'
        },
        scaleAndSizingRule: 'Maintain miniature scale (1.2 cm to 1.5 cm) uniformly across chest and pleats',
        promptDirective: detailedDirective,
        modelUsed: modelLabel,
      };

      return { bodyMotifs: bodyMotifsText, vision: visionResult };
    };

    // ─────────────────────────────────────────────────────────────
    // PROVIDER 1: Direct Google Gemini 3.6 Flash Vision API
    // User Specified: gemini-3-6-flash (single target model, no candidate list)
    // ─────────────────────────────────────────────────────────────
    if (googleGeminiKey) {
      console.log(`[Analyze Swatch] Scanning with Google gemini-3.6-flash (key: ${googleGeminiKey.substring(0, 8)}...)...`);
      try {
        const modelEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${googleGeminiKey}`;
        const startTime = Date.now();
        const geminiRes = await fetch(modelEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(45000),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'image/jpeg',
                      data: base64String,
                    },
                  },
                  { text: visionPrompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const jsonText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
            const cleanJson = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
            const parsed = JSON.parse(cleanJson);
            const elapsed = Date.now() - startTime;
            console.log(`[Analyze Swatch] Successfully analyzed swatch via Google gemini-3.6-flash in ${elapsed}ms!`);
            const result = buildStructuredVisionResult(parsed, `Google gemini-3.6-flash Vision`);
            return NextResponse.json({ success: true, analysis: result });
          }
        } else {
          const errData = await geminiRes.json().catch(() => null);
          console.warn(`[Analyze Swatch] Google gemini-3.6-flash failed (${geminiRes.status}):`, errData?.error?.message || geminiRes.statusText);
        }
      } catch (err: any) {
        console.warn(`[Analyze Swatch] Google gemini-3.6-flash failed:`, err?.message || err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PROVIDER 2: Kie.ai API with gemini-3-6-flash
    // User Specified: gemini-3-6-flash (single target model, no candidate list)
    // ─────────────────────────────────────────────────────────────
    if (kieApiKey) {
      console.log(`[Analyze Swatch] Scanning with Kie.ai gemini-3-6-flash (key: ${kieApiKey.substring(0, 6)}...)...`);
      try {
        const myHeaders = new Headers();
        myHeaders.append('Authorization', `Bearer ${kieApiKey}`);
        myHeaders.append('Content-Type', 'application/json');

        const rawPayload = JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: base64String,
                  },
                },
                { text: visionPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        });

        const startTime = Date.now();
        const kieRes = await fetch('https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:generateContent', {
          method: 'POST',
          headers: myHeaders,
          body: rawPayload,
          signal: AbortSignal.timeout(45000),
        });

        const resText = await kieRes.text();

        if (kieRes.ok) {
          const parsed = extractJsonFromGeminiResponse(resText);
          if (parsed) {
            const elapsed = Date.now() - startTime;
            console.log(`[Analyze Swatch] Successfully analyzed swatch via Kie.ai gemini-3-6-flash in ${elapsed}ms!`);
            const result = buildStructuredVisionResult(parsed, 'Kie.ai gemini-3-6-flash Vision');
            return NextResponse.json({ success: true, analysis: result });
          }
        } else {
          console.warn(`[Analyze Swatch] Kie.ai gemini-3-6-flash failed (${kieRes.status}):`, resText.slice(0, 200));
        }
      } catch (kieErr: any) {
        console.warn(`[Analyze Swatch] Kie.ai gemini-3-6-flash attempt failed:`, kieErr?.message || kieErr);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // PROVIDER 3: Local Computer Vision Analyzer (Offline Fallback)
    // Explicitly flags that AI servers were busy/unreachable
    // ─────────────────────────────────────────────────────────────
    console.warn('[Analyze Swatch] Online AI engines unavailable. Falling back to local Computer Vision analyzer...');
    const visionResult = await analyzeSwatchBuffer(buffer);
    const motifNames = (visionResult.distinctMotifs || []).map(m => m.name);
    const bodyMotifsText = visionResult.isMultiMotif
      ? `Dual alternating motifs: ${motifNames.join(' and ')} in a staggered repeating grid`
      : (motifNames[0] || 'Delicate repeating woven buttis with generous negative space');

    return NextResponse.json({
      success: true,
      isFallback: true,
      warning: 'AI vision servers were temporarily busy. Analyzed using local computer vision.',
      analysis: {
        bodyMotifs: bodyMotifsText,
        vision: {
          ...visionResult,
          modelUsed: 'Local Computer Vision (AI Busy Fallback)',
        },
      },
    });
  } catch (error: any) {
    console.error('[Analyze Swatch API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to analyze swatch',
      },
      { status: 500 }
    );
  }
}
