import { buildKieTaskPayload } from '@/lib/kie-adapter';
import { buildSareePrompt } from '@/app/utils/sareePromptBuilder';
import { CATEGORY_POSES_MAP, CONSISTENT_MODELS } from '@/app/utils/modelsAndPoses';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { uploadGeneratedAsset, uploadToStorage, isStorageConfigured } from '@/lib/storage';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Helper: Convert local public path or resolve data URL / remote URL
function resolveImageToDataUrl(imgStr: string): string | null {
  if (!imgStr) return null;
  if (imgStr.startsWith('data:image/')) return imgStr;
  if (imgStr.startsWith('http://') || imgStr.startsWith('https://')) return imgStr;

  if (imgStr.startsWith('/')) {
    try {
      const publicPath = path.join(process.cwd(), 'public', imgStr.replace(/^\//, ''));
      if (fs.existsSync(publicPath)) {
        const fileBuf = fs.readFileSync(publicPath);
        const ext = path.extname(publicPath).replace('.', '').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${fileBuf.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[API /generate] Failed to resolve public image path:', imgStr, e);
    }
  }
  return null;
}



export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit('api:generate', ip, { windowMs: 60 * 1000, max: 20 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many generation requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const session = await auth();
    const body = await req.json();

    const {
      prompt,
      borderStyle,
      tasselStyle,
      blouseStyle,
      referenceImageUrl,
      referenceImages,
      modelFaceUrl,
      posePreviewUrl,
      userId: reqUserId,
      templateId,
      orderId,
      poseId,
      productName,
      stockCode,
      description,
      uploadedImages,
      icp,
      occasion,
      fabricType,
      sareeDesignType,
      promptSuggestions,
      selectedModelId,
      selectedOptions,
      crop = false,
      seed = 42,
      steps = 30,
      aspectRatio = '3:4',
      productId,
      // V2 Structured Saree Fields:
      nanoBananaV2 = false,
      sareeFabricType,
      palluSize,
      borderWidth,
      borderEdges,
      tassels,
      tasselColor,
      tasselLocation,
      blouseRule,
      bodyDescription,
      palluDescription,
      borderDescription,
      approvedGarmentRefUrl,
      approvedRearGarmentRefUrl,
      includeOriginalSwatches = true,
      sendPosePreview = false,
      selectedBackgroundPreset,
    } = body;

    const userId = reqUserId || (session?.user as any)?.id || 'anonymous_user';

    // Fetch Template from DB (support both cuid ID and slug like 'saree')
    const template = templateId ? await (async () => {
      let t = await prisma.garmentTemplate.findUnique({
        where: { id: templateId },
        include: { poses: true }
      });
      if (!t) {
        t = await prisma.garmentTemplate.findFirst({
          where: { slug: templateId },
          include: { poses: true }
        });
      }
      return t;
    })() : null;

    // Robust Pose Lookup: by ID, by Name, by Preview URL, or static fallback
    const incomingPoseName = (body.poseName || '').trim();
    const incomingPoseSnippet = (body.poseSnippet || '').trim();
    const incomingPosePreview = (body.posePreviewUrl || posePreviewUrl || '').trim();

    let dbPose: any = null;
    if (template?.poses?.length) {
      if (poseId) {
        dbPose = template.poses.find((p: any) => p.id === poseId);
      }
      if (!dbPose && incomingPoseName) {
        dbPose = template.poses.find((p: any) => p.name.toLowerCase() === incomingPoseName.toLowerCase() || p.name.toLowerCase().includes(incomingPoseName.toLowerCase()));
      }
      if (!dbPose && poseId) {
        dbPose = template.poses.find((p: any) =>
          p.name.toLowerCase() === poseId.toLowerCase() ||
          p.name.toLowerCase().includes(poseId.toLowerCase()) ||
          poseId.toLowerCase().includes(p.name.toLowerCase())
        );
      }
      if (!dbPose && incomingPosePreview) {
        dbPose = template.poses.find((p: any) => p.previewImage === incomingPosePreview);
      }
    }

    if (!dbPose) {
      const isSareeCheck = template?.slug?.toLowerCase().includes('saree') || template?.name?.toLowerCase().includes('saree') || (uploadedImages && (uploadedImages['saree_body'] || uploadedImages['body'] || uploadedImages['pallu']));
      const staticList = (isSareeCheck ? CATEGORY_POSES_MAP.saree : (CATEGORY_POSES_MAP as any).kurti) || CATEGORY_POSES_MAP.saree || [];
      dbPose = staticList.find((p: any) =>
        p.id === poseId ||
        (incomingPoseName && p.name.toLowerCase() === incomingPoseName.toLowerCase()) ||
        (poseId && p.name.toLowerCase() === poseId.toLowerCase()) ||
        (poseId && p.name.toLowerCase().includes(poseId.toLowerCase())) ||
        (poseId && poseId.toLowerCase().includes(p.name.toLowerCase())) ||
        (incomingPosePreview && p.defaultSample === incomingPosePreview)
      );
    }

    // 1. Determine active Kie.ai model from body override, KieModel DB table, or fallback
    const requestedModel = body.kieModel || body.modelId || body.selectedEngine || process.env.KIE_DEFAULT_MODEL;
    let kieModelId = requestedModel || 'nano-banana-2-1 2k'; // fallback to Seedream 5 Pro
    if (!requestedModel) {
      try {
      // Try KieModel table first (admin-managed)
      const kieRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT "modelId" FROM "KieModel" WHERE "isDefault" = true AND "isActive" = true LIMIT 1;`
      );
      if (kieRows?.[0]?.modelId) {
        kieModelId = kieRows[0].modelId;
      } else {
        // Fallback: read from StudioConfig
        const cfgRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT "selectedEngine" FROM "StudioConfig" WHERE "id" = 'global_studio_config' LIMIT 1;`
        );
        if (cfgRows?.[0]?.selectedEngine) {
          kieModelId = cfgRows[0].selectedEngine;
        }
      }
    } catch (e) {
      console.warn('[Generate Route] Using fallback Kie.ai model:', e);
      }
    }

    console.log(`[API /generate] Kie.ai Model: ${kieModelId}`);

    // Collect all valid reference images
    const rawImageList: string[] = [];
    const resolvedModelFace = modelFaceUrl ? resolveImageToDataUrl(modelFaceUrl) : null;
    const resolvedPosePreview = posePreviewUrl ? resolveImageToDataUrl(posePreviewUrl) : null;

    if (resolvedModelFace) {
      rawImageList.push(resolvedModelFace);
    }

    if (Array.isArray(referenceImages)) {
      for (const img of referenceImages) {
        const resolved = resolveImageToDataUrl(img);
        if (resolved && resolved !== resolvedModelFace) {
          rawImageList.push(resolved);
        }
      }
    }
    if (rawImageList.length === 0 && referenceImageUrl) {
      const resolved = resolveImageToDataUrl(referenceImageUrl);
      if (resolved) rawImageList.push(resolved);
    }

    const cleanPrompt = (prompt || '').replace(/--ar\s+\d+:\d+/gi, '').trim();

    // ─────────────────────────────────────────────────────────────
    // PIAPI GEMINI 3.1 FLASH-LITE IMAGE ENGINE
    // Sends ALL fabric images + model face directly to Gemini
    // Gemini natively understands multiple images — no Cloudinary needed!
    // ─────────────────────────────────────────────────────────────
    const rawKieKey = (process.env.KIE_API_KEY || process.env.PIAPI_API_KEY || '').trim();
    const kieApiKeyBearer = rawKieKey.replace(/^Bearer\s+/i, '').replace(/^["']|["']$/g, '').trim();

    if (!kieApiKeyBearer) {
      return NextResponse.json(
        {
          error: 'KIE_API_KEY is not configured. Please add KIE_API_KEY to your .env.local file.',
          needsKey: true,
        },
        { status: 401 }
      );
    }

    // 1. Collect ALL reference images as base64 for Gemini multimodal input
    const geminiImageParts: { inline_data: { mime_type: string; data: string } }[] = [];

    // Helper: extract raw base64 from data URL or resolve file
    const addImagePart = (imgStr: string | null, label: string) => {
      if (!imgStr) return;
      const resolved = resolveImageToDataUrl(imgStr);
      if (!resolved) return;

      if (resolved.startsWith('data:image/')) {
        const match = resolved.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          geminiImageParts.push({
            inline_data: { mime_type: match[1], data: match[2] },
          });
          console.log(`[Gemini] Added ${label} image (${match[1]}, ${Math.round(match[2].length / 1024)}KB base64)`);
        }
      } else if (resolved.startsWith('http')) {
        // For remote URLs, we'll pass them as-is and Gemini will fetch them
        console.log(`[Gemini] Skipping remote URL for ${label} (Gemini prefers inline_data)`);
      }
    };

    // Deterministic, canonical slot ordering: Body -> Pleats -> Ribbon -> Pallu -> Blouse
    const canonicalOrder = ['body', 'macro_motif', 'pleat_art', 'border_ribbon', 'border', 'pallu', 'blouse'];
    const activeSlotsOrdered: { id: string; label: string; dataUrl: string }[] = [];

    if (uploadedImages && typeof uploadedImages === 'object') {
      const keys = Object.keys(uploadedImages);
      // Sort keys based on canonical order
      const sortedKeys = keys.sort((a, b) => {
        const getRank = (k: string) => {
          const lk = k.toLowerCase();
          if (lk.includes('body') || lk.includes('garment')) return 0;
          if (lk.includes('macro') || lk.includes('motif')) return 1;
          if (lk.includes('upper_border') || lk.includes('top_border')) return 2;
          if (lk.includes('pleat')) return 3;
          if (lk.includes('ribbon')) return 3;
          if (lk.includes('border') && !lk.includes('pallu')) return 4;
          if (lk.includes('pallu')) return 5;
          if (lk.includes('blouse')) return 6;
          return 10;
        };
        return getRank(a) - getRank(b);
      });

      for (const slotId of sortedKeys) {
        const img = uploadedImages[slotId];
        if (img) {
          const cleanLabel = slotId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          activeSlotsOrdered.push({ id: slotId, label: cleanLabel, dataUrl: img });
          addImagePart(img, `fabric_${slotId}`);
        }
      }
    }

    // Add model face image (strictly after fabric swatches)
    if (modelFaceUrl) {
      addImagePart(modelFaceUrl, 'model_face');
    }

    console.log(`[Kie.ai] Total reference images collected: ${geminiImageParts.length}`);

    // 2. Build Kie.ai prompt with explicit fabric & image instructions
    const fabricCount = Object.keys(uploadedImages || {}).filter(k => uploadedImages[k]).length;
    const slotLabels = Object.keys(uploadedImages || {}).filter(k => uploadedImages[k]);

    let imageInstructions = '';
    const defaultGarmentType = 'map the uploaded fabric swatches precisely to the corresponding garment sections';
    const garmentMapping = template?.garmentType || defaultGarmentType;

    // Garment classification: Saree vs Kurti / Western / Salwar
    const isKurti = Boolean(
      template?.slug?.toLowerCase().includes('kurti') ||
      template?.slug?.toLowerCase().includes('kurta') ||
      template?.garmentType?.toLowerCase().includes('kurti') ||
      template?.garmentType?.toLowerCase().includes('kurta') ||
      template?.name?.toLowerCase().includes('kurti') ||
      template?.name?.toLowerCase().includes('kurta') ||
      productName?.toLowerCase().includes('kurti') ||
      productName?.toLowerCase().includes('kurta') ||
      (stockCode && (stockCode.toLowerCase().startsWith('k-') || stockCode.toLowerCase().startsWith('kp-') || stockCode.toLowerCase().startsWith('kpd-') || stockCode.toLowerCase().startsWith('sk-')))
    );

    const isSaree = !isKurti && Boolean(
      template?.slug?.toLowerCase().includes('saree') ||
      template?.garmentType?.toLowerCase().includes('saree') ||
      template?.name?.toLowerCase().includes('saree') ||
      sareeDesignType ||
      borderStyle
    );

    // Saree design mode & border architecture routing (decoupled)
    const isDelicate = (sareeDesignType || '') === 'delicate_buttis';
    const isComplex = (sareeDesignType || '') === 'dual_tier_pleats' || (sareeDesignType || '').startsWith('complex');
    const isLowerOnly = borderStyle === 'lower_border_only' || borderStyle === 'lower_border_borderless' || (sareeDesignType || '').includes('lower_only');
    const isBorderlessLower = borderStyle === 'lower_border_borderless';
    const isDualBorders = borderStyle === 'different_borders' || 
      borderStyle === 'dual_contrasting_borders' || 
      (sareeDesignType || '').includes('dual') ||
      (isComplex && borderStyle !== 'symmetric' && !isLowerOnly);

    // Inject garment-aware fabric mapping
    if (activeSlotsOrdered.length > 0) {
      const labelDescriptions = activeSlotsOrdered.map((slot, i) => {
        return `Image ${i + 1}: ${slot.label}`;
      });
      imageInstructions = `I am providing ${fabricCount} reference fabric swatch image(s) in order:\n${labelDescriptions.join('\n')}\n` +
        `You MUST use the EXACT colors, patterns, motifs, weave texture, and design from these fabric swatches. ` +
        `Instruction: ${garmentMapping}. ` +
        `Do NOT invent new patterns or colors for the provided swatches. The generated garment sections must be a pixel-accurate replication of the provided fabric images.\n` +
        `CRITICAL VISUAL GROUND TRUTH OVERRIDE: The visual colors, fabric textures, motifs, and borders shown in the uploaded fabric swatches represent the ABSOLUTE and FINAL ground truth. If any product name or text prompt conflicts with the visual colors, weave, or motifs in the reference swatch images, the visual reference swatches STRICTLY take precedence.\n`;

      if (isSaree) {
        imageInstructions += `CRITICAL SAREE DRAPING ARCHITECTURE & ROLE BOUNDARIES:\n` +
        `- BODY FABRIC: Forms the skirt, waist pleats, and the diagonal wrap across the chest/bust to the left shoulder.\n` +
        `- PALLU (ANCHAL) STRICT MOTIF ISOLATION & ZERO TEXTURE BLEED: The Pallu swatch features a distinct, dedicated decorative artwork (such as geometric tiles, folk prints, or pictorial panels). CRITICAL: Under NO circumstances should the repeating body print (e.g. vines, butis, florals) be copied, mixed, or bled into the pallu artwork. Even in monochrome sarees sharing similar color palettes, the pallu must preserve its EXACT unique grid, tiles, and motifs from the Pallu Swatch with crisp, razor-sharp fidelity.
- PALLU GRAVITATIONAL ORIENTATION & PLEAT SCALE (6-8 INCHES / 18CM): The pallu is anchored securely at the LEFT SHOULDER and falls straight downward behind the left arm to calf/ankle level, exactly matching the vertical orientation of the Pallu reference swatch. The authentic reference border runs vertically along the outer hanging edge down to the hem. Tassels hang strictly along the bottom horizontal end hem at calf level—NEVER along vertical borders, side edges, or front drape. The pallu is NOT wrapped across the front abdomen.\n` +
        (isLowerOnly ? (
          isBorderlessLower ? (
`- LOWER BORDER ONLY ARCHITECTURE (BORDERLESS SELF-FABRIC CHEST WRAP):
  * The saree features a single continuous lengthwise border along its bottom edge and outer pallu edge.
  * LOWER HEM & PALLU DRAPE: The authentic reference border from the reference swatch runs along the lower skirt hemline at the feet AND along the outer vertical drape of the cascading pallu down to the bottom tassels.
  * CHEST WRAP ZERO-BORDER RULE: The diagonal chest wrap across the bust and over the shoulder consists purely of clean body fabric: plain unbordered folded edge meeting the blouse neckline.
  * BUTTI CONTINUITY TO THE TOP EDGE (ZERO BLANK MARGINS): Delicate repeating buttis MUST continue seamlessly across the chest wrap right up to the folded neckline edge and shoulder seam. There must be ZERO empty margins, ZERO plain dead bands, and ZERO unprinted stripes where an upper border would normally sit.
  * UNIFORM BUTTI SCALE: All buttis across the chest, pleats, and skirt must maintain strictly identical miniature scale (approx 1.2 cm - 1.5 cm). Under no circumstances should chest buttis be enlarged.\n`
          ) : (
`- LOWER BORDER ONLY ARCHITECTURE (TOP BORDER RIBBON, BUTTIS TO THE RIBBON):
  * The saree features a single continuous lengthwise border along its bottom edge and outer pallu edge.
  * LOWER HEM & PALLU DRAPE: The authentic reference border from the reference swatch runs along the lower skirt hemline at the feet AND along the outer vertical drape of the cascading pallu down to the bottom tassels.
  * CHEST WRAP TOP BORDER RIBBON: The diagonal chest wrap across the bust and over the shoulder features a neat, narrow finished border ribbon (~0.5 cm - 1 cm solid woven piping / edge ribbon) along its top edge meeting the blouse neckline.
  * BUTTI CONTINUITY TO THE BORDER RIBBON (ZERO BLANK MARGINS): Delicate repeating buttis MUST continue seamlessly across the chest wrap right into the top border area up to the border ribbon and shoulder seam. There must be ZERO empty margins, ZERO plain dead bands, and ZERO unprinted stripes.
  * UNIFORM BUTTI SCALE: All buttis across the chest, pleats, and skirt must maintain strictly identical miniature scale (approx 1.2 cm - 1.5 cm). Under no circumstances should chest buttis be enlarged.\n`
          )
        ) : (
`- LENGTHWISE BORDER FIDELITY & UNBROKEN CONTINUITY (ZERO FABRICATION):
  * The outer border running along the length of the saree, across the chest wrap, and down the cascading pallu must be a solid, continuous, unbroken, razor-sharp ribbon from shoulder to hemline.
  * Faithfully replicate the exact geometry, motifs, weave structure, and colors directly from the uploaded reference border swatch. Under NO circumstances should borders be simplified, broken, fragmented, or substituted with generic wavy ribbons or invented gold trim.
  * UNBROKEN CASCADE: The border must never vanish, slice, break into segments, or turn into a thin single line midway down the drape.
  * MOTIF PURITY: Never bleed or blend the pallu cross-border motifs into the lengthwise saree border.
  * LOWER SKIRT BORDER FIDELITY: The bottom hem running along the feet of the saree must replicate the EXACT horizontal border pattern and embroidery from the reference fabric. DO NOT replace the lower border with random plain fabric or invent a different motif.\n`
        )) +
`- PALLU HORIZONTAL & CROSS-BORDERS: If the reference Pallu swatch features horizontal cross-borders, framing bands, or dividing ribbons between the body and the pallu, faithfully replicate them in their natural horizontal orientation across the width of the pallu drape.
- CRITICAL ALL-OVER MOTIF CONTINUITY (NO BLANK OR SOLID SECTIONS): When the fabric features repeating motifs, block prints, butis, florals, or dots, preserve their exact relative scale and spacing from the swatch across the entire saree from waist to feet. If the fabric has delicate, small, or spaced embroidered butis/threadwork (such as tiny floral sprigs or miniature motifs on silk/linen), maintain their true delicate size and natural negative spacing—DO NOT blow them up into giant prints or erase them. Motifs must cover the chest, lap, pleats, and thighs continuously without leaving random blank or solid patches.
- CRITICAL: DO NOT add beads, hanging pearl drops, tassels, fringes, pom-poms, or latkans to the end of the pallu or the bottom hem of the saree UNLESS they are clearly and explicitly present in the provided reference images. Do NOT invent beads or hanging ornaments; keep hems and pallu ends cleanly stitched and flat.
- BLOUSE STYLING (FALLBACK): When no blouse swatch is uploaded, synthesize an elegantly tailored blouse using the saree base body fabric or clean matching solid tone with modest round neckline and elbow-length or short tailored sleeves (fully covered shoulders, tailored sleeves, strictly NOT sleeveless, NO bare shoulders).`;

        if (isDelicate) {
          const hasMacroMotif = uploadedImages && (
            uploadedImages['macro_motif'] || uploadedImages['motif'] ||
            uploadedImages['macro'] || uploadedImages['close_up']
          );
          const macroSlotIdx = activeSlotsOrdered.findIndex(s => {
            const lk = s.id.toLowerCase();
            return lk.includes('macro') || lk.includes('motif') || lk.includes('close_up');
          });
          const macroImgNum = macroSlotIdx >= 0 ? macroSlotIdx + 1 : null;

          imageInstructions += '\nCRITICAL REFERENCE MOTIF FIDELITY:\n' +
            '- EXACT REFERENCE MOTIF REPLICATION: The saree body features delicate, miniature motifs. Use the provided swatches to replicate their EXACT visual shapes, geometry, threadwork, and colors straight from the reference images with 100% fidelity.\n' +
            '- TRUE DELICATE SCALE & SPACING: Motifs must remain small, delicate, and evenly spaced with generous negative space exactly as shown in the reference swatch.\n' +
            '- STRICT ZERO CHEST/TORSO EMBROIDERY: The torso wrap and bust must feature ONLY the delicate repeating miniature buttis from the swatch.\n';

          if (hasMacroMotif && macroImgNum) {
            imageInstructions += `\nCRITICAL MACRO CLOSE-UP GROUND TRUTH (Image ${macroImgNum} IS THE DETAIL REFERENCE ONLY):\n` +
              `- Image ${macroImgNum} is a ZOOMED-IN photograph of the exact repeating motifs. Reproduce them with 100% fidelity.\n`;
          }
        } else if (isComplex) {
          imageInstructions += '\nCRITICAL COMPLEX DUAL-TIER SAREE ARCHITECTURE:\n' +
            '- UPPER BODY & CHEST WRAP (75%-80% OF GARMENT HEIGHT): The base fabric covers upper body down past knees.\n' +
            '- LOWER SKIRT & PLEAT ART SCALE (15%-20% HEIGHT ONLY): Lower hem border band occupying ONLY the bottom 15-20%.\n';
        }

        if (isLowerOnly) {
          imageInstructions += '\nCRITICAL SINGLE-BORDER ARCHITECTURE: Chest wrap has zero top border. Lower hem runs along floor and cascading pallu.\n';
        } else if (isDualBorders) {
          imageInstructions += '\nCRITICAL TWO BORDER DESIGNS: Upper chest drape uses upper border swatch. Lower skirt hemline uses lower border swatch.\n';
        }
      } else {
        // NON-SAREE / KURTI TAILORING ARCHITECTURE
        imageInstructions += `CRITICAL KURTI / SALWAR SUIT TAILORING & ARCHITECTURE:
- GARMENT & KURTI SILHOUETTE: An exquisitely tailored luxury Indian kurti / kurta set. Replicate the EXACT prints, colors, weave texture, and embroidery from the uploaded fabric swatches with pixel-level fidelity.
- NECKLINE & CRAFTWORK: Authentic tailored modest neckline, crisp placket, and collar craft details with high-definition embroidery.
- SLEEVES & SLITS: Tailored three-quarter or full sleeves with crisp side slits and natural, graceful garment drape.
- BOTTOM PANT: Coordinated tailored bottom pant (straight-cut trousers, palazzo, or churidar) that complements or matches the provided bottom fabric swatch.
- DUPATTA / SCARF: If a dupatta is included, it is gracefully draped over the model's shoulder or arms with matching finished borders and natural flow.
- STRICT NON-SAREE RULE: Under NO circumstances should this garment be draped as a saree. Absolutely NO saree pallu, NO waist pleats, and NO bare-midriff saree blouse. This is strictly a tailored kurti / kurta ensemble.
- ALL-OVER MOTIF CONTINUITY: Patterns, butis, or block prints must cover the garment continuously from collar to hemline without random blank or solid patches.`;
      }
    }

    // User prompt suggestions & cross-pose swatch corrections
    if (promptSuggestions && typeof promptSuggestions === 'string' && promptSuggestions.trim()) {
      imageInstructions += `\n\nCRITICAL USER CORRECTIONS & SWATCH DIRECTION (STRICTLY APPLY ACROSS ALL POSES):
${promptSuggestions.trim()}
MANDATORY: Follow these user corrections precisely. Ensure referenced swatches (Image 1, Image 2, Image 3...), motifs, borders, fabric placements, and drape alignment are maintained consistently across all camera angles and poses without deviation.`;
    }

    // Dynamic Background & Vibe Logic
    let dynamicBackground = 'Muted neutral background, soft daylight 9am-2pm, window/open shade';
    let dynamicStyling = '';

    // Occasion matching
    if (occasion === 'Onam / festival') dynamicBackground = 'Mirror or courtyard, warm light. Vibe: Rooted, festive';
    else if (occasion === 'Kitty party') dynamicBackground = 'Café / friend\'s living room. Vibe: Noticed';
    else if (occasion === 'Parent-teacher meet') dynamicBackground = 'Home entrance w/ bag or car-side. Vibe: Capable';
    else if (occasion === 'Small get-together') dynamicBackground = 'Living room / dining. Vibe: Unhurried';
    else if (occasion === 'Workday') dynamicBackground = 'Office corridor. Vibe: Professional';
    else if (fabricType) {
      // Fabric matching (fallback)
      if (fabricType === 'Linen / light cotton') dynamicBackground = 'Balcony / terrace (open shade). Vibe: Airy, breathable, light-filled';
      else if (fabricType === 'Everyday cotton / ajrakh / print') dynamicBackground = 'Home doorway / living room. Vibe: Everyday home, daylight';
      else if (fabricType === 'Tussar / silk / premium') dynamicBackground = 'Mirror / dressing corner (warm light). Vibe: Rich getting-ready ritual, premium';
      else if (fabricType === 'Kurti set (any)') dynamicBackground = 'Office / car-side / home entrance. Vibe: On-the-go';
    }

    // ICP matching
    if (icp === 'home_ceo') {
      dynamicStyling = 'Expression: Composed, gracious, private half-smile. Hand moments: Pallu at shoulder, teacup, hand on doorframe, tuck pleats, house keys. Styling: Small gold jhumkas/studs, 1-2 bangles, bindi, low bun or done-open, structured handbag, flats/kolhapuris, elbow-sleeve blouse. Light: Soft daylight 9am-2pm.';
    } else if (icp === 'professional') {
      dynamicStyling = 'Expression: Direct, capable, confident half-smile. Hand moments: Tote onto shoulder, phone, folder/laptop bag, watch, car door. Styling: Studs/small hoops, watch, bindi optional, open hair/ponytail, tote/laptop bag, block heels/loafers, glasses ok, fitted short-sleeve blouse. Light: Soft daylight 9am-2pm.';
    }

    // Default template fallbacks (if not configured in DB)
    const fallbackSystemPrompt = 'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style.';
    const fallbackCamera = 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, razor-sharp focus, crisp details, hyper-realistic depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting. Eye-level (peer POV), face always visible.';
    const fallbackNegative = 'bad anatomy, deformed fingers, fused fingers, too many fingers, missing fingers, broken wrist, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, out of focus, soft focus, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, floating jewelry, melting jewelry, unnatural fabric tension, watermark, signature, blurry text, cropped head, unnatural poses, bright flash, evening bulb light, garish colors, hanging beads, unwanted tassels, fringe, plain unprinted lap, solid unprinted pleats, blank fabric on lap, missing motifs on skirt, unreferenced patterns, unreferenced embroidery, unreferenced chest border, mismatched borders, oversized buttis, giant enlarged motifs, distorted motifs, oversized pallu, loose shawl pallu, mismatched body print, sideways rotated pallu, misplaced pleat art';
    
    const sysPrompt = template?.systemPrompt || fallbackSystemPrompt;
    const camSettings = template?.cameraSettings || fallbackCamera;

    // Strict Mirror Pose Detection: ONLY when the specific pose is a mirror pose
    const isMirror = Boolean(
      (dbPose?.name || '').toLowerCase().includes('mirror') ||
      (incomingPoseName || '').toLowerCase().includes('mirror') ||
      (poseId || '').toLowerCase().includes('mirror') ||
      (incomingPosePreview || '').toLowerCase().includes('mirror') ||
      (incomingPoseSnippet || '').toLowerCase().includes('mirror')
    );

    const mirrorPhysicsRule = isMirror
      ? '\n- OPTICAL MIRROR PHYSICS: The mirror reflection must obey real-world optical ray-tracing geometry. The reflection in the mirror must show the model looking directly into her own eyes in the glass with matching body position, raised hand, and pallu pin placement in exact geometric symmetry with the foreground model. Zero distorted reflections, no impossible angles, no duplicate limbs, single coherent identity.'
      : '';

    const mirrorNeg = isMirror
      ? ', broken mirror physics, distorted reflection, impossible reflection angle, reflection looking at camera while body faces away, double faces, duplicate limbs, floating hands, misaligned reflections, uncanny valley reflection, two different people in mirror'
      : '';

    const negPrompt = (template?.negativePrompt || fallbackNegative) + mirrorNeg;
    
    // The pose snippet from DB (sanitized to remove legacy zari words that distort non-zari fabrics)
    const posePrompt = (dbPose?.promptSnippet || '')
      .replace(/heavy zari pallu/gi, 'authentic pallu')
      .replace(/zari border/gi, 'saree border')
      .replace(/zari motifs/gi, 'saree motifs');
    
    // Combine into final prompt
    const fluxPrompt = `${imageInstructions}\n\nUser Additions: ${cleanPrompt}\nPose Direction: ${posePrompt}\nBackground & Vibe: ${dynamicBackground}\nStyling & Persona Rules: ${dynamicStyling}\n\nCRITICAL REQUIREMENTS:\n- Generate an ultra-photorealistic fashion photograph, NOT an illustration, painting, or 3D render.\n- ${sysPrompt}\n- ${camSettings}${mirrorPhysicsRule}\n- ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS, NO MAGAZINE COVERS. The image must be clean of any typographic elements.\n- Extreme emphasis on ultra-realistic human anatomy, highly detailed natural skin texture with visible pores and micro-details, hyper-realistic eyes, and perfect natural fabric draping — reproduce the exact weave structure, surface texture, and color of the uploaded fabric references. Avoid any plastic, smooth, or CGI look. Keep the texture hyper-sharp, tactile, and highly defined with absolutely zero blur or softness.`;

    // 3. Build Kie.ai request body

    // Helper function to upload reference images to Kie.ai's native temporary storage (with R2 fallback)
    const uploadReferenceImageToKie = async (base64Data: string, apiKey: string): Promise<string> => {
      // 1. Primary: Kie.ai Native Temporary Stream Upload (auto-deleted after 3 days by Kie.ai)
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = base64Data.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';
        const buffer = Buffer.from(cleanBase64, 'base64');

        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeType }), `ref_${Date.now()}.${ext}`);
        formData.append('uploadPath', 'images/user-uploads');
        formData.append('fileName', `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`);

        const res = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (res.ok) {
          const resData = await res.json();
          const downloadUrl = resData?.data?.downloadUrl || resData?.downloadUrl;
          if (downloadUrl) {
            return downloadUrl;
          }
        }
        console.warn(`[Kie.ai] Native stream upload returned status ${res.status}, falling back to R2...`);
      } catch (nativeErr: any) {
        console.warn(`[Kie.ai] Native stream upload failed:`, nativeErr?.message);
      }

      // 2. Fallback: Cloudflare R2 Temporary Storage
      if (isStorageConfigured()) {
        try {
          const uploaded = await uploadToStorage(base64Data, {
            folder: 'temp-reference-inputs',
            publicId: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          });
          if (uploaded.url) {
            return uploaded.url;
          }
        } catch (r2Err: any) {
          console.warn('[Storage] R2 fallback upload failed:', r2Err?.message);
        }
      }

      // 3. Fallback: ImgBB (only if IMGBB_API_KEY configured and previous methods failed)
      const imgbbKey = process.env.IMGBB_API_KEY;
      if (imgbbKey) {
        try {
          const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
          const params = new URLSearchParams();
          params.append('image', cleanBase64);
          params.append('expiration', '86400');
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params,
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.data?.url) return data.data.url;
          }
        } catch (imgbbErr: any) {
          console.warn('[ImgBB] Fallback failed:', imgbbErr?.message);
        }
      }

      throw new Error('Failed to upload reference image to temporary hosting (Kie.ai native upload failed).');
    };

    // Collect reference image URLs for Kie.ai: supports BOTH hosted HTTP URLs and base64 swatches
    let inputUrls: string[] = [];
    for (let i = 0; i < activeSlotsOrdered.length; i++) {
      const slot = activeSlotsOrdered[i];
      const rawUrl = slot.dataUrl;
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        inputUrls.push(rawUrl);
        console.log(`[Kie.ai] Added swatch ${slot.label} as direct HTTP URL: ${rawUrl.substring(0, 80)}`);
      } else {
        const resolved = resolveImageToDataUrl(rawUrl);
        if (resolved) {
          try {
            console.log(`[Kie.ai] Uploading swatch ${slot.label} to Kie.ai temporary hosting...`);
            const imgUrl = await uploadReferenceImageToKie(resolved, kieApiKeyBearer);
            inputUrls.push(imgUrl);
          } catch (err: any) {
            console.error(`[Kie.ai] Failed to upload swatch ${slot.label}:`, err);
          }
        }
      }
    }

    // Model face image
    if (modelFaceUrl) {
      if (modelFaceUrl.startsWith('http://') || modelFaceUrl.startsWith('https://')) {
        inputUrls.push(modelFaceUrl);
        console.log(`[Kie.ai] Added model face as direct HTTP URL`);
      } else {
        const resolvedModel = resolveImageToDataUrl(modelFaceUrl);
        if (resolvedModel) {
          try {
            const imgUrl = await uploadReferenceImageToKie(resolvedModel, kieApiKeyBearer);
            inputUrls.push(imgUrl);
          } catch (mErr: any) {
            console.warn('[Kie.ai] Failed to upload model face:', mErr?.message);
          }
        }
      }
    }
    console.log(`[Kie.ai] Total reference images prepared for generation: ${inputUrls.length}`);

    // Determine model — prefer image-to-image when we have input images, else text-to-image
    // But always respect the admin-chosen model if it is explicitly an image-to-image type
    let finalKieModel = kieModelId;
    if (inputUrls.length === 0 && kieModelId.includes('image-to-image')) {
      // Fallback to text model when no reference images provided
      finalKieModel = kieModelId.replace('image-to-image', 'text-to-image');
    }

    let actualModelStr = finalKieModel;
    const isNanoBanana = finalKieModel.toLowerCase().includes('nano-banana');
    const isSeedream = finalKieModel.toLowerCase().includes('seedream');
    const isFlux = finalKieModel.toLowerCase().includes('flux');
    if (isNanoBanana) {
      actualModelStr = 'nano-banana-2-1';
    }

    // Saree Refactored Prompt Builder Branch (isSaree defined earlier)

    let activePrompt = fluxPrompt;
    let activeInputUrls = inputUrls;
    let activeNegativePrompt = negPrompt;

    if (isSaree) {
      // 1. Resolve Model Persona Anchor (with multi-tier fallback for Consistent Models)
      let modelAnchor = 'a radiant Indian female fashion model with natural skin texture, serene facial expression, and elegant posture';
      let effectiveModelFaceUrl = modelFaceUrl;

      if (selectedModelId) {
        try {
          const dbModel = await prisma.aIModel.findUnique({ where: { id: selectedModelId } });
          if (dbModel?.promptAnchor) {
            modelAnchor = dbModel.promptAnchor;
            if (!effectiveModelFaceUrl && dbModel.imageUrl) {
              effectiveModelFaceUrl = dbModel.imageUrl;
            }
          }
        } catch (mErr) {
          console.warn('[Generate Route] Could not fetch dbModel promptAnchor:', mErr);
        }

        // Fallback 1: Match by CONSISTENT_MODELS (Priyanka, Anjali, Sana, Navya)
        if (modelAnchor.includes('a radiant Indian female fashion model')) {
          const cModel = CONSISTENT_MODELS.find(
            m => m.id.toLowerCase() === selectedModelId.toLowerCase() || m.name.toLowerCase() === selectedModelId.toLowerCase()
          );
          if (cModel?.promptAnchor) {
            modelAnchor = cModel.promptAnchor;
            if (!effectiveModelFaceUrl && cModel.avatarUrl) {
              effectiveModelFaceUrl = cModel.avatarUrl;
            }
          }
        }

        // Fallback 2: Case-insensitive name match in database
        if (modelAnchor.includes('a radiant Indian female fashion model')) {
          try {
            const byName = await prisma.aIModel.findFirst({
              where: { name: { equals: selectedModelId, mode: 'insensitive' } }
            });
            if (byName?.promptAnchor) {
              modelAnchor = byName.promptAnchor;
              if (!effectiveModelFaceUrl && byName.imageUrl) {
                effectiveModelFaceUrl = byName.imageUrl;
              }
            }
          } catch (e) {}
        }
      }

      // 2. Pose & Optical Mirror Physics (verbatim with anti-mismatch protection)
      let sanitizedPoseSnippet = incomingPoseSnippet || dbPose?.promptSnippet || '';
      if (!sanitizedPoseSnippet && cleanPrompt) {
        const poseMatch = cleanPrompt.match(/Pose\s*&\s*Angle:\s*([^—\n]+)\s*—\s*([^.\n]+(?:\.[^.\n]+)*)/i);
        if (poseMatch && poseMatch[2]) {
          sanitizedPoseSnippet = poseMatch[2].trim();
        }
      }

      let effectivePosePreviewUrl = posePreviewUrl;
      let effectiveSendPosePreview = Boolean(sendPosePreview);

      if (isMirror) {
        if (!effectivePosePreviewUrl) {
          effectivePosePreviewUrl = '/poses/saree_pose_mirror.jpg';
        }
        effectiveSendPosePreview = true;
      } else if (!sanitizedPoseSnippet) {
        sanitizedPoseSnippet = 'Full-length front standing portrait at eye-level, poised and dignified posture.';
      }

      sanitizedPoseSnippet = sanitizedPoseSnippet
        .replace(/heavy zari pallu/gi, 'authentic pallu')
        .replace(/zari border/gi, 'saree border')
        .replace(/zari motifs/gi, 'saree motifs');

      const sareePromptResult = buildSareePrompt({
        sareeLayoutMode: sareeDesignType,
        borderSelection: borderStyle,
        uploadedImages: uploadedImages && typeof uploadedImages === 'object' ? uploadedImages : {},
        modelFaceUrl: effectiveModelFaceUrl,
        posePreviewUrl: effectiveSendPosePreview ? effectivePosePreviewUrl : null,
        modelAnchor,
        poseSnippet: sanitizedPoseSnippet,
        backgroundSetting: isMirror ? dynamicBackground : (dynamicBackground ? dynamicBackground.replace(/mirror\s*(or|\/)?/gi, '').trim() : 'Courtyard with warm natural light'),
        lightingCameraSetting: camSettings,
        mirrorPhysicsRule: isMirror ? mirrorPhysicsRule : '',
        promptSuggestions: typeof promptSuggestions === 'string' ? promptSuggestions : undefined,
        swatchAnalysis: body.swatchAnalysis || undefined,
      });

      // 3. Upload ordered images strictly in the manifest order (Image 1, Image 2, Image 3...)
      const sareeInputUrls: string[] = [];
      for (const item of sareePromptResult.manifest) {
        if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
          sareeInputUrls.push(item.url);
        } else {
          const resolved = resolveImageToDataUrl(item.url);
          if (resolved) {
            try {
              const uploadedUrl = await uploadReferenceImageToKie(resolved, kieApiKeyBearer);
              sareeInputUrls.push(uploadedUrl);
            } catch (uErr: any) {
              console.warn(`[Generate Route] Failed to upload reference ${item.slotId}:`, uErr?.message || uErr);
            }
          }
        }
      }

      activePrompt = sareePromptResult.finalPrompt;
      activeNegativePrompt = sareePromptResult.negativeExclusions || negPrompt;
      const negativePromptText = sareePromptResult.negativeExclusions ||
        'bad anatomy, distorted fabric patterns, unreferenced motifs, unreferenced patterns, unreferenced embroidery, uninvited chest artwork not in swatch, hemline border copied to chest, mismatched borders, oversized buttis, giant enlarged buttis, blur, watermark.';
      if (isNanoBanana || isSeedream) {
        activePrompt += `\n\nNEGATIVE EXCLUSIONS (STRICTLY FORBIDDEN): ${negativePromptText}`;
      }
      activeInputUrls = sareeInputUrls;

      // 4. Log the final prompt text and the ordered image list for every generation
      console.log('======================================================================');
      console.log(`[app/api/generate/route.ts] FINAL PROMPT SENT TO MODEL (${activePrompt.length} chars):`);
      console.log('======================================================================');
      console.log(activePrompt);
      console.log('======================================================================');
      console.log(`[app/api/generate/route.ts] ORDERED IMAGE LIST (${sareePromptResult.manifest.length} images):`);
      sareePromptResult.manifest.forEach((item, idx) => {
        console.log(`Image ${item.imageNumber}: [${item.slotId}] ${item.role} -> ${activeInputUrls[idx]?.substring(0, 60) || item.url.substring(0, 60)}...`);
      });
      console.log('======================================================================');
    } else {
      console.log(`[app/api/generate/route.ts] Standard non-saree pipeline active`);
    }

    const kieRequestBody = buildKieTaskPayload({
      modelId: actualModelStr,
      prompt: activePrompt,
      negativePrompt: activeNegativePrompt,
      imageUrls: activeInputUrls,
      aspectRatio: aspectRatio || '3:4',
      resolution: body.resolution || '2K',
    });

    const endpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
    console.log(`[Kie.ai] Model: ${finalKieModel} | input_urls: ${inputUrls.length}`);
    console.log(`[Kie.ai] Submitting task to ${endpoint}...`);

    let submitRes: Response | null = null;
    let submitText = '';
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        submitRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${kieApiKeyBearer}`,
          },
          body: JSON.stringify(kieRequestBody),
        });

        submitText = await submitRes.text();
        console.log(`[Kie.ai] Submit attempt ${attempt} status: ${submitRes.status}`);

        if (submitRes.ok) break;

        const isBusy = submitRes.status === 429 || submitRes.status === 503 || submitRes.status === 502 || submitText.toLowerCase().includes('busy');
        if (isBusy && attempt < maxRetries) {
          console.warn(`[Kie.ai] Server busy on attempt ${attempt}. Retrying in ${attempt * 2000}ms...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        break;
      } catch (netErr: any) {
        console.warn(`[Kie.ai] Network error on attempt ${attempt}:`, netErr?.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        throw netErr;
      }
    }

    if (!submitRes || !submitRes.ok) {
      return NextResponse.json(
        { error: `Kie.ai Submit Error (${submitRes?.status || 500}): ${submitText}` },
        { status: submitRes?.status || 500 }
      );
    }

    let submitData: any = {};
    try {
      submitData = JSON.parse(submitText);
    } catch {
      return NextResponse.json(
        { error: `Kie.ai returned non-JSON response: ${submitText}` },
        { status: 500 }
      );
    }

    const taskId = submitData?.data?.taskId || submitData?.data?.id || submitData?.data?.task_id || submitData?.task_id || submitData?.id || submitData?.taskId;
    if (!taskId) {
      return NextResponse.json(
        { error: `No task ID found in Kie.ai response: ${submitText}` },
        { status: 500 }
      );
    }

    console.log(`[Kie.ai] Task ID: ${taskId}. Polling for completion...`);

    // Poll task status (up to 80 attempts x 3s = ~240s / 4 minutes) to catch models and avoid Vercel timeouts
    for (let attempt = 1; attempt <= 80; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const checkRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${kieApiKeyBearer}`,
        },
      });

      const checkText = await checkRes.text();
      console.log(`[Kie.ai] Poll #${attempt} status: ${checkRes.status}`, checkText.slice(0, 200));

      if (!checkRes.ok) {
        return NextResponse.json(
          { error: `Kie.ai Poll Error (${checkRes.status}): ${checkText}`, taskId },
          { status: checkRes.status }
        );
      }

      let checkData: any = {};
      try {
        checkData = JSON.parse(checkText);
      } catch {
        continue;
      }

      const status = checkData?.data?.state || checkData?.state || checkData?.data?.status || checkData?.status;

      if (status === 'fail' || status === 'failed' || status === 'error') {
        return NextResponse.json(
          { error: `Kie.ai generation failed: ${checkData?.data?.error || checkData?.msg || 'Unknown error'}` },
          { status: 500 }
        );
      }

      if (status === 'completed' || status === 'success') {
        const output = checkData?.data?.result || checkData?.data?.output || checkData?.result || checkData?.output || checkData?.data?.url || checkData?.data?.images || checkData?.data;
        const firstData = Array.isArray(output)
          ? output[0]
          : output?.data?.[0] || output?.[0] || output;

        let finalImageUrl = '';

        // Direct Kie.ai response resultUrls extraction
        if (checkData?.data?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.response.resultUrls[0];
        } else if (checkData?.response?.resultUrls?.[0]) {
          finalImageUrl = checkData.response.resultUrls[0];
        } else if (checkData?.data?.resultUrls?.[0]) {
          finalImageUrl = checkData.data.resultUrls[0];
        } else if (typeof checkData?.data?.resultJson === 'string') {
          try {
            const parsedRj = JSON.parse(checkData.data.resultJson);
            if (parsedRj?.resultUrls?.[0]) {
              finalImageUrl = parsedRj.resultUrls[0];
            }
          } catch { }
        }

        if (!finalImageUrl) {
          if (output?.image_url) {
            finalImageUrl = output.image_url;
          } else if (output?.image_base64) {
            finalImageUrl = output.image_base64.startsWith('data:')
              ? output.image_base64
              : `data:image/png;base64,${output.image_base64}`;
          } else if (firstData?.b64_json) {
            finalImageUrl = `data:image/png;base64,${firstData.b64_json}`;
          } else if (firstData?.url) {
            finalImageUrl = firstData.url;
          } else if (typeof firstData === 'string' && (firstData.startsWith('http') || firstData.startsWith('data:image'))) {
            finalImageUrl = firstData;
          } else if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:image'))) {
            finalImageUrl = output;
          } else if (output?.image_urls?.[0]) {
            finalImageUrl = typeof output.image_urls[0] === 'string' ? output.image_urls[0] : output.image_urls[0].url;
          } else if (output?.images?.[0]) {
            finalImageUrl = typeof output.images[0] === 'string' ? output.images[0] : output.images[0].url;
          }
        }

        if (!finalImageUrl) {
          // Aggressive fallback: search entire data object for an image URL, avoiding input URLs
          const dataStr = JSON.stringify(checkData.data || checkData);
          const matches = dataStr.matchAll(/"(https?:\/\/[^"]+)"/g);
          for (const match of matches) {
            const url = match[1];
            if (url && !url.includes('ibb.co') && !url.includes('imgbb.com')) {
              finalImageUrl = url;
              break;
            }
          }
        }

        if (finalImageUrl) {
          // Strictly strip any trailing backslashes, escape chars, or whitespace
          finalImageUrl = finalImageUrl.trim().replace(/[\\'";,\s]+$/, '');
        }

        if (finalImageUrl) {
          console.log(`[Kie.ai] Photoshoot generation completed successfully! Task ID: ${taskId}`);
          console.log(`✅ [Kie.ai] Final Extracted Image URL:`, finalImageUrl);

          // Upscaling removed as per user request

          // Upload to Cloudflare R2 for permanent storage with retries
          let permanentUrl = finalImageUrl;
          const isKieTemp = finalImageUrl.includes('tempfile') || finalImageUrl.includes('aiquickdraw') || finalImageUrl.includes('kie.ai');

          if (isStorageConfigured()) {
            let uploadSuccess = false;
            for (let rAttempt = 1; rAttempt <= 3; rAttempt++) {
              try {
                const uId = userId || 'customer';
                const oId = orderId || 'order';
                const pId = poseId || taskId;
                console.log(`[Storage] Uploading generated asset to R2 (attempt ${rAttempt}/3)...`);
                permanentUrl = await uploadGeneratedAsset(finalImageUrl, uId, oId, pId, { productName, stockCode });
                uploadSuccess = true;
                console.log(`[Storage] ✅ Generated asset permanently stored in R2: ${permanentUrl}`);
                break;
              } catch (cloudErr: any) {
                console.warn(`[Storage] R2 upload attempt ${rAttempt}/3 failed:`, cloudErr?.message || cloudErr);
                if (rAttempt < 3) {
                  await new Promise(r => setTimeout(r, rAttempt * 1500));
                }
              }
            }

            if (!uploadSuccess && isKieTemp) {
              console.error('[Storage Critical] Failed to upload generated asset to Cloudflare R2!');
              return NextResponse.json({
                error: 'AI image generated, but failed to save permanently to Cloudflare R2 storage. Please retry.',
                temporaryUrl: finalImageUrl,
                taskId,
              }, { status: 500 });
            }
          }

          // Auto-save to DB
          await saveGeneratedOrder({
            userId,
            templateId,
            orderId,
            poseId,
            permanentUrl,
            prompt: isSaree ? activePrompt : cleanPrompt,
            finalPrompt: activePrompt,
            orderedImageList: activeInputUrls,
            generatorVersion: isSaree ? 'v2-saree' : 'v1',
            productName,
            stockCode,
            description,
            uploadedImages,
            selectedModelId,
            selectedOptions,
            productId: productId || null,
          });

          return NextResponse.json({
            imageUrl: permanentUrl,
            provider: 'kie-ai',
            taskId,
            generatorVersion: isSaree ? 'v2-saree' : 'v1',
            finalPrompt: activePrompt,
            orderedImageList: activeInputUrls,
          });
        } else {
          const errMsg = `Kie.ai completed but no image data was found in output: ${JSON.stringify(checkData.data || output)}`;
          console.error('[Kie.ai Error]', errMsg);
          return NextResponse.json(
            { error: errMsg, taskId },
            { status: 500 }
          );
        }
      }

      if (status === 'failed' || status === 'error') {
        const rawErr = checkData?.data?.error;
        const errBody = checkData?.data?.output?.error_body?.error;

        let failReason =
          errBody?.message ||
          rawErr?.raw_message ||
          rawErr?.message ||
          rawErr?.detail ||
          checkData?.data?.message ||
          'Unknown error during Gemini processing';

        const isQuotaOrChannelErr =
          errBody?.code === 'insufficient_user_quota' ||
          failReason.includes('用户额度不足') ||
          failReason.includes('insufficient_user_quota') ||
          failReason.includes('No available channel') ||
          failReason.includes('distributor') ||
          failReason.includes('403');

        if (isQuotaOrChannelErr) {
          return NextResponse.json(
            {
              error:
                '⚠️ Kie.ai Credit Balance Exhausted: Your account credits have reached 0. Please top up your Kie.ai account.',
              needsCredits: true,
              taskId,
            },
            { status: 402 }
          );
        }

        console.error(`[Kie.ai] Task failed with error: ${failReason}`);
        return NextResponse.json({ error: `AI Generation Error: ${failReason}`, taskId }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        error: 'Task is processing in the background on Kie.ai. Recovering image...',
        taskId,
        provider: 'kie-ai',
        isProcessing: true,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error('[API /generate] Internal Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

// Helper: Auto-save order and generated image to Postgres
async function saveGeneratedOrder(params: {
  userId: string;
  templateId?: string;
  orderId?: string;
  poseId?: string;
  permanentUrl: string;
  prompt: string;
  finalPrompt?: string;
  orderedImageList?: string[];
  generatorVersion?: string;
  productName?: string;
  stockCode?: string;
  description?: string;
  uploadedImages?: any;
  selectedModelId?: string;
  selectedOptions?: any;
  productId?: string | null;
}) {
  const {
    userId,
    templateId,
    orderId,
    poseId,
    permanentUrl,
    prompt,
    finalPrompt,
    orderedImageList,
    generatorVersion,
    productName,
    stockCode,
    description,
    uploadedImages,
    selectedModelId,
    selectedOptions,
    productId,
  } = params;

  if (userId && userId !== 'anonymous_user' && templateId) {
    try {
      const activeOrderId = orderId || `order_${Date.now()}`;
      const existingOrder = await prisma.customerOrder.findUnique({
        where: { id: activeOrderId },
      });

      const existingGenImages = (existingOrder?.generatedImages as any) || {};
      const currentPoseKey = poseId || `pose_${Date.now()}`;
      const updatedGenImages = {
        ...existingGenImages,
        [currentPoseKey]: {
          imageUrl: permanentUrl,
          prompt,
          finalPrompt: finalPrompt || prompt,
          orderedImageList: orderedImageList || [],
          generatorVersion: generatorVersion || 'v1',
          generatedAt: new Date().toISOString(),
        },
      };

      if (existingOrder) {
        await prisma.customerOrder.update({
          where: { id: activeOrderId },
          data: {
            generatedImages: updatedGenImages,
            uploadedImages: uploadedImages || existingOrder.uploadedImages,
            productName: productName || existingOrder.productName,
            status: 'completed',
          },
        });
        console.log(`[DB AutoSave] Updated CustomerOrder ${activeOrderId} with pose ${currentPoseKey}`);
        
        // Auto-link to Product inventory: strictly match by productId if provided, or stockCode if not
        const targetProduct = productId
          ? await prisma.product.findUnique({ where: { id: productId } })
          : (stockCode ? await prisma.product.findFirst({ where: { OR: [{ stockCode }, { code1: stockCode }] } }) : null);

        if (targetProduct) {
          const existingProductGen = (targetProduct.generatedImages as Record<string, any>) || {};
          const currentCount = Object.keys(existingProductGen).length;

          // Assign sequential order indices to newly generated images to guarantee order
          const orderedNewImages: Record<string, any> = {};
          let newIdx = 0;
          for (const [k, v] of Object.entries(updatedGenImages)) {
            if (!existingProductGen[k]) {
              orderedNewImages[k] = { ...(v as any), order: currentCount + newIdx };
              newIdx++;
            } else {
              orderedNewImages[k] = { ...(existingProductGen[k] as any), ...(v as any) };
            }
          }

          const mergedGen: Record<string, any> = {};
          const seenGenUrls = new Set<string>();
          for (const [k, v] of Object.entries(orderedNewImages)) {
            const u = (v as any)?.imageUrl ? String((v as any).imageUrl).trim() : null;
            if (u) seenGenUrls.add(u);
            mergedGen[k] = v;
          }
          for (const [k, v] of Object.entries(existingProductGen)) {
            const u = (v as any)?.imageUrl ? String((v as any).imageUrl).trim() : null;
            if (u && !seenGenUrls.has(u)) {
              seenGenUrls.add(u);
              mergedGen[k] = v;
            } else if (!u && !mergedGen[k]) {
              mergedGen[k] = v;
            }
          }

          const sortedList = Object.entries(mergedGen)
            .sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0))
            .map(([, img]: any) => img);
          const firstImage = sortedList[0];

          // Auto-cover logic: keep current cover ONLY if it is a valid non-tempfile URL already in catalogue
          const currentCover = targetProduct.coverImageUrl;
          const hasValidCoverInCatalogue = currentCover &&
            !currentCover.includes('tempfile') &&
            Object.values(existingProductGen).some((img: any) => img.imageUrl === currentCover);

          const finalCover = hasValidCoverInCatalogue ? currentCover : (firstImage?.imageUrl || currentCover);

          await prisma.product.update({
            where: { id: targetProduct.id },
            data: {
              generatedImages: mergedGen as any,
              linkedOrderId: activeOrderId,
              coverImageUrl: finalCover,
            },
          });
          console.log(`[DB AutoSave] Synced CustomerOrder ${activeOrderId} to Product ${targetProduct.id}`);
        }
      } else {
        await prisma.customerOrder.create({
          data: {
            id: activeOrderId,
            userId,
            templateId,
            productName: productName || 'Garment Photoshoot',
            stockCode: stockCode || null,
            description: description || null,
            uploadedImages: uploadedImages || null,
            selectedModelId: selectedModelId || null,
            selectedOptions: selectedOptions || null,
            generatedImages: updatedGenImages,
            status: 'completed',
          },
        });
        console.log(`[DB AutoSave] Created CustomerOrder ${activeOrderId} with pose ${currentPoseKey}`);
        
        // Auto-link to Product inventory: strictly match by productId if provided, or stockCode if not
        const targetProduct = productId
          ? await prisma.product.findUnique({ where: { id: productId } })
          : (stockCode ? await prisma.product.findFirst({ where: { OR: [{ stockCode }, { code1: stockCode }] } }) : null);

        if (targetProduct) {
          const existingProductGen = (targetProduct.generatedImages as Record<string, any>) || {};
          const currentCount = Object.keys(existingProductGen).length;

          const orderedNewImages: Record<string, any> = {};
          let newIdx = 0;
          for (const [k, v] of Object.entries(updatedGenImages)) {
            if (!existingProductGen[k]) {
              orderedNewImages[k] = { ...(v as any), order: currentCount + newIdx };
              newIdx++;
            } else {
              orderedNewImages[k] = { ...(existingProductGen[k] as any), ...(v as any) };
            }
          }

          const mergedGen: Record<string, any> = {};
          const seenGenUrls = new Set<string>();
          for (const [k, v] of Object.entries(orderedNewImages)) {
            const u = (v as any)?.imageUrl ? String((v as any).imageUrl).trim() : null;
            if (u) seenGenUrls.add(u);
            mergedGen[k] = v;
          }
          for (const [k, v] of Object.entries(existingProductGen)) {
            const u = (v as any)?.imageUrl ? String((v as any).imageUrl).trim() : null;
            if (u && !seenGenUrls.has(u)) {
              seenGenUrls.add(u);
              mergedGen[k] = v;
            } else if (!u && !mergedGen[k]) {
              mergedGen[k] = v;
            }
          }

          const sortedList = Object.entries(mergedGen)
            .sort(([, a]: any, [, b]: any) => (a.order ?? 0) - (b.order ?? 0))
            .map(([, img]: any) => img);
          const firstImage = sortedList[0];

          const currentCover = targetProduct.coverImageUrl;
          const hasValidCoverInCatalogue = currentCover &&
            !currentCover.includes('tempfile') &&
            Object.values(existingProductGen).some((img: any) => img.imageUrl === currentCover);

          const finalCover = hasValidCoverInCatalogue ? currentCover : (firstImage?.imageUrl || currentCover);

          await prisma.product.update({
            where: { id: targetProduct.id },
            data: {
              generatedImages: mergedGen as any,
              linkedOrderId: activeOrderId,
              coverImageUrl: finalCover,
            },
          });
          console.log(`[DB AutoSave] Synced CustomerOrder ${activeOrderId} to Product ${targetProduct.id}`);
        }
      }
    } catch (dbErr) {
      console.error('[DB AutoSave Error]:', dbErr);
    }
  }
}
