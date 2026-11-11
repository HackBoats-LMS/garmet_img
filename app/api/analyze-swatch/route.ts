import { NextRequest, NextResponse } from 'next/server';
import { analyzeSwatchBuffer } from '@/lib/swatchAnalyzer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * High-Precision Saree Swatch Analyzer.
 * Supports Kie.ai (gemini-3-6-flash) and direct Google Gemini Vision.
 * Accurately extracts fabric ground, pattern density (dense jaal vs sparse buttis),
 * separates body motifs from border strips, and exports full debug telemetry.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, imageUrl, provider = 'kie', allowLocalFallback = false, slotType = 'body' } = body;
    const isPalluSlot = slotType === 'pallu' || slotType === 'anchal';

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
      return NextResponse.json({ success: false, error: 'No valid image data provided' }, { status: 400 });
    }

    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const kieApiKey = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    const rawGoogleKey = process.env.GEMINI_API_KEY || '';
    const googleGeminiKey = rawGoogleKey.trim().replace(/^["']|["']$/g, '');

    const palluVisionPrompt = `You are a world-class Indian textile, handloom, and saree expert AI analyzer.
Analyze this uploaded Saree PALLU (anchal) swatch image with maximum precision.

CRITICAL INSPECTION OBJECTIVES:
1. PALLU END & HEM FINISH (CRITICAL - ZERO HALLUCINATIONS):
   - Inspect the bottom horizontal cross-cut edge / end hem of the pallu fabric.
   - Look closely: are there authentic physical dangling tassels, tied thread kuchu, pom-poms, fringe cords, or latkans attached to the edge?
   - Set "has_tassels": true ONLY if authentic physical hanging string tassels or tied thread fringe are clearly visible protruding from the hem edge.
   - If the edge is a clean, flat, straight stitched hem, a cut fabric edge, a woven border selvedge, or a clean flat finish with ZERO hanging strings or tassels, set "has_tassels": false.
   - Be completely honest: do NOT invent tassels if they are not in the photo.
2. PALLU ARTWORK & MOTIF HIERARCHY:
   - Identify the primary motifs on the pallu (e.g. peacock panels, floral border bands, tree of life, zari geometric bands).
   - Identify the background ground color and border bands framing the pallu.
   - Identify the craft/weave technique (e.g. Patola weave, Banarasi brocade, printed silk).

Return ONLY a raw JSON object (no markdown, no conversational text) matching this schema:
{
  "craft_technique": "string",
  "pallu_hem_features": {
    "has_tassels": boolean,
    "tassel_notes": "string"
  },
  "has_tassels": boolean,
  "fabric_background": {
    "base_color": "string",
    "texture_notes": "string"
  },
  "pallu_hem_features": {
    "has_tassels": boolean,
    "tassel_type": "none | tied_kuchu | pom_poms | thread_fringe | latkans",
    "tassel_description": "string",
    "edge_finish": "clean_flat_hem | tied_tassels_kuchu | fringed_threads | embroidered_scallop"
  },
  "has_tassels": boolean,
  "tassel_description": "string",
  "pattern_type": "traditional_narrative | dense_jaal | medium_repeat | border_and_plain",
  "spatial_density": {
    "type": "dense_jaal",
    "spacing_description": "string",
    "is_continuous_grid": false
  },
  "body_motifs": [
    {
      "motif_id": 1,
      "shape_type": "string",
      "category": "bird_fauna | floral | geometric | traditional_folk",
      "structure_details": "string",
      "primary_colors": ["string"],
      "secondary_colors": ["string"],
      "scale_estimate": "string",
      "layout_arrangement": "string",
      "visibility_confidence": "high | medium | low"
    }
  ],
  "border_elements": [
    {
      "border_id": 1,
      "type": "string",
      "description": "string",
      "colors": ["string"],
      "width_estimate": "string"
    }
  ],
  "replication_instructions": {
    "body_distribution_rule": "string",
    "scale_rule": "string",
    "negative_prompt_forbidden": ["string"]
  }
}`;

    const refinedVisionPrompt = `You are a world-class Indian textile, ethnic wear, and handloom fabric analysis AI expert.
Analyze the uploaded saree swatch or fabric photo with maximum precision.
This analyzer must accurately identify ANY Indian textile design, craft, weave, motif, or print style.

CRITICAL DISTINCTIONS:
1. FOCUS STRICTLY ON THE SAREE FABRIC: Ignore any background surfaces such as white bedsheets, tables, floor tiles, hands, or hangers.
2. DISTINGUISH BODY MOTIFS FROM BORDERS:
   - "body_motifs": Motifs repeating across the main saree body/field (e.g., small Warli figures, buttis, florals, repeating motifs in a jaal, checks, block prints, leheriya waves, bandhani dots).
   - "border_elements": Running decorative border bands along the selvedge/edge. DO NOT mistake a border band for an all-over repeating body butti.
3. DETECT PATTERN TYPE & SPATIAL DENSITY (Accurately categorize any of these):
   - "dense_jaal": Continuous all-over interlocking lattice, diamond jaal, floral jangla, or dense grid where motifs sit inside adjacent touching cells with minimal/no solid ground gaps (e.g., Patola, Ikat jaal, Banarasi brocade jaal).
   - "sparse_buttis": Isolated small motifs/buttis scattered across a solid base fabric ground with generous negative space (10x-15x motif size of plain fabric between buttis, approx 15-25cm apart, e.g., Chanderi buttis, Kanchipuram coin/chakra buttis, Warli dancers).
   - "medium_repeat": Regularly spaced repeating motifs with moderate 2x-5x negative spacing (approx 3-8cm apart, e.g., Sanganeri floral bootas, Ajrakh block prints).
   - "stripes_or_leheriya": Continuous diagonal tie-dye waves (leheriya/mothra), horizontal/vertical stripes, pinstripes, or chevron zig-zags.
   - "geometric_checks": Checks / grid squares (kattam, Madras checks, Kota doria grid) across the body, with or without micro-motifs inside check boxes.
   - "bandhani_dots": Traditional tied micro-dots (ekdali, trikunti, shikargah) forming organic waves, diamond clusters, or all-over speckles.
   - "traditional_narrative": Figurative / mythological / folk storytelling art (Warli, Madhubani, Kalamkari, Pichwai, dancing figures, temple scenes, musicians).
   - "floral_vines_bel": Meandering floral arabesque, leafy creepers, or flowing vines across the body.
   - "border_and_plain": Completely plain/solid body weave with all ornamentation concentrated on the borders and pallu.
   - "abstract_modern": Contemporary geometric or ombre/brushstroke prints.
4. IDENTIFY CRAFT / WEAVE TECHNIQUE:
   - Identify whether it is Woven Zari Brocade, Hand Block Print (Ajrakh/Bagru), Ikat/Patola Tie-Dye, Bandhani Tie-Dye, Delicate Embroidery (Chikankari/Resham/Kantha), Mirror/Zardozi Work, Handloom Plain Weave, etc.
5. EXACT COLOR EXTRACTION:
   - Accurately name the fabric base color (e.g., "Dusty Terracotta Rose", "Off-White / Ivory Cream", "Mustard Yellow", "Peacock Teal", "Deep Crimson", etc.) from the fabric itself, not the backdrop.
6. INSPECT HEM FINISH & TASSELS (CRITICAL - ZERO HALLUCINATION):
   - Look closely at the edges, hemline, or cross-cut ends of the fabric.
   - Set "has_tassels": true ONLY if authentic physical dangling string tassels, tied thread kuchu, pom-poms, or latkans are clearly visible attached along the edge.
   - If the edge is flat, stitched, woven border, or cut fabric with NO dangling strings or tassels, set "has_tassels": false.
   - Record findings in "pallu_hem_features": { "has_tassels": boolean, "tassel_notes": "string" }.

Return ONLY a raw JSON object (no markdown, no conversational text) matching this schema:
{
  "craft_technique": "string",
  "fabric_background": {
    "base_color": "string",
    "texture_notes": "string"
  },
  "pattern_type": "dense_jaal | sparse_buttis | medium_repeat | stripes_or_leheriya | geometric_checks | bandhani_dots | traditional_narrative | floral_vines_bel | border_and_plain | abstract_modern",
  "spatial_density": {
    "type": "dense_jaal | sparse_buttis | medium_repeat | stripes_or_leheriya | geometric_checks | bandhani_dots | traditional_narrative | floral_vines_bel | border_and_plain | abstract_modern",
    "spacing_description": "string",
    "is_continuous_grid": boolean
  },
  "body_motifs": [
    {
      "motif_id": 1,
      "shape_type": "string",
      "category": "floral | paisley | figurative | bird_fauna | geometric | traditional_folk | lattice_jaal | bandhani_dot | checks_stripes | abstract",
      "structure_details": "string",
      "primary_colors": ["string"],
      "secondary_colors": ["string"],
      "scale_estimate": "string",
      "layout_arrangement": "string",
      "visibility_confidence": "high | medium | low"
    }
  ],
  "border_elements": [
    {
      "border_id": 1,
      "type": "string",
      "description": "string",
      "colors": ["string"],
      "width_estimate": "string"
    }
  ],
  "replication_instructions": {
    "body_distribution_rule": "string",
    "scale_rule": "string",
    "negative_prompt_forbidden": ["string"]
  }
}`;

    // Helper: Parse Gemini response text whether it is single JSON or SSE stream chunks
    const activeVisionPrompt = isPalluSlot ? palluVisionPrompt : refinedVisionPrompt;

    const extractJsonFromGeminiResponse = (rawText: string): any | null => {
      if (!rawText) return null;
      try {
        const direct = JSON.parse(rawText);
        if (direct?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const partText = direct.candidates[0].content.parts[0].text;
          const cleanPart = partText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          return JSON.parse(cleanPart);
        }
        if (direct?.body_motifs || direct?.detected_buttis || direct?.fabric_background || direct?.motifs) {
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
          const cleanSse = sseCombined.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          return JSON.parse(cleanSse);
        } catch (e) {
          const match = sseCombined.match(/\{[\s\S]*\}/);
          if (match) return JSON.parse(match[0]);
        }
      }

      // Fallback regex extract
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {}
      }
      return null;
    };

    // Helper: Build structured vision response adapted for Kie.ai generation & UI inspection
    const buildStructuredVisionResult = (parsed: any, modelLabel: string, rawApiText: string) => {
      const rawList: any[] =
        Array.isArray(parsed.body_motifs) && parsed.body_motifs.length > 0
          ? parsed.body_motifs
          : Array.isArray(parsed.detected_buttis) && parsed.detected_buttis.length > 0
          ? parsed.detected_buttis
          : Array.isArray(parsed.motifs) && parsed.motifs.length > 0
          ? parsed.motifs
          : Array.isArray(parsed.distinctMotifs) && parsed.distinctMotifs.length > 0
          ? parsed.distinctMotifs
          : [];

      const rawBorders: any[] = Array.isArray(parsed.border_elements) ? parsed.border_elements : [];

      const baseColor = parsed.fabric_background?.base_color || parsed.base_color || 'authentic fabric ground';
      const textureNotes = parsed.fabric_background?.texture_notes || parsed.texture || 'natural weave texture';
      const craftTechnique = parsed.craft_technique || parsed.craft || 'Indian Ethnic Handloom / Textile Weave';

      const pTypeStr = String(parsed.pattern_type || parsed.spatial_density?.type || '').toLowerCase();
      const isDenseJaal =
        pTypeStr.includes('jaal') ||
        pTypeStr.includes('lattice') ||
        pTypeStr.includes('allover') ||
        pTypeStr.includes('all_over') ||
        parsed.spatial_density?.is_continuous_grid === true;

      const isStripesOrLeheriya =
        pTypeStr.includes('stripe') ||
        pTypeStr.includes('leheriya') ||
        pTypeStr.includes('chevron') ||
        pTypeStr.includes('wave');

      const isChecksOrKattam =
        pTypeStr.includes('check') ||
        pTypeStr.includes('kattam') ||
        pTypeStr.includes('doria');

      const isBandhani =
        pTypeStr.includes('bandhani') ||
        pTypeStr.includes('bandhej') ||
        pTypeStr.includes('tie_dye') ||
        pTypeStr.includes('dot');

      const isMediumRepeat =
        pTypeStr.includes('medium') ||
        pTypeStr.includes('boota') ||
        pTypeStr.includes('block_print');

      const isTraditionalNarrative =
        pTypeStr.includes('narrative') ||
        pTypeStr.includes('figurative') ||
        pTypeStr.includes('folk') ||
        pTypeStr.includes('warli') ||
        pTypeStr.includes('kalamkari') ||
        pTypeStr.includes('madhubani');

      const isFloralVines =
        pTypeStr.includes('vine') ||
        pTypeStr.includes('bel') ||
        pTypeStr.includes('creeper');

      const isPlainOrBorderOnly =
        pTypeStr.includes('plain') ||
        pTypeStr.includes('border_and_plain') ||
        pTypeStr.includes('solid');

      // Resolve canonical patternType
      let patternType = 'sparse_buttis';
      if (isDenseJaal) patternType = 'dense_jaal';
      else if (isStripesOrLeheriya) patternType = 'stripes_or_leheriya';
      else if (isChecksOrKattam) patternType = 'geometric_checks';
      else if (isBandhani) patternType = 'bandhani_dots';
      else if (isTraditionalNarrative) patternType = 'traditional_narrative';
      else if (isFloralVines) patternType = 'floral_vines_bel';
      else if (isMediumRepeat) patternType = 'medium_repeat';
      else if (isPlainOrBorderOnly) patternType = 'border_and_plain';
      else if (pTypeStr.includes('sparse')) patternType = 'sparse_buttis';
      else if (rawList.length > 2) patternType = 'dense_jaal';

      // Normalize motifs into structured array
      const normalizedButtis = rawList.map((b: any, idx: number) => {
        if (typeof b === 'string') {
          return {
            motif_id: idx + 1,
            shape_type: b,
            category: 'motif',
            structure_details: b,
            primary_colors: [],
            secondary_colors: [],
            scale_estimate: isDenseJaal ? 'framed in lattice' : 'miniature',
            layout_arrangement: isDenseJaal ? 'framed in adjacent lattice cells' : 'staggered diagonal repeat',
            visibility_confidence: 'high',
          };
        }
        return {
          motif_id: b.motif_id || b.id || idx + 1,
          shape_type: b.shape_type || b.name || `Motif #${idx + 1}`,
          category: b.category || ((b.shape_type || '').toLowerCase().includes('flower') || (b.shape_type || '').toLowerCase().includes('petal') ? 'floral' : 'geometric'),
          structure_details: b.structure_details || b.anatomy || b.description || b.paletteDescription || '',
          primary_colors: Array.isArray(b.primary_colors) ? b.primary_colors : (b.primary_colors ? [b.primary_colors] : (b.colors || [])),
          secondary_colors: Array.isArray(b.secondary_colors) ? b.secondary_colors : (b.secondary_colors ? [b.secondary_colors] : []),
          scale_estimate: b.scale_estimate || (isDenseJaal ? 'continuous lattice' : 'miniature 1.2-1.5cm'),
          layout_arrangement: b.layout_arrangement || (isDenseJaal ? 'framed in adjacent lattice cells' : isStripesOrLeheriya ? 'diagonal flow' : 'staggered diagonal repeat'),
          visibility_confidence: b.visibility_confidence || 'high',
        };
      });

      const buttiBulletLines = normalizedButtis.map((b, idx) => {
        const pColors = b.primary_colors.join(', ');
        const sColors = b.secondary_colors.join(', ');
        const colorDesc = [pColors, sColors].filter(Boolean).join(' with accents of ');
        const scaleStr = b.scale_estimate ? ` [Scale: ${b.scale_estimate}]` : '';
        return `• Motif #${b.motif_id || (idx + 1)} (${b.shape_type}): ${b.structure_details}${colorDesc ? ` [Colors: ${colorDesc}]` : ''}${scaleStr} | Arrangement: ${b.layout_arrangement}`;
      });

      const borderBulletLines = rawBorders.map((b: any, idx: number) => {
        const colors = Array.isArray(b.colors) ? b.colors.join(', ') : (b.colors || '');
        const width = b.width_estimate ? ` [Width: ${b.width_estimate}]` : '';
        return `• Border #${b.border_id || (idx + 1)} (${b.type || 'Border Strip'}): ${b.description || ''}${colors ? ` [Colors: ${colors}]` : ''}${width} (EDGE SELVEDGE ONLY - DO NOT SCATTER ON BODY)`;
      });

      // Construct dynamic directive based on detected pattern architecture
      let detailedDirective = '';
      const hasTassels = Boolean(parsed?.pallu_hem_features?.has_tassels === true || parsed?.has_tassels === true);
      const tasselDesc = parsed?.pallu_hem_features?.tassel_description || parsed?.tassel_description || parsed?.pallu_hem_features?.tassel_notes || (hasTassels ? "authentic tied thread tassels" : "");

      if (isPalluSlot) {
        detailedDirective =
          `AUTHENTIC PALLU & HEM GROUND TRUTH DIRECTIVE:\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PALLU HEM & FINISH: ${hasTassels ? `Authentic tied thread tassels (${tasselDesc || "kuchu"}) along the bottom end cross-hem.` : "Clean flat stitched hemline (zero dangling strings, zero tassels, clean straight hem)."}\n` +
          `3. PALLU PANELS & MOTIFS (${normalizedButtis.length} Elements):\n${buttiBulletLines.join("\n")}\n` +
          (borderBulletLines.length > 0 ? `4. FRAMING BORDERS:\n${borderBulletLines.join("\n")}\n` : "") +
          `5. REPLICATION INSTRUCTION:\n` +
          `- The pallu cascades straight down from the left shoulder to lower calf level behind the left arm.\n` +
          `- Replicate the authentic decorative panels, peacock figures, and framing borders directly from this swatch.\n` +
          `- Bottom end hemline must be ${hasTassels ? "finished with authentic tied tassels" : "a crisp flat tailored hem with zero tassels and zero dangling strings"}.`;
      } else if (isDenseJaal) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Continuous All-Over Diamond Jaal / Interlocking Lattice Grid.\n` +
          `3. VERIFIED MOTIFS (${normalizedButtis.length} Distinct Styles Framed in Grid):\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate the continuous interlocking diamond jaal / lattice grid across the saree body, front waist pleats, and chest drape.\n` +
          `- Motifs sit within adjacent touching lattice cells with NO wide solid gaps or empty patches.\n` +
          `- Maintain uniform authentic grid scale across chest and pleats 1:1 matching the reference swatch.\n` +
          `- Motifs must extend continuously right to the very folded top edge and shoulder seam with ZERO blank margins or unprinted stripes.`;
      } else if (isStripesOrLeheriya) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Continuous Diagonal Leheriya Waves / Chevron Stripes.\n` +
          `3. VERIFIED DESIGN ELEMENTS:\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate the continuous flowing diagonal waves / stripes across the saree body, cascading drape, and chest wrap.\n` +
          `- Follow natural fabric tension and drape curves, preserving rhythm, line thickness, and color sequence from the reference swatch.\n` +
          `- Stripes/waves must run uninterrupted across the diagonal chest drape right to the folded neckline edge with ZERO blank margins.`;
      } else if (isChecksOrKattam) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Structured Geometric Checks / Kattam Grid.\n` +
          `3. VERIFIED MOTIFS & GRID (${normalizedButtis.length} Elements):\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate the structured checks / grid squares across the saree skirt, waist pleats, and chest drape.\n` +
          `- Internal motifs sit cleanly inside repeating check squares with uniform square dimensions.\n` +
          `- Checks must extend continuously right to the folded top edge and shoulder seam with ZERO blank margins.`;
      } else if (isBandhani) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Traditional Tied Bandhani / Bandhej Micro-Dot Clusters.\n` +
          `3. VERIFIED BANDHANI PATTERNS:\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate authentic tied micro-dots forming organic diamond clusters or flowing bands across the body, pleats, and chest wrap.\n` +
          `- Maintain characteristic crinkled tie-dye texture and ring dot outlines from the reference image.\n` +
          `- Bandhani dot patterns must extend continuously across the chest drape right to the folded neckline edge with ZERO blank margins.`;
      } else if (isMediumRepeat) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Regularly Spaced Repeating Motifs (Balanced Medium Repeat, ~3-8 cm Spacing).\n` +
          `3. VERIFIED MOTIFS (${normalizedButtis.length} Distinct Styles Detected):\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate each repeating motif style in its authentic moderate spacing across the saree body, waist pleats, and chest wrap.\n` +
          `- Maintain exact medium real-world scale (approx 3-5 cm) uniformly across all zones (chest drape, bust, waist, front pleats, and skirt).\n` +
          `- Motifs must extend continuously right to the folded top edge and shoulder seam with ZERO blank margins.`;
      } else if (isTraditionalNarrative) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Traditional Folk / Tribal / Figurative Storytelling Art (e.g., Warli, Kalamkari, Madhubani).\n` +
          `3. VERIFIED FIGURATIVE MOTIFS:\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate authentic folk figurines, dancers, musicians, animals, and trees with 1:1 fidelity to their hand-drawn/embroidered line art.\n` +
          `- Distribute figures across the body in their authentic layout (staggered repeat or narrative rows) without mutating into generic modern prints.\n` +
          `- Keep motifs strictly consistent in scale across the chest drape, pleats, and skirt.`;
      } else if (isPlainOrBorderOnly) {
        detailedDirective =
          `AUTHENTIC PATTERN STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Clean Solid Plain Body Weave with Rich Border & Pallu Ornamentation.\n` +
          (borderBulletLines.length > 0 ? `3. BORDER & PALLU ELEMENTS:\n${borderBulletLines.join('\n')}\n` : '') +
          `4. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Keep the entire saree body, front waist pleats, and chest wrap solid and plain self-fabric matching the reference color and weave texture.\n` +
          `- Concentrate all embroidery, zari, and ornate detailing strictly along the hemline border and cascading pallu.`;
      } else {
        // default sparse buttis
        detailedDirective =
          `AUTHENTIC BUTTI STRUCTURE & SPATIAL DISTRIBUTION DIRECTIVE (KIE.AI NANO-BANANA GROUND TRUTH):\n` +
          `1. FABRIC BACKGROUND: Base color: ${baseColor} | Craft & weave: ${craftTechnique} (${textureNotes}).\n` +
          `2. PATTERN ARCHITECTURE: Sparse Widely-Spaced Delicate Buttis.\n` +
          `3. VERIFIED BODY MOTIFS (${normalizedButtis.length} Distinct Styles Detected):\n` +
          `${buttiBulletLines.join('\n')}\n` +
          (borderBulletLines.length > 0 ? `4. BORDER SELVEDGE (EDGE ONLY - STRICTLY DO NOT SCATTER ON BODY):\n${borderBulletLines.join('\n')}\n` : '') +
          `5. REPLICATION RULE FOR KIE.AI NANO-BANANA:\n` +
          `- Replicate each of the detected body motif types sparsely scattered in an offset staggered repeat across the solid base fabric.\n` +
          `- Maintain exact miniature real-world scale (approx 1.2 cm to 1.5 cm) UNIFORMLY across all zones (chest drape, bust, waist, front pleats, and skirt). Under NO circumstances should buttis on the chest be enlarged.\n` +
          `- Motifs must extend continuously right to the folded top edge and shoulder seam with ZERO blank margins.\n` +
          `- Preserve generous negative spacing of solid base fabric between motifs (approx 10x to 15x motif diameter) matching the flat fabric swatch.`;
      }

      const distinctMotifs = normalizedButtis.map((b) => ({
        id: b.motif_id,
        name: b.shape_type,
        category: b.category,
        anatomy: b.structure_details,
        paletteDescription: `Primary: ${b.primary_colors.join(', ')}. Secondary: ${b.secondary_colors.join(', ')}. Layout: ${b.layout_arrangement}`,
        colors: [...b.primary_colors, ...b.secondary_colors],
        technique: textureNotes,
        estimatedSizeCm: b.scale_estimate || (isDenseJaal ? '2.0-3.0cm grid' : '1.2-1.5cm'),
      }));

      const motifNames = normalizedButtis.map(b => b.shape_type).filter(Boolean);
      let bodyMotifsText = '';
      if (isPalluSlot) {
        bodyMotifsText = `Pallu Artwork: ${motifNames.join(", ") || "decorative panels"} with ${hasTassels ? "tied thread tassels" : "clean flat stitched hem (zero tassels)"}`;
      } else
      if (isDenseJaal) {
        bodyMotifsText = `Continuous All-Over Jaal: ${motifNames.join(', ')} framed in an interlocking lattice grid`;
      } else if (isStripesOrLeheriya) {
        bodyMotifsText = `Flowing Diagonal Leheriya Waves / Stripes: ${motifNames.join(', ') || 'alternating colored waves'}`;
      } else if (isChecksOrKattam) {
        bodyMotifsText = `Geometric Checks / Kattam Grid: ${motifNames.join(', ') || 'structured checks with repeating internal accents'}`;
      } else if (isBandhani) {
        bodyMotifsText = `Traditional Bandhani Tie-Dye: ${motifNames.join(', ') || 'tied micro-dot clusters'}`;
      } else if (isMediumRepeat) {
        bodyMotifsText = `Regular Medium Repeat: ${motifNames.join(', ')} with balanced moderate spacing`;
      } else if (isTraditionalNarrative) {
        bodyMotifsText = `Traditional Folk / Figurative Art: ${motifNames.join(', ')}`;
      } else if (isPlainOrBorderOnly) {
        bodyMotifsText = `Solid Plain Body Fabric in ${baseColor} with finished borders`;
      } else if (normalizedButtis.length > 1) {
        bodyMotifsText = `Dual alternating motifs: ${motifNames.join(' and ')} in an alternating staggered repeat grid with generous negative space`;
      } else {
        bodyMotifsText = normalizedButtis[0]?.shape_type || 'Delicate repeating woven buttis with generous negative space';
      }

      const visionResult = {
        pattern_type: patternType,
        craft_technique: craftTechnique,
        spatial_density: parsed.spatial_density || {
          type: patternType,
          spacing_description: isDenseJaal
            ? 'Continuous interlocking jaal grid'
            : isStripesOrLeheriya
            ? 'Continuous diagonal flowing waves/stripes'
            : isMediumRepeat
            ? 'Regular moderate repeat (~3-8cm spacing)'
            : isChecksOrKattam
            ? 'Structured grid checks'
            : isBandhani
            ? 'Organic tied dot clusters'
            : 'Sparse staggered buttis with 10x-15x negative spacing',
          is_continuous_grid: isDenseJaal || isStripesOrLeheriya || isChecksOrKattam,
        },
        isMultiMotif: normalizedButtis.length > 1,
        motifCount: normalizedButtis.length,
        layoutGrid: isDenseJaal
          ? 'continuous_jaal_grid'
          : isStripesOrLeheriya
          ? 'diagonal_wave_flow'
          : isChecksOrKattam
          ? 'geometric_checks_grid'
          : isBandhani
          ? 'bandhani_dot_clusters'
          : normalizedButtis.length > 1
          ? 'alternating_staggered_grid'
          : 'single_motif_repeat',
        hasGoldOrTan: JSON.stringify(normalizedButtis).toLowerCase().includes('gold') || JSON.stringify(normalizedButtis).toLowerCase().includes('tan') || JSON.stringify(normalizedButtis).toLowerCase().includes('zari'),
        fabric_background: {
          base_color: baseColor,
          texture_notes: textureNotes,
        },
        detected_buttis: normalizedButtis,
        body_motifs: normalizedButtis,
        border_elements: rawBorders,
        distinctMotifs,
        replication_instructions: parsed.replication_instructions,
        spacingAndLayout: {
          gridPattern: isDenseJaal ? 'continuous_jaal_grid' : isStripesOrLeheriya ? 'diagonal_wave_flow' : 'alternating_staggered_grid',
          negativeSpacingRatio: isDenseJaal ? 'Touching adjacent cells (zero solid gaps)' : isMediumRepeat ? '2x to 5x motif size' : '10x to 15x motif diameter of clean base silk',
          distributionRule: parsed.replication_instructions?.body_distribution_rule || 'Uniform distribution across skirt, pleats, and chest wrap'
        },
        scaleAndSizingRule: parsed.replication_instructions?.scale_rule || (isDenseJaal ? 'Maintain miniature dense grid scale uniformly' : 'Maintain miniature scale (1.2 cm to 1.5 cm) uniformly across chest and pleats'),
        has_tassels: hasTassels,
        tassel_description: tasselDesc,
        pallu_hem_features: parsed.pallu_hem_features || {
          has_tassels: hasTassels,
          tassel_type: hasTassels ? "tied_kuchu" : "none",
          tassel_description: tasselDesc,
          edge_finish: hasTassels ? "tied_tassels_kuchu" : "clean_flat_hem",
        },
        promptDirective: detailedDirective,
        modelUsed: modelLabel,
        rawJson: parsed,
        rawResponse: rawApiText,
      };

      return { bodyMotifs: bodyMotifsText, vision: visionResult };
    };

    // Determine engine order based on requested provider
    // Default: 'kie'
    const targetProvider = provider === 'google' ? 'google' : (provider === 'auto' ? 'auto' : 'kie');

    // ─────────────────────────────────────────────────────────────
    // EXECUTION: KIE.AI (gemini-3-6-flash) with Auto-Retry on 500
    // ─────────────────────────────────────────────────────────────
    const runKieAi = async (): Promise<{ success: boolean; result?: any; error?: string; raw?: string; status?: number }> => {
      if (!kieApiKey) {
        return { success: false, error: 'Kie.ai API key is not configured in environment variables (KIE_API_KEY)', status: 401 };
      }

      console.log(`[Analyze Swatch] Calling Kie.ai gemini-3-6-flash (key: ${kieApiKey.substring(0, 6)}...)...`);
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
              { text: activeVisionPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const maxAttempts = 3;
      let lastErrText = '';
      let lastStatus = 502;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const startTime = Date.now();
          const kieRes = await fetch('https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:generateContent', {
            method: 'POST',
            headers: myHeaders,
            body: rawPayload,
            signal: AbortSignal.timeout(45000),
          });

          const resText = await kieRes.text();
          lastErrText = resText;
          lastStatus = kieRes.status;

          let directObj: any = null;
          try {
            directObj = JSON.parse(resText);
          } catch (e) {}

          // Handle Kie.ai internal error code wrapper (e.g. code: 500 Server exception)
          if (directObj && typeof directObj.code === 'number' && directObj.code !== 200) {
            const errMsg = directObj.msg || directObj.message || `Server exception (code ${directObj.code})`;
            console.warn(`[Analyze Swatch] Kie.ai returned error code ${directObj.code} on attempt ${attempt}:`, errMsg);
            if (attempt < maxAttempts && (directObj.code === 500 || directObj.code === 502 || directObj.code === 503)) {
              console.log(`[Analyze Swatch] Retrying Kie.ai in 2000ms...`);
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            return {
              success: false,
              error: `Kie.ai Error ${directObj.code}: ${errMsg}`,
              raw: resText,
              status: directObj.code >= 400 && directObj.code < 600 ? directObj.code : 502,
            };
          }

          if (!kieRes.ok) {
            const errMsg = directObj?.msg || directObj?.message || directObj?.error?.message || `HTTP ${kieRes.status} ${kieRes.statusText}`;
            console.warn(`[Analyze Swatch] Kie.ai HTTP failed (${kieRes.status}) on attempt ${attempt}:`, errMsg);
            if (attempt < maxAttempts && (kieRes.status >= 500)) {
              await new Promise((r) => setTimeout(r, 2000));
              continue;
            }
            return {
              success: false,
              error: `Kie.ai HTTP ${kieRes.status}: ${errMsg}`,
              raw: resText,
              status: kieRes.status,
            };
          }

          const parsed = extractJsonFromGeminiResponse(resText);
          if (!parsed) {
            console.warn(`[Analyze Swatch] Kie.ai responded but failed to parse JSON candidate:`, resText.slice(0, 300));
            return {
              success: false,
              error: 'Kie.ai response could not be parsed as structured JSON',
              raw: resText,
              status: 502,
            };
          }

          const elapsed = Date.now() - startTime;
          console.log(`[Analyze Swatch] Successfully analyzed swatch via Kie.ai gemini-3-6-flash in ${elapsed}ms!`);
          const structured = buildStructuredVisionResult(parsed, 'Kie.ai gemini-3-6-flash Vision', resText);
          return { success: true, result: structured, raw: resText, status: 200 };
        } catch (fetchErr: any) {
          console.warn(`[Analyze Swatch] Kie.ai attempt ${attempt} network error:`, fetchErr?.message || fetchErr);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          return {
            success: false,
            error: `Network error connecting to Kie.ai: ${fetchErr?.message || fetchErr}`,
            raw: lastErrText,
            status: 502,
          };
        }
      }

      return {
        success: false,
        error: `Kie.ai request failed after ${maxAttempts} attempts: ${lastErrText.slice(0, 200)}`,
        raw: lastErrText,
        status: lastStatus,
      };
    };

    // ─────────────────────────────────────────────────────────────
    // EXECUTION: GOOGLE GEMINI (gemini-3.6-flash)
    // ─────────────────────────────────────────────────────────────
    const runGoogleGemini = async (): Promise<{ success: boolean; result?: any; error?: string; raw?: string; status?: number }> => {
      if (!googleGeminiKey) {
        return { success: false, error: 'Google Gemini API key is not configured in environment variables (GEMINI_API_KEY)', status: 401 };
      }

      console.log(`[Analyze Swatch] Calling Google gemini-3.6-flash (key: ${googleGeminiKey.substring(0, 8)}...)...`);
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
                { text: activeVisionPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      const resText = await geminiRes.text();
      let geminiData: any = null;
      try {
        geminiData = JSON.parse(resText);
      } catch (e) {}

      if (!geminiRes.ok) {
        const errMsg = geminiData?.error?.message || `HTTP ${geminiRes.status} ${geminiRes.statusText}`;
        console.warn(`[Analyze Swatch] Google gemini-3.6-flash failed (${geminiRes.status}):`, errMsg);
        return {
          success: false,
          error: `Google Gemini Error ${geminiRes.status}: ${errMsg}`,
          raw: resText,
          status: geminiRes.status,
        };
      }

      const parsed = extractJsonFromGeminiResponse(resText);
      if (!parsed) {
        return {
          success: false,
          error: 'Google Gemini response could not be parsed as structured JSON',
          raw: resText,
          status: 502,
        };
      }

      const elapsed = Date.now() - startTime;
      console.log(`[Analyze Swatch] Successfully analyzed swatch via Google gemini-3.6-flash in ${elapsed}ms!`);
      const structured = buildStructuredVisionResult(parsed, 'Google gemini-3.6-flash Vision', resText);
      return { success: true, result: structured, raw: resText, status: 200 };
    };

    // Route execution based on provider choice
    if (targetProvider === 'kie') {
      const outcome = await runKieAi();
      if (outcome.success) {
        return NextResponse.json({ success: true, provider: 'kie', analysis: outcome.result, rawOutput: outcome.raw });
      }
      return NextResponse.json(
        {
          success: false,
          provider: 'kie',
          error: outcome.error || 'Kie.ai analysis failed',
          rawOutput: outcome.raw,
        },
        { status: outcome.status || 502 }
      );
    }

    if (targetProvider === 'google') {
      const outcome = await runGoogleGemini();
      if (outcome.success) {
        return NextResponse.json({ success: true, provider: 'google', analysis: outcome.result, rawOutput: outcome.raw });
      }
      return NextResponse.json(
        {
          success: false,
          provider: 'google',
          error: outcome.error || 'Google Gemini analysis failed',
          rawOutput: outcome.raw,
        },
        { status: outcome.status || 502 }
      );
    }

    // targetProvider === 'auto' (Try Kie.ai first, fallback to Google if Kie fails)
    const kieOutcome = await runKieAi();
    if (kieOutcome.success) {
      return NextResponse.json({ success: true, provider: 'kie', analysis: kieOutcome.result, rawOutput: kieOutcome.raw });
    }

    console.warn('[Analyze Swatch] Kie.ai failed in auto mode, falling back to Google Gemini...', kieOutcome.error);
    const googleOutcome = await runGoogleGemini();
    if (googleOutcome.success) {
      return NextResponse.json({ success: true, provider: 'google', fallbackFrom: 'kie', analysis: googleOutcome.result, rawOutput: googleOutcome.raw });
    }

    // Both online engines failed
    if (allowLocalFallback) {
      console.warn('[Analyze Swatch] Both online engines failed. User opted for local Computer Vision fallback...');
      const visionResult = await analyzeSwatchBuffer(buffer);
      const motifNames = (visionResult.distinctMotifs || []).map(m => m.name);
      const bodyMotifsText = visionResult.isMultiMotif
        ? `Dual alternating motifs: ${motifNames.join(' and ')} in a staggered repeating grid`
        : (motifNames[0] || 'Delicate repeating woven buttis');

      return NextResponse.json({
        success: true,
        isFallback: true,
        warning: 'AI vision servers were unavailable. Analyzed using local computer vision.',
        analysis: {
          bodyMotifs: bodyMotifsText,
          vision: {
            ...visionResult,
            modelUsed: 'Local Computer Vision (Offline Fallback)',
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Swatch analysis failed. Kie.ai error: ${kieOutcome.error}. Google error: ${googleOutcome.error}.`,
        kieError: kieOutcome.error,
        googleError: googleOutcome.error,
      },
      { status: 502 }
    );
  } catch (error: any) {
    console.error('[Analyze Swatch API] Unexpected Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to analyze swatch',
      },
      { status: 500 }
    );
  }
}
