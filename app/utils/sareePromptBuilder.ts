export interface SareePromptSlotInput {
  body?: string | null;
  pallu?: string | null;
  upper_border?: string | null;
  chest_border?: string | null;
  macro_motif?: string | null;
  motif?: string | null;
  pleat_art?: string | null;
  border_ribbon?: string | null;
  ribbon?: string | null;
  blouse?: string | null;
  [key: string]: string | null | undefined;
}

export interface BuildSareePromptInput {
  sareeLayoutMode?: string; // '' | 'default' | 'delicate_buttis' | 'dual_tier_pleats' | 'complex'
  borderSelection?: string; // '' | 'symmetric' | 'different_borders' | 'dual_contrasting_borders' | 'lower_border_only'
  uploadedImages?: SareePromptSlotInput;
  swatchAnalysis?: any;
  modelFaceUrl?: string | null;
  posePreviewUrl?: string | null;
  modelAnchor?: string;
  poseSnippet?: string;
  backgroundSetting?: string;
  lightingCameraSetting?: string;
  mirrorPhysicsRule?: string;
  promptSuggestions?: string;
}

export interface OrderedSareeImage {
  slotId: string;
  imageNumber: number;
  role: string;
  placement: string;
  manifestLine: string;
  url: string;
}

export interface BuildSareePromptResult {
  manifest: OrderedSareeImage[];
  manifestText: string;
  fidelityRule: string;
  borderBlockText: string;
  absentSlotLines: string[];
  finalPrompt: string;
  effectiveBorderMode: 'symmetric' | 'different' | 'lower_border_only' | 'lower_border_borderless';
  negativeExclusions: string;
}

/**
 * Builds the structured prompt and ordered image list for Kie.ai Nano-Banana 2.1 and Seedream 5 Pro.
 * Strict rules:
 * 1. Numbering has ZERO gaps (1, 2, 3...).
 * 2. Exactly ONE border block is selected.
 * 3. NO HARDCODED MOTIF NAMES (no 'dotted diamond', 'rhombus', 'wheat', 'kalpavriksha').
 *    Dynamically uses Gemini Vision analysis (detected_buttis) or visual reference.
 * 4. Lower Border Only mode: Bottom hem & pallu have authentic wide border; chest drape has top border ribbon (or borderless) with delicate buttis continuing seamlessly to the edge without empty space.
 * 5. Positive phrasing to prevent negative token attractors.
 */
export function buildSareePrompt(input: BuildSareePromptInput): BuildSareePromptResult {
  const layout = (input.sareeLayoutMode || '').toLowerCase();
  const isComplex = layout === 'dual_tier_pleats' || layout.startsWith('complex');
  const isDelicate = layout === 'delicate_buttis' || layout.includes('delicate') || layout.includes('butti');

  // Extract comprehensive pattern architecture from swatch analysis
  const rawPType = String(
    input.swatchAnalysis?.pattern_type ||
    input.swatchAnalysis?.vision?.pattern_type ||
    input.swatchAnalysis?.spatial_density?.type ||
    input.swatchAnalysis?.vision?.spatial_density?.type ||
    ''
  ).toLowerCase();

  const isContinuousJaal =
    rawPType.includes('jaal') ||
    rawPType.includes('lattice') ||
    rawPType.includes('allover') ||
    rawPType.includes('all_over') ||
    rawPType.includes('grid') ||
    input.swatchAnalysis?.spatial_density?.is_continuous_grid === true ||
    input.swatchAnalysis?.vision?.spatial_density?.is_continuous_grid === true;

  const isStripesOrLeheriya =
    rawPType.includes('stripe') ||
    rawPType.includes('leheriya') ||
    rawPType.includes('chevron') ||
    rawPType.includes('wave');

  const isChecksOrKattam =
    rawPType.includes('check') ||
    rawPType.includes('kattam') ||
    rawPType.includes('doria');

  const isBandhani =
    rawPType.includes('bandhani') ||
    rawPType.includes('bandhej') ||
    rawPType.includes('dot');

  const isMediumRepeat =
    rawPType.includes('medium') ||
    rawPType.includes('boota') ||
    rawPType.includes('block_print');

  const isTraditionalNarrative =
    rawPType.includes('narrative') ||
    rawPType.includes('figurative') ||
    rawPType.includes('folk') ||
    rawPType.includes('warli') ||
    rawPType.includes('kalamkari') ||
    rawPType.includes('madhubani');

  const isFloralVines =
    rawPType.includes('vine') ||
    rawPType.includes('bel') ||
    rawPType.includes('creeper');

  const isPlainOrBorderOnly =
    rawPType.includes('plain') ||
    rawPType.includes('border_and_plain') ||
    rawPType.includes('solid');

  const isDenseJaal = isContinuousJaal;

  const isSparseButtis =
    !isContinuousJaal &&
    !isStripesOrLeheriya &&
    !isChecksOrKattam &&
    !isBandhani &&
    !isMediumRepeat &&
    !isTraditionalNarrative &&
    !isFloralVines &&
    !isPlainOrBorderOnly;

  const craftTechnique =
    input.swatchAnalysis?.craft_technique ||
    input.swatchAnalysis?.vision?.craft_technique ||
    input.swatchAnalysis?.craft ||
    'Indian handloom textile';

  const aiPromptDirective =
    input.swatchAnalysis?.promptDirective ||
    input.swatchAnalysis?.vision?.promptDirective ||
    input.swatchAnalysis?.ai_prompt_directive ||
    '';

  const isMirrorPose =
    (input.poseSnippet || '').toLowerCase().includes('mirror') ||
    (input.mirrorPhysicsRule && input.mirrorPhysicsRule.toLowerCase().includes('mirror')) ||
    (input.posePreviewUrl && input.posePreviewUrl.toLowerCase().includes('mirror'));

  // Resolve Effective Border Mode (Complex Saree defaults to 'different')
  const border = (input.borderSelection || '').toLowerCase();
  let effectiveBorderMode: 'symmetric' | 'different' | 'lower_border_only' | 'lower_border_borderless' = 'symmetric';

  if (border === 'lower_border_borderless' || border.includes('borderless')) {
    effectiveBorderMode = 'lower_border_borderless';
  } else if (border === 'lower_border_only' || border.includes('lower_only') || layout.includes('lower_only')) {
    effectiveBorderMode = 'lower_border_only';
  } else if (
    border === 'different_borders' ||
    border === 'dual_contrasting_borders' ||
    border.includes('dual') ||
    border.includes('different') ||
    layout.includes('dual') ||
    (isComplex && border !== 'symmetric')
  ) {
    effectiveBorderMode = 'different';
  } else {
    effectiveBorderMode = 'symmetric';
  }

  const uploads = input.uploadedImages || {};

  // Helper to safely find slot data
  const findSlot = (keys: string[]): { key: string; url: string } | null => {
    for (const k of Object.keys(uploads)) {
      const lk = k.toLowerCase();
      if (keys.some(target => lk === target || lk.includes(target))) {
        const val = uploads[k];
        if (val && typeof val === 'string' && val.trim()) {
          return { key: k, url: val.trim() };
        }
      }
    }
    return null;
  };

  const bodyData = findSlot(['body', 'garment']);
  const palluData = findSlot(['pallu']);
  const chestBorderData = findSlot(['upper_border', 'chest_border', 'top_border']);
  const macroMotifData = findSlot(['macro_motif', 'motif', 'close_up', 'macro']);
  const pleatArtData = findSlot(['pleat_art', 'pleat', 'skirt_art']);
  const borderRibbonData = findSlot(['border_ribbon', 'ribbon']);
  const blouseData = findSlot(['blouse']);

  // Extract dynamic vision analysis data
  const rawButtis: any[] =
    input.swatchAnalysis?.detected_buttis ||
    input.swatchAnalysis?.vision?.detected_buttis ||
    input.swatchAnalysis?.body_motifs ||
    input.swatchAnalysis?.vision?.body_motifs ||
    input.swatchAnalysis?.distinctMotifs ||
    input.swatchAnalysis?.vision?.distinctMotifs ||
    input.swatchAnalysis?.motifs ||
    input.swatchAnalysis?.vision?.motifs ||
    [];

  const baseFabricColor =
    input.swatchAnalysis?.fabric_background?.base_color ||
    input.swatchAnalysis?.vision?.fabric_background?.base_color ||
    'authentic fabric ground';

  const fabricTexture =
    input.swatchAnalysis?.fabric_background?.texture_notes ||
    input.swatchAnalysis?.vision?.fabric_background?.texture_notes ||
    'natural woven fabric texture';

  // Build dynamic motif descriptions from Gemini Vision (NO hardcoded diamond/rhombus!)
  let dynamicMotifsDescription = '';
  if (rawButtis.length > 0) {
    const lines = rawButtis.map((b: any, idx: number) => {
      const shape = b.shape_type || b.name || `Motif #${idx + 1}`;
      let details = b.structure_details || b.anatomy || '';

      const pColors = Array.isArray(b.primary_colors) ? b.primary_colors.join(', ') : (b.primary_colors || '');
      const sColors = Array.isArray(b.secondary_colors) ? b.secondary_colors.join(', ') : (b.secondary_colors || '');
      const colorDesc = [pColors, sColors].filter(Boolean).join(' with accents of ');
      return `• ${shape}: ${details}${colorDesc ? ` [Colors: ${colorDesc}]` : ''}`;
    });
    dynamicMotifsDescription = lines.join('\n');
  }

  // Canonical Manifest Order:
  // 1. body + lower hem border
  // 2. pallu
  // 3. chest border (if present)
  // 4. micro-motif close-up (if present)
  // 5. lower skirt art / border ribbon (if present)
  // 6. blouse (if present)
  // 7. model face / pose
  const manifest: OrderedSareeImage[] = [];
  let currentNum = 1;

  if (bodyData) {
    const role = isComplex ? 'upper body and chest fabric' : 'saree body and lower hem border';
    let placement = 'The reference border at the bottom of this swatch runs along the lower skirt hemline at floor level. The repeating motifs across the body fabric cover the skirt and pleats.';
    if (isMirrorPose) {
      placement =
        'Covers the upper torso drape, chest wrap, and shoulder pleats reflected in the mirror. ' +
        'The repeating motifs must replicate the reference fabric. The lower hemline at floor level is outside the medium-shot framing.';
    } else if (isComplex) {
      placement = 'Covers the chest wrap, bust drape, waist, and upper skirt.';
    } else if (effectiveBorderMode === 'lower_border_only' || effectiveBorderMode === 'lower_border_borderless') {
      const isBorderless = effectiveBorderMode === 'lower_border_borderless';
      const edgeDesc = isBorderless
        ? 'is completely borderless self-fabric: pure body fabric extending continuously to the clean folded neckline edge with zero blank margins.'
        : 'features a neat, narrow finished border ribbon (~0.5 cm to 1 cm solid woven piping / edge ribbon) along its top edge meeting the blouse neckline with zero blank margins.';

      let bodyPatternDesc = '';
      if (isContinuousJaal) {
        bodyPatternDesc = 'The continuous all-over interlocking jaal / lattice grid covers the entire chest wrap right into the top border area without empty spaces.';
      } else if (isStripesOrLeheriya) {
        bodyPatternDesc = 'The continuous diagonal leheriya waves / stripes flow naturally across the entire chest wrap.';
      } else if (isChecksOrKattam) {
        bodyPatternDesc = 'The structured checks / kattam grid covers the entire chest wrap seamlessly.';
      } else if (isBandhani) {
        bodyPatternDesc = 'The traditional tied bandhani dot clusters flow across the entire chest wrap.';
      } else if (isMediumRepeat) {
        bodyPatternDesc = 'The repeating motifs in their balanced moderate spacing cover the entire chest wrap.';
      } else if (isTraditionalNarrative) {
        bodyPatternDesc = 'The authentic folk / figurative motifs cover the chest wrap in their reference scale and layout.';
      } else if (isPlainOrBorderOnly) {
        bodyPatternDesc = 'The solid plain body fabric covers the entire chest wrap smoothly.';
      } else {
        bodyPatternDesc = 'Delicate repeating miniature buttis cover the entire chest wrap with wide, airy negative spacing (approx 10x to 15x spacing, 15-20 cm between motifs).';
      }

      placement =
        'The authentic reference border at the bottom of this swatch runs strictly along the lower skirt hemline at floor level (feet and pleats) AND along the outer vertical fall of the cascading pallu drape down to the bottom tassels. ' +
        `The diagonal chest drape across the torso, bust, and left shoulder ${edgeDesc} ${bodyPatternDesc}`;
    }
    manifest.push({
      slotId: 'body',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: bodyData.url,
    });
  }

  if (palluData) {
    const role = 'pallu (anchal)';
    let placement =
      'Anchored securely at the left shoulder and falling straight downward behind the left arm/shoulder in a clean, vertical fall to lower calf level, exactly matching the vertical orientation and angle shown in this reference swatch. ' +
      'The authentic reference border runs vertically along the outer hanging edge from the shoulder down to the bottom hem. ' +
      'The authentic tassels (pom-pom ties / latkans) hang strictly along the bottom horizontal end cross-hem at calf level. ' +
      'The pallu hangs straight down along the side/back and is NOT wrapped or bunched across the front torso.';
    if (effectiveBorderMode === 'lower_border_only' || effectiveBorderMode === 'lower_border_borderless') {
      placement +=
        ' The outer vertical edge of the cascading pallu drape displays the continuous authentic saree border from the reference, framing the pallu drape down to the tassels.';
    }
    manifest.push({
      slotId: 'pallu',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: palluData.url,
    });
  }

  if (chestBorderData) {
    const role = 'upper chest border (distinct top-edge border)';
    const placement =
      'Appears strictly and exclusively along the diagonal drape across the bust and chest wrap. ' +
      'Replicate the exact narrow width and design from this swatch.';
    manifest.push({
      slotId: 'upper_border',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: chestBorderData.url,
    });
  }

  if (macroMotifData) {
    const bodyImgNum = manifest.find(m => m.slotId === 'body')?.imageNumber || 1;
    const role = 'micro-motif close-up (stitch anatomy & detail reference only)';

    let patternDirectives = '';
    if (isContinuousJaal) {
      patternDirectives =
        `High-magnification close-up of the repeating motifs within the continuous jaal / lattice grid from Image ${bodyImgNum}. ` +
        `CRITICAL CONTINUOUS JAAL DIRECTIVE: Use this image to inspect the exact motif shapes, stitch anatomy, and lattice grid geometry. ` +
        `Replicate the continuous interlocking lattice grid across the entire body, waist pleats, and chest drape with adjacent touching cells and zero wide solid gaps. Motifs on chest and pleats must be identical in miniature grid scale.`;
    } else if (isStripesOrLeheriya) {
      patternDirectives =
        `Detail close-up of the flowing diagonal leheriya waves / stripes from Image ${bodyImgNum}. ` +
        `CRITICAL STRIPES DIRECTIVE: Replicate the continuous flowing diagonal waves across the saree body and chest drape following natural drape lines with zero blank margins.`;
    } else if (isChecksOrKattam) {
      patternDirectives =
        `Detail close-up of the structured checks / kattam grid from Image ${bodyImgNum}. ` +
        `CRITICAL CHECKS DIRECTIVE: Replicate the structured grid squares and internal motifs across the body, pleats, and chest drape with uniform square dimensions.`;
    } else if (isBandhani) {
      patternDirectives =
        `Detail close-up of the tied bandhani / bandhej micro-dots from Image ${bodyImgNum}. ` +
        `CRITICAL BANDHANI DIRECTIVE: Replicate the authentic tied ring-dot clusters across the body, pleats, and chest drape with high fidelity.`;
    } else if (isMediumRepeat) {
      patternDirectives =
        `Detail close-up of the repeating motifs from Image ${bodyImgNum}. ` +
        `CRITICAL MEDIUM REPEAT DIRECTIVE: Replicate motifs in their authentic balanced moderate spacing (~3-8 cm apart) uniformly across chest drape and skirt pleats.`;
    } else if (isTraditionalNarrative) {
      patternDirectives =
        `Detail close-up of the authentic folk / figurative art from Image ${bodyImgNum}. ` +
        `CRITICAL FOLK ART DIRECTIVE: Replicate the hand-drawn / embroidered figurines (dancers, animals, trees) with 1:1 fidelity across the body in their authentic layout.`;
    } else {
      patternDirectives =
        `High-magnification close-up of the exact repeating buttis on the body fabric from Image ${bodyImgNum}. ` +
        `CRITICAL SCALE & SPACING DIRECTIVE: Use this image STRICTLY to inspect the exact motif shapes, fine internal structure, and surface texture of the repeating buttis. ` +
        `DO NOT use the enlarged zoom magnification of this image for motif scale on the garment! ` +
        `The physical size of all motifs across the entire saree (chest, bust, pleats, and skirt) must be ANCHORED STRICTLY to Image ${bodyImgNum} at identical miniature physical scale (approx 1.2 cm to 1.5 cm). ` +
        `Every single butti on the chest drape and shoulder must be exactly as small and delicate as the buttis on the lower skirt pleats. ` +
        `The buttis must be WIDELY SPACED with generous negative space of solid base fabric (approx 10x to 15x motif size, approx 15 cm to 20 cm between motifs in a staggered diagonal repeat), exactly matching the flat fabric reference photo. Do NOT crowd or densely pack the motifs.`;
    }

    const placement = patternDirectives +
      (effectiveBorderMode === 'lower_border_borderless'
        ? ` On the diagonal chest drape, the pattern covers the entire borderless chest wrap right to the clean folded neckline edge with zero blank margins.`
        : effectiveBorderMode === 'lower_border_only'
        ? ` On the diagonal chest drape, the pattern covers the entire chest wrap right into the top border area up to the narrow border ribbon with zero blank margins.`
        : ` On the diagonal chest drape, the pattern covers the entire body fabric up to the border with zero blank margins.`);
    manifest.push({
      slotId: 'macro_motif',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: macroMotifData.url,
    });
  }

  if (pleatArtData) {
    const role = 'lower skirt and pleat art';
    const placement = 'Runs horizontally across the lower hem from floor up to lower shin only.';
    manifest.push({
      slotId: 'pleat_art',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: pleatArtData.url,
    });
  }

  if (borderRibbonData) {
    const role = 'longitudinal edge border ribbon';
    const placement = 'Runs along the outer lengthwise edges.';
    manifest.push({
      slotId: 'border_ribbon',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: borderRibbonData.url,
    });
  }

  if (blouseData) {
    const role = 'blouse fabric';
    const placement = 'Tailored fitted blouse matching this fabric.';
    manifest.push({
      slotId: 'blouse',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: blouseData.url,
    });
  }

  if (input.modelFaceUrl && input.modelFaceUrl.trim()) {
    const role = 'model face (facial identity reference)';
    const placement = 'Sole authoritative visual reference for facial features, eyes, nose, lips, jawline, and natural skin tone. Replicate this exact face on the model with 1:1 facial identity fidelity.';
    manifest.push({
      slotId: 'model_face',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: input.modelFaceUrl.trim(),
    });
  }

  if (input.posePreviewUrl && input.posePreviewUrl.trim()) {
    const isMirror = isMirrorPose || input.posePreviewUrl.toLowerCase().includes('mirror');
    const role = isMirror ? 'pose & composition reference (camera angle & mirror framing only)' : 'pose reference (for body posture only)';
    const placement = isMirror
      ? 'MANDATORY COMPOSITION GUIDE: Replicate this over-the-shoulder camera angle and dressing mirror reflection framing. Drape the reference saree fabrics on the model.'
      : 'Use for body posture only.';
    manifest.push({
      slotId: 'pose_preview',
      imageNumber: currentNum++,
      role,
      placement,
      manifestLine: `Image ${currentNum - 1} = ${role}. ${placement}`,
      url: input.posePreviewUrl.trim(),
    });
  }

  const manifestText = manifest.map(m => m.manifestLine).join('\n');

  // Authoritative Visual Reference
  const macroMotifEntry = manifest.find(m => m.slotId === 'macro_motif');
  const chestImg = manifest.find(m => m.slotId === 'upper_border') || manifest.find(m => m.slotId === 'border_ribbon');
  const hemImg = manifest.find(m => m.slotId === 'pleat_art') || manifest.find(m => m.slotId === 'body');
  const hemNum = hemImg ? hemImg.imageNumber : 1;
  const chestNum = chestImg ? chestImg.imageNumber : 3;
  const motifSourceNum = macroMotifEntry ? macroMotifEntry.imageNumber : 1;
  const faceImg = manifest.find(m => m.slotId === 'model_face');
  const faceNum = faceImg ? faceImg.imageNumber : null;

  // Build Dynamic Fidelity Rule (No hardcoded diamond/rhombus/foliage)
  let motifSection = '';
  if (dynamicMotifsDescription) {
    if (isContinuousJaal) {
      motifSection =
        `AUTHENTIC DETECTED MOTIFS & ALL-OVER JAAL STRUCTURE (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Motifs & Grid from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & ALL-OVER JAAL STRUCTURE (EXACT REFERENCE SPECIFICATION):\n` +
        `- The fabric features an authentic continuous all-over interlocking diamond jaal / lattice grid across the entire body, housing framed repeating motifs inside adjacent touching cells matching the reference swatch.\n` +
        `- CONTINUOUS ALL-OVER GRID: Motifs sit within repeating adjacent cells of the jaal with NO wide blank or solid background gaps. Replicate the authentic continuous density directly from the reference image.\n` +
        `- MOTIF FIDELITY DIRECTIVE: Replicate strictly the authentic motifs and lattice structure from the reference swatch. Under NO circumstances should the AI generate unreferenced patterns or foreign embellishments.\n` +
        `- STRICT UNIFORM SCALE (CHEST VS PLEATS 1:1 LOCK): The grid cells and motifs on the diagonal chest wrap, bust, and shoulder must be EXACTLY IDENTICAL in miniature physical size to the motifs on the lower skirt pleats.\n` +
        (effectiveBorderMode === 'lower_border_borderless'
          ? `- 100% BORDERLESS CHEST WRAP WITH JAAL TO THE FOLD: The diagonal chest wrap across the bust and left shoulder is completely borderless self-fabric. The continuous jaal pattern continues uninterrupted across the chest, bust, ribs, and collarbone right to the clean folded neckline edge with zero blank margins.`
          : effectiveBorderMode === 'lower_border_only'
          ? `- TOP BORDER RIBBON WITH JAAL FILLING ENTIRE CHEST: The diagonal chest drape has a neat, narrow finished border ribbon (~0.5 cm - 1 cm solid woven piping / edge ribbon) along its topmost folded edge meeting the blouse neckline. The continuous jaal pattern continues uninterrupted across the chest right into the top border area up to the border ribbon with zero blank margins.`
          : `- BORDER CONTINUITY: The authentic border runs cleanly along the chest drape.`);
    } else if (isStripesOrLeheriya) {
      motifSection =
        `AUTHENTIC DETECTED LEHERIYA WAVES / STRIPES (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Wave Elements from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & FLOWING DIAGONAL DRAPE:\n` +
        `- Continuous diagonal waves / stripes flow across the entire saree body, skirt pleats, and chest drape following natural drape tension.\n` +
        `- Maintain authentic wave rhythm, color alternating sequence, and line thickness from the reference swatch.\n` +
        `- Waves continue seamlessly across the chest drape right to the folded neckline edge with zero blank margins.`;
    } else if (isChecksOrKattam) {
      motifSection =
        `AUTHENTIC DETECTED CHECKS / KATTAM GRID (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Grid Elements from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & STRUCTURED CHECKS:\n` +
        `- Structured checks / grid squares cover the skirt, front waist pleats, and diagonal chest wrap.\n` +
        `- Internal motifs sit cleanly inside repeating check squares with uniform square dimensions.\n` +
        `- Checks continue uninterrupted across the chest wrap right to the folded neckline edge with zero blank margins.`;
    } else if (isBandhani) {
      motifSection =
        `AUTHENTIC DETECTED BANDHANI / BANDHEJ PATTERNS (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Bandhani Dot Clusters from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & TIED DOT CLUSTERS:\n` +
        `- Replicate authentic tied micro-dots in organic flowing clusters or diamond formations across the body, waist pleats, and chest wrap.\n` +
        `- Bandhani patterns flow continuously right to the folded neckline edge with zero blank margins.`;
    } else if (isMediumRepeat) {
      motifSection =
        `AUTHENTIC DETECTED MOTIFS - BALANCED MEDIUM REPEAT (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Motifs from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & MODERATE REPEAT SPACING:\n` +
        `- Motifs are arranged in an authentic regular repeat with moderate spacing (~3-8 cm apart) across the body, pleats, and chest drape.\n` +
        `- Maintain exact medium scale (~3-5 cm) uniformly across chest drape and skirt pleats without distortion.\n` +
        `- Motifs continue right to the folded neckline edge with zero blank margins.`;
    } else if (isTraditionalNarrative) {
      motifSection =
        `AUTHENTIC DETECTED FOLK / FIGURATIVE ART (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Figurative Motifs from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & NARRATIVE LAYOUT:\n` +
        `- Replicate authentic folk figurines (dancers, musicians, animals, trees) with 1:1 fidelity to their fine line work and embroidery.\n` +
        `- Distribute across body and chest drape preserving their authentic hand-crafted scale and layout.\n` +
        `- Motifs continue right to the folded neckline edge with zero blank margins.`;
    } else if (isPlainOrBorderOnly) {
      motifSection =
        `AUTHENTIC SOLID PLAIN SAREE BODY (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `SPATIAL ALIGNMENT & SOLID WEAVE:\n` +
        `- The body of the saree across skirt, front pleats, and chest drape is completely plain solid weave in ${baseFabricColor}.\n` +
        `- All decorative artwork, zari, and embroidery are strictly confined to the borders and pallu.`;
    } else {
      motifSection =
        `AUTHENTIC DETECTED MOTIFS (REPLICATE STRICTLY 1:1 DIRECTLY FROM REFERENCE):\n` +
        `Base ground: ${baseFabricColor} | Craft & weave: ${craftTechnique} (${fabricTexture}).\n` +
        `Detected Motifs from Swatch:\n${dynamicMotifsDescription}\n` +
        `SPATIAL ALIGNMENT & WIDE AIRY SPACING (EXACT REFERENCE SPECIFICATION):\n` +
        `- Motifs are arranged in an elegant, widely-spaced alternating staggered diagonal grid across the entire fabric, faithfully reproducing the detected motif shapes and colors from the reference swatch.\n` +
        `- WIDE AIRY NEGATIVE SPACING: Motifs are sparsely and delicately distributed with generous, wide negative spacing of approx 10x to 15x the motif size (approx 15 cm to 20 cm of clean solid base fabric between buttis). Under NO circumstances should buttis be densely packed, crowded, or clustered together. The spacing must remain airy, delicate, and sparse exactly as seen on the flat fabric reference image.\n` +
        `- MOTIF FIDELITY DIRECTIVE: Replicate strictly the authentic motifs from the reference swatch. Under NO circumstances should the AI generate unreferenced patterns or foreign embellishments.\n` +
        `- STRICT UNIFORM BUTTI SCALE (CHEST VS PLEATS 1:1 LOCK): The buttis on the diagonal chest wrap, bust, and shoulder must be EXACTLY IDENTICAL in miniature physical size (approx 1.2 cm to 1.5 cm) to the buttis on the lower skirt pleats. Motifs on the chest MUST NOT be enlarged or magnified.\n` +
        (effectiveBorderMode === 'lower_border_borderless'
          ? `- 100% BORDERLESS CHEST WRAP WITH BUTTIS TO THE FOLD: The diagonal chest wrap across the bust and left shoulder is completely borderless self-fabric. The widely-spaced miniature buttis continue in their staggered diagonal pattern uninterrupted across the chest, bust, ribs, and collarbone right to the clean folded neckline edge with zero blank margins.`
          : effectiveBorderMode === 'lower_border_only'
          ? `- TOP BORDER RIBBON WITH BUTTIS FILLING ENTIRE CHEST: The diagonal chest drape has a neat, narrow finished border ribbon (~0.5 cm - 1 cm solid woven piping / edge ribbon) along its topmost folded edge meeting the blouse neckline. The widely-spaced miniature buttis continue in their staggered diagonal pattern uninterrupted across the chest, bust, ribs, and collarbone right into the top border area up to the border ribbon with zero blank margins.`
          : `- BORDER CONTINUITY: The authentic border runs cleanly along the chest drape.`);
    }
  } else {
    motifSection =
      `EXACT MOTIF REPLICATION DIRECTLY FROM IMAGE ${motifSourceNum}:\n` +
      `Extract and replicate the exact visual shapes, embroidery threadwork, colors, and layout directly from Image ${motifSourceNum}.\n` +
      `SPATIAL ALIGNMENT & WIDE AIRY SPACING (EXACT REFERENCE SPECIFICATION):\n` +
      `- Motifs are arranged in an elegant, widely-spaced alternating staggered diagonal grid across the entire fabric matching the reference swatch.\n` +
      `- WIDE AIRY NEGATIVE SPACING: Motifs are sparsely and delicately distributed with generous, wide negative spacing of approx 10x to 15x the motif size (approx 15 cm to 20 cm of clean solid base fabric between buttis). Under NO circumstances should buttis be densely packed, crowded, or clustered together. The spacing must remain airy, delicate, and sparse exactly as seen on the flat fabric reference image.\n` +
      `- Under NO circumstances should buttis be enlarged, clustered together, or replaced with generic patterns.\n` +
      `- MOTIF FIDELITY DIRECTIVE: Replicate strictly the authentic motifs from Image ${motifSourceNum}. Under NO circumstances should the AI generate unreferenced patterns or foreign embellishments.\n` +
      `- STRICT UNIFORM BUTTI SCALE (CHEST VS PLEATS 1:1 LOCK): The buttis on the diagonal chest wrap, bust, and shoulder must be EXACTLY IDENTICAL in miniature physical size (approx 1.2 cm to 1.5 cm) to the buttis on the lower skirt pleats. Motifs on the chest MUST NOT be enlarged or magnified.\n` +
      (effectiveBorderMode === 'lower_border_borderless'
        ? `- 100% BORDERLESS CHEST WRAP WITH BUTTIS TO THE FOLD: The diagonal chest wrap across the bust and left shoulder is completely borderless self-fabric. The widely-spaced miniature buttis continue in their staggered diagonal pattern uninterrupted across the chest, bust, ribs, and collarbone right to the clean folded neckline edge with zero blank margins.`
        : effectiveBorderMode === 'lower_border_only'
        ? `- TOP BORDER RIBBON WITH BUTTIS FILLING ENTIRE CHEST: The diagonal chest drape has a neat, narrow finished border ribbon (~0.5 cm - 1 cm solid woven piping / edge ribbon) along its topmost folded edge meeting the blouse neckline. The widely-spaced miniature buttis continue in their staggered diagonal pattern uninterrupted across the chest, bust, ribs, and collarbone right into the top border area up to the border ribbon with zero blank margins.`
        : `- BORDER CONTINUITY: The authentic border runs cleanly along the chest drape.`);
  }

  let continuityDirective = '';
  if (isContinuousJaal) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The continuous all-over jaal lattice and framed motifs repeat continuously and uniformly across the entire saree—covering the skirt, front waist pleats, lap, thighs, and diagonal chest wrap right up to the top edge (border ribbon or folded edge) at the blouse. Never leave any empty space or blank unprinted margins along the chest drape.\n`;
  } else if (isStripesOrLeheriya) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The flowing diagonal waves / stripes continue seamlessly and uniformly across the entire saree—covering the skirt, front waist pleats, lap, and diagonal chest wrap right up to the top edge (border ribbon or folded edge) at the blouse. Never leave any blank margins or unprinted stripes.\n`;
  } else if (isChecksOrKattam) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The structured checks / kattam grid extends continuously and uniformly across the entire saree—covering the skirt, front waist pleats, and diagonal chest wrap right up to the top edge. Never leave any blank margins.\n`;
  } else if (isBandhani) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The tied bandhani dot clusters flow continuously and uniformly across the entire saree—covering the skirt, front waist pleats, and diagonal chest wrap right up to the folded neckline edge with zero blank margins.\n`;
  } else if (isMediumRepeat) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The repeating motifs in their regular spacing repeat uniformly across the entire saree—covering the skirt, front waist pleats, and diagonal chest wrap right up to the top edge at the blouse. Never leave any blank margins.\n`;
  } else if (isTraditionalNarrative) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The authentic folk / figurative motifs extend across the entire saree body and diagonal chest wrap right up to the top edge with zero blank margins.\n`;
  } else if (isPlainOrBorderOnly) {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The solid plain body fabric covers the entire skirt, pleats, and diagonal chest wrap smoothly right up to the folded edge.\n`;
  } else {
    continuityDirective = `3. ALL-OVER CONTINUITY TO THE FOLDED EDGE (ZERO BLANK MARGINS): The delicate repeating body buttis in their staggered diagonal grid must repeat continuously and uniformly across the entire saree—covering the skirt, front waist pleats, lap, thighs, and diagonal chest wrap right up to the top edge (border ribbon or folded edge) at the blouse with wide negative spacing (10x to 15x spacing, approx 15 cm to 20 cm apart). Never leave any empty space or blank unprinted margins along the chest drape.\n`;
  }

  const uniformScaleDirective = isContinuousJaal
    ? `4. UNIFORM GRID SCALE: The jaal lattice cells and internal motifs across the chest, bust, shoulder, pleats, and skirt must be identical in physical grid scale matching the reference swatch 1:1. Lattice cells must never be stretched or enlarged on the chest.\n`
    : isMediumRepeat
    ? `4. UNIFORM MOTIF SCALE: Every repeating motif across the chest, bust, shoulder, pleats, and skirt must be identical in scale (~3-5 cm) matching the reference swatch.\n`
    : isStripesOrLeheriya
    ? `4. UNIFORM STRIPE/WAVE SCALE: Stripe thickness, wave amplitude, and rhythm across the chest, bust, pleats, and skirt must be uniform and faithful to the reference swatch.\n`
    : isChecksOrKattam
    ? `4. UNIFORM CHECK GRID SCALE: Check square dimensions across the chest, pleats, and skirt must be uniform and identical in scale.\n`
    : `4. UNIFORM SCALE: Every motif across the chest, bust, shoulder, pleats, and skirt must be identical in size (miniature 1.2 cm - 1.5 cm), stitch structure, and color to the reference buttis. Motifs must never mutate into large shapes or clusters on the chest.\n`;

  const aiDirectiveBlock = aiPromptDirective
    ? `\n[AI SCAN GROUND TRUTH DIRECTIVE]:\n${aiPromptDirective}\n`
    : '';

  const fidelityRule =
    `[FABRIC, MOTIF & BORDER FIDELITY - GROUND TRUTH DIRECTIVE]:\n` +
    `1. ZERO EXTERNAL PATTERN SYNTHESIS: Every motif, pattern, border, and fabric color must be extracted and replicated 100% directly from the provided reference swatches. Do not invent any unreferenced embroidery, shapes, or trims.\n` +
    `2. ${motifSection}\n` +
    `${continuityDirective}` +
    `${uniformScaleDirective}` +
    `5. LOWER SKIRT & PALLU BORDER FIDELITY: The horizontal border along the feet at the bottom hem of the saree, as well as along the outer vertical drape of the cascading pallu, must replicate the EXACT colors, motifs, width, framing bands, and embroidery directly from the reference swatches (Image ${hemNum} and Image 2). Replicate the authentic border faithfully 1:1 without altering colors or adding unreferenced elements.\n` +
    `6. PALLU ANGLE & GRAVITATIONAL ORIENTATION: The pallu from Image 2 is anchored securely at the left shoulder and falls straight down behind the left arm/shoulder in a clean vertical cascade to lower calf level, exactly matching the vertical orientation of Image 2. The authentic reference border runs vertically along the outer hanging edge from the shoulder down to the hem. The authentic tassels hang strictly along the bottom horizontal end hem at calf level. Tassels must NEVER be placed on the vertical border, on the side edges, or on the front drape.` +
    (faceNum
      ? `\n7. STRICT FACIAL IDENTITY FIDELITY (IMAGE ${faceNum}):\nThe model's face must replicate the exact facial structure, almond eye shape, nose, lip contours, jawline, cheekbones, and authentic skin tone directly from Image ${faceNum}. Ensure single coherent identity matching Image ${faceNum} with natural skin texture and serene expression without changing, altering, or morphing her face.`
      : '') +
    aiDirectiveBlock;

  // Dynamic chest pattern fill helper for Border Blocks & Pose Text
  const getChestPatternFill = () => {
    if (isContinuousJaal) {
      return 'the continuous all-over interlocking jaal / lattice grid and framed motifs fill the entire chest space right up to the';
    }
    if (isStripesOrLeheriya) {
      return 'the continuous flowing diagonal leheriya waves / stripes flow seamlessly across the entire chest space right up to the';
    }
    if (isChecksOrKattam) {
      return 'the structured checks / kattam grid extends seamlessly across the entire chest space right up to the';
    }
    if (isBandhani) {
      return 'the authentic tied bandhani dot clusters flow continuously across the entire chest space right up to the';
    }
    if (isMediumRepeat) {
      return 'the repeating motifs in their authentic moderate spacing extend continuously across the entire chest space right up to the';
    }
    if (isTraditionalNarrative) {
      return 'the authentic folk / figurative motifs extend across the entire chest space in their reference scale right up to the';
    }
    if (isPlainOrBorderOnly) {
      return 'the clean solid self-fabric extends smoothly across the entire chest space right up to the';
    }
    return 'the repeating miniature buttis (approx 1.2 cm - 1.5 cm with wide 10x to 15x spacing, approx 15-20 cm apart) must extend continuously and uniformly right up to the';
  };

  // Exactly ONE Border Block
  let borderBlockText = '';
  if (effectiveBorderMode === 'symmetric') {
    borderBlockText =
      `[BORDER ARCHITECTURE: SYMMETRIC BORDERS]:\n` +
      `The identical border design from Image ${hemNum} is replicated along both the lower hem at the feet and the outer pallu edge.`;
  } else if (effectiveBorderMode === 'different') {
    borderBlockText =
      `[BORDER ARCHITECTURE: DUAL CONTRASTING BORDERS]:\n` +
      `Lower hem border at the feet comes strictly from Image ${hemNum}. Chest border comes strictly from Image ${chestNum}. Do not swap or blend them. The lower hem border is confined to the floor hemline and must never be placed on the chest.`;
  } else if (effectiveBorderMode === 'lower_border_borderless') {
    // LOWER BORDER ONLY - BORDERLESS CHEST WRAP
    const bodyImgNum = manifest.find(m => m.slotId === 'body')?.imageNumber || 1;

    borderBlockText =
      `[BORDER ARCHITECTURE: LOWER BORDER ONLY - BORDERLESS SELF-FABRIC CHEST WRAP]:\n` +
      `• BROAD LOWER SKIRT & PALLU DRAPE BORDER: The authentic reference border from Image ${bodyImgNum} and Image 2 is strictly confined to two locations: (1) horizontally along the bottom skirt hemline at floor level (feet and pleats), and (2) vertically along the outer hanging edge of the cascading pallu drape down to the bottom tassels. NOWHERE ELSE.\n` +
      `• 100% BORDERLESS CHEST WRAP: The diagonal chest drape running from the right waist across the bust to the left shoulder consists purely of clean saree body fabric. It has a plain, unbordered natural folded edge meeting the blouse neckline. The chest drape is completely free of any border band, ribbon, piping, or decorative edging.\n` +
      `• BUTTIS / PATTERN FILL ENTIRE CHEST SPACE TO THE FOLDED EDGE (ZERO EMPTY SPACE): Across the entire diagonal chest drape, bust, ribs, and collarbone, ${getChestPatternFill()} folded neckline edge. There must be ZERO empty white fabric margins, ZERO plain dead bands, and ZERO unprinted space anywhere on the chest wrap.\n` +
      `• PALLU DRAPE & BOTTOM TASSEL ALIGNMENT: The pallu hangs straight down in a clean vertical fall behind the left arm to lower calf level, showing the authentic outer vertical border. The authentic tassels hang strictly from the bottom horizontal cross-cut hem at calf level. The pallu is NOT wrapped across the front abdomen.\n` +
      `• STRICT UNIFORM MOTIF SCALE: All motifs on the chest drape and bust must match the exact scale of the pleat motifs. Anchor pattern scale strictly to Image ${bodyImgNum}. Do NOT enlarge chest motifs.\n` +
      `• TORSO TEXTURE SOURCE: The chest drape and front waist pleats are textured from the body fabric of Image ${bodyImgNum}. Do NOT copy or propagate the lower hem border onto the chest or shoulder.`;
  } else {
    // LOWER BORDER ONLY - WITH TOP BORDER RIBBON
    const bodyImgNum = manifest.find(m => m.slotId === 'body')?.imageNumber || 1;

    borderBlockText =
      `[BORDER ARCHITECTURE: LOWER BORDER ONLY - SINGLE LENGTHWISE BORDER WITH TOP BORDER RIBBON]:\n` +
      `• BROAD LOWER SKIRT & PALLU DRAPE BORDER: The wide reference border from Image ${bodyImgNum} is strictly confined to two locations: (1) horizontally along the bottom skirt hemline at floor level (feet and pleats), and (2) vertically along the outer hanging fall of the cascading pallu drape down to the tassels. NOWHERE ELSE.\n` +
      `• TOP BORDER RIBBON ALONG CHEST DRAPE: The diagonal chest drape running from the right waist across the bust to the left shoulder features a neat, narrow finished border ribbon (~0.5 cm to 1 cm solid woven piping / edge ribbon) along its topmost folded edge where it meets the blouse neckline.\n` +
      `• BUTTIS / PATTERN FILL ENTIRE CHEST SPACE TO THE BORDER RIBBON (ZERO EMPTY SPACE): Across the entire diagonal chest drape, bust, ribs, and collarbone, ${getChestPatternFill()} narrow border ribbon. There must be ZERO empty white fabric margins, ZERO plain dead bands, and ZERO unprinted space anywhere on the chest wrap.\n` +
      `• PALLU DRAPE & BOTTOM TASSEL ALIGNMENT: The pallu hangs straight down in a clean vertical fall behind the left arm to lower calf level, showing the authentic outer vertical border. The authentic tassels hang strictly from the bottom horizontal cross-cut hem at calf level. The pallu is NOT wrapped across the front abdomen.\n` +
      `• STRICT UNIFORM MOTIF SCALE: All motifs on the chest drape and bust must match the exact scale of the pleat motifs. Anchor pattern scale strictly to Image ${bodyImgNum}. Do NOT enlarge chest motifs.\n` +
      `• TORSO TEXTURE SOURCE: The chest drape and front waist pleats are textured from the body fabric of Image ${bodyImgNum}. Do NOT copy or propagate the wide lower hem border onto the chest or shoulder.`;
  }

  // Absent Slot Rules
  const absentSlotLines: string[] = [];
  if (!macroMotifData) {
    absentSlotLines.push('Motifs: Reproduce only the repeating buttis visible in Image 1.');
  }
  if (!blouseData) {
    absentSlotLines.push('Blouse: Elegantly tailored fitted blouse with modest round neckline and elbow-length or short tailored sleeves (fully covered shoulders and arms, tailored sleeve cuffs matching the solid base fabric; strictly NOT sleeveless, NO bare shoulders).');
  }

  // Camera, Pose & Model
  const modelAnchor = input.modelAnchor || 'a radiant Indian female fashion model with natural skin texture, serene facial expression, and elegant posture';
  let poseSnippet = input.poseSnippet || 'Full-length front standing portrait at eye-level, poised and dignified posture.';

  // Classify Pose Context & Framing
  const lkSnippet = (input.poseSnippet || '').toLowerCase();
  const isMirror = isMirrorPose || lkSnippet.includes('mirror');
  const isCloseUp = lkSnippet.includes('close-up') || lkSnippet.includes('glance') || lkSnippet.includes('chest-up') || lkSnippet.includes('neckline and chest');
  const isRear = lkSnippet.includes('rear') || lkSnippet.includes('back') || lkSnippet.includes('pallu cascade') || lkSnippet.includes('cascading down her back');
  const isSeated = lkSnippet.includes('seated') || lkSnippet.includes('armchair') || lkSnippet.includes('hostess') || lkSnippet.includes('lap');
  const isWalk = lkSnippet.includes('walk') || lkSnippet.includes('stride') || lkSnippet.includes('walking');
  const isFrontStand = !isMirror && !isCloseUp && !isRear && !isSeated && !isWalk;

  // Helper to build consistent chest drape description across all poses
  const getChestText = (context: 'mirror' | 'closeUp' | 'seated' | 'walk' | 'front') => {
    const patternFill = getChestPatternFill();
    if (effectiveBorderMode === 'lower_border_borderless') {
      if (context === 'mirror') {
        return `The chest wrap reflected in the mirror is completely borderless self-fabric; ${patternFill} natural folded neckline edge with zero blank margins.`;
      }
      if (context === 'closeUp') {
        return ` The diagonal chest wrap across the bust and collarbone is completely borderless self-fabric; ${patternFill} folded neckline edge with zero blank margins.`;
      }
      if (context === 'seated' || context === 'walk') {
        return ` The diagonal chest wrap across the bust is completely borderless self-fabric; ${patternFill} folded neckline edge with zero blank margins.`;
      }
      return ` The diagonal chest wrap across the bust is completely borderless self-fabric; ${patternFill} folded neckline edge and left shoulder with zero blank margins. `;
    }
    if (effectiveBorderMode === 'lower_border_only') {
      if (context === 'mirror') {
        return `The chest wrap reflected in the mirror features a neat narrow border ribbon (~0.5 cm - 1 cm solid edge ribbon); ${patternFill} border ribbon with zero blank margins.`;
      }
      if (context === 'closeUp') {
        return ` The diagonal chest wrap across the bust and collarbone features a neat narrow border ribbon (~0.5 cm - 1 cm solid edge ribbon); ${patternFill} border ribbon with zero blank margins.`;
      }
      if (context === 'seated' || context === 'walk') {
        return ` The diagonal chest wrap across the bust features a neat narrow border ribbon (~0.5 cm - 1 cm solid edge ribbon); ${patternFill} border ribbon with zero blank margins.`;
      }
      return ` The diagonal chest wrap across the bust features a neat narrow border ribbon (~0.5 cm - 1 cm solid edge ribbon); ${patternFill} border ribbon and left shoulder with zero blank margins. `;
    }
    // symmetric / different
    if (context === 'mirror') {
      return 'The chest wrap reflected in the mirror displays the authentic reference border cleanly along the neckline.';
    }
    if (context === 'closeUp') {
      return ' The authentic reference border runs cleanly along the diagonal edge of the chest wrap across the bust.';
    }
    if (context === 'seated') {
      return ' The diagonal chest wrap across the bust features the authentic reference border along the edge.';
    }
    if (context === 'walk') {
      return ' The diagonal chest wrap and cascading pallu display the authentic continuous border along their edges down to the hem.';
    }
    return ' Right hand rests gracefully by her side. The authentic saree border runs along the diagonal chest drape and the floor-length skirt hemline at the feet.';
  };

  if (isMirror) {
    // 1. The Mirror Moment (Over-the-shoulder medium shot reflection)
    const mirrorChest = getChestText('mirror');

    poseSnippet =
      `MANDATORY OVER-THE-SHOULDER MIRROR ANGLE: ` +
      `Medium shot framed over the model's left shoulder from behind, looking past her into a vintage warm teakwood dressing mirror. ` +
      `The model is positioned with her back and shoulder towards the camera in the foreground, facing into the mirror. ` +
      `The model wears an elegantly tailored full jacket-style blouse with modest high back neckline and elbow sleeves (fully covered back, not backless). ` +
      `Her serene face looking directly into her own eyes in the glass with a quiet confident half-smile, ${mirrorChest} ` +
      `Her hand is gracefully raised adjusting the shoulder drape at her left shoulder, and the reflection mirrors her hand, gold bangles, and the outer pallu drape displaying the authentic continuous border ribbon. ` +
      `The lower body and feet are outside the frame (medium shot framing).`;
  } else if (isCloseUp) {
    // 5. The Glance (Close-up chest-up portrait)
    const closeUpBorderText = getChestText('closeUp');

    poseSnippet = poseSnippet
      .replace(/the authentic reference border across the chest,?/gi, '')
      .replace(/the authentic reference border,?/gi, 'authentic fabric weave texture,')
      .replace(/border across the chest/gi, 'folded edge across the chest')
      .replace(/authentic saree border across the chest/gi, 'authentic chest drape')
      .trim();

    poseSnippet += closeUpBorderText;
  } else if (isRear) {
    // 6. The Pallu Cascade (Rear view head-to-floor)
    poseSnippet = poseSnippet
      .replace(/Three-quarter rear portrait view\.?/gi, 'Full-length three-quarter rear catalog view from head to floor.')
      .replace(/Three-quarter rear portrait\.?/gi, 'Full-length three-quarter rear catalog view from head to floor.')
      .replace(/Three-quarter rear view\.?/gi, 'Full-length three-quarter rear catalog view from head to floor.');

    poseSnippet +=
      ' The saree skirt falls uninterrupted in crisp vertical pleats to the floor with the authentic lower hem border along the feet. ' +
      'The pallu cascades gracefully down her entire back from the left shoulder down to lower calf level, ' +
      'framed by the continuous, unbroken lengthwise border along the outer drape and displaying the authentic pallu artwork and bottom tassels. ' +
      (isDenseJaal
        ? 'The authentic all-over interlocking jaal pattern and framed motifs continue continuously across the visible back body fabric at uniform miniature scale matching the reference swatch 1:1.'
        : 'Delicate repeating buttis continue across the visible back body fabric at uniform miniature scale with wide, airy negative spacing (10x to 15x spacing, approx 15-20 cm apart).');
  } else if (isSeated) {
    // 4. The Verandah Hostess (Seated on armchair)
    poseSnippet = poseSnippet
      .replace(/\(absolutely no plain.*?\)/gi, '')
      .replace(/all-over body fabric motifs and printed pattern/gi, isDenseJaal ? 'authentic continuous all-over jaal lattice and framed motifs' : 'delicate widely-spaced miniature body buttis')
      .replace(/printed pattern clearly and continuously visible/gi, isDenseJaal ? 'authentic continuous all-over jaal clearly visible' : 'delicate miniature buttis clearly visible with generous negative space')
      .replace(/all-over printed pattern/gi, isDenseJaal ? 'authentic continuous all-over jaal' : 'delicate miniature buttis')
      .trim();

    const seatedChestText = getChestText('seated');

    poseSnippet +=
      `${seatedChestText} ` +
      (isDenseJaal
        ? `The authentic all-over jaal (lattice grid) and framed motifs extend uniformly across every fanned pleat, the lap, and thighs without plain blank patches, matching the chest drape scale 1:1. `
        : `The delicate repeating buttis (approx 1.2 cm - 1.5 cm) extend uniformly across every fanned pleat, the lap, and thighs with wide, airy negative spacing (10x to 15x spacing, approx 15-20 cm apart) without plain blank patches, matching the chest drape scale 1:1. `) +
      `The lower hem border finishes the outer edge of the fanned skirt pleats.`;
  } else if (isWalk) {
    // 3. The Confident Walk-In (Mid-step walking stride)
    poseSnippet = poseSnippet
      .replace(/Her hand gently steadies the pallu against her waist/gi, 'The pallu falls straight down along her left side')
      .trim();

    const walkChestText = getChestText('walk');

    poseSnippet +=
      `${walkChestText} ` +
      `The pallu cascades straight down from the left shoulder along her left side in a natural vertical fall, showing the outer decorative border and bottom tassels. ` +
      `The lower hemline border is cleanly visible along the bottom edge of the skirt and pleats at floor level as she strides. ` +
      (isDenseJaal
        ? `The continuous all-over jaal pattern and motifs across the chest wrap, waist, and walking pleats maintain uniform authentic scale matching the reference swatch.`
        : `All buttis across the chest wrap, waist, and walking pleats maintain uniform miniature scale with wide, airy negative spacing (10x to 15x spacing, approx 15-20 cm apart).`);
  } else {
    // 2. The Classic Front Stand (Default standing catalogue)
    const frontChestText = getChestText('front');

    poseSnippet = poseSnippet
      .replace(/the authentic reference border across the chest,?/gi, isDenseJaal ? 'continuous all-over jaal continuing to the neckline,' : 'delicate repeating buttis continuing to the neckline,')
      .replace(/border across the chest/gi, isDenseJaal ? 'folded edge across the chest with continuous jaal' : 'folded edge across the chest with repeating buttis')
      .replace(/authentic saree border across the chest/gi, isDenseJaal ? 'continuous all-over jaal continuing up to the neckline' : 'repeating miniature buttis continuing up to the neckline')
      .replace(/right hand gently holding the woven pallu edge.*?clean floor-length fall of the saree\./gi, '')
      .replace(/right hand gently holding the woven pallu edge.*?display the full width of the authentic saree border/gi, '')
      .trim();

    poseSnippet +=
      `${frontChestText}` +
      `The pallu is anchored at the left shoulder and hangs straight downward behind the left arm in a clean vertical fall to lower calf level, showing the authentic outer vertical border and bottom tassels. ` +
      `The front waist pleats fall straight to the floor, where the lower skirt hemline features the authentic horizontal border. ` +
      (isDenseJaal
        ? `Strict 1:1 uniform pattern scale: the authentic continuous jaal (lattice grid) with framed repeating motifs extends uniformly across the chest drape, bust, waist pleats, and skirt matching the reference swatch.`
        : `Strict 1:1 uniform butti scale: every motif on the chest drape, bust, waist pleats, and skirt is identical in miniature size (approx 1.2 cm - 1.5 cm) with wide, airy negative spacing (10x to 15x spacing, approx 15-20 cm apart) matching the reference swatch.`);
  }

  const backgroundSetting = input.backgroundSetting || 'Living room verandah with clean natural architecture, soft natural daylight.';
  const lightingCameraSetting = input.lightingCameraSetting || 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Ultra-clean commercial fashion catalogue photography, soft studio lighting, pristine noise-free fabric weave, smooth velvety backdrop, true color reproduction, zero film grain, zero digital artifacting.';
  const mirrorPhysicsRule = input.mirrorPhysicsRule ? `\n${input.mirrorPhysicsRule.trim()}` : '';

  const promptSuggestionsBlock = input.promptSuggestions && input.promptSuggestions.trim()
    ? `USER CORRECTIONS & SWATCH DIRECTION:\n${input.promptSuggestions.trim()}\nFollow these corrections precisely.`
    : '';

  const blouseStyleRule = !blouseData
    ? 'The model wears an elegantly tailored blouse with modest round neckline and elbow-length tailored sleeves (fully covered shoulders and arms, tailored sleeves; strictly NOT sleeveless, NO bare shoulders).'
    : 'The model wears a tailored blouse matching the reference swatch.';

  const modelAnchorText = faceNum
    ? `${modelAnchor}. Replicate the exact facial features, eye shape, and skin tone from Image ${faceNum} (strict identity lock)`
    : modelAnchor;

  // Assemble Final Structured Prompt
  const promptSections = [
    `[CAMERA ANGLE, COMPOSITION & POSE]:\nPose: ${poseSnippet}\nModel: ${modelAnchorText}. ${blouseStyleRule}\nBackground & Setting: ${backgroundSetting}\nLighting & Camera: ${lightingCameraSetting}${mirrorPhysicsRule}`,
    manifestText,
    fidelityRule,
    borderBlockText,
    ...(absentSlotLines.length > 0 ? [absentSlotLines.join('\n')] : []),
    ...(promptSuggestionsBlock ? [promptSuggestionsBlock] : []),
  ];

  const finalPrompt = promptSections.filter(s => s && s.trim().length > 0).join('\n\n');

  // Targeted Negative Exclusions (Cleanly segregated, NO hardcoded diamond/rhombus!)
  const priorityNegatives: string[] = [];

  if (faceNum) {
    priorityNegatives.push(
      'different face, wrong face, altered facial identity, changing model face, generic face, morphing face, distorted features, plastic face'
    );
  }

  if (effectiveBorderMode === 'lower_border_only' || effectiveBorderMode === 'lower_border_borderless') {
    const isDenseOrRepeating = isContinuousJaal || isStripesOrLeheriya || isChecksOrKattam || isBandhani || isMediumRepeat;
    const lowerBorderNegatives = isDenseOrRepeating
      ? 'chest border, border across bust, upper border, neckline border, thick chest border, widened chest border, dual borders, symmetric borders, blank unprinted chest margins, missing motifs along chest drape, unreferenced motifs, enlarged chest motifs, oversized motifs on torso, unequal motif sizing, mismatched motif scale, misplaced tassels, pallu wrapped across front, bunched pallu on waist, sideways rotated pallu'
      : 'chest border, border across bust, upper border, neckline border, thick chest border, widened chest border, dual borders, symmetric borders, blank unprinted chest margins, missing buttis along chest drape, crowded buttis, dense butti spacing, clustered motifs, unreferenced motifs, enlarged chest motifs, magnified buttis on chest, oversized buttis on torso, unequal motif sizing, mismatched butti scale, misplaced tassels, pallu wrapped across front, bunched pallu on waist, sideways rotated pallu';
    priorityNegatives.push(lowerBorderNegatives);
    if (effectiveBorderMode === 'lower_border_borderless') {
      priorityNegatives.push(
        'border ribbon on chest, edge ribbon on bust, piping on chest, contrasting piping'
      );
    }
  } else if (effectiveBorderMode === 'different') {
    priorityNegatives.push(
      'hemline border copied to chest, widened chest border, mismatched chest border, swapped upper and lower borders'
    );
  }

  // Blouse styling: strictly modest sleeves for all poses unless explicit blouse swatch indicates otherwise
  priorityNegatives.push(
    'sleeveless, sleeveless blouse, bare shoulders, strapless blouse, spaghetti straps, thin strap blouse, halter top, exposed shoulders, bare arms, cutaway shoulders, low armhole, sleeveless top, bare clavicle, backless dress, backless blouse'
  );

  if (isMirrorPose) {
    priorityNegatives.push(
      'backless blouse, open back, deep scoop back, bare back, exposed back, low back cut, back cutout, bare spine, front-facing standing pose without mirror, direct camera stare without mirror, missing mirror, no reflection, empty mirror'
    );
  }

  if (isDelicate || macroMotifData || dynamicMotifsDescription) {
    const isDenseOrRepeating = isContinuousJaal || isStripesOrLeheriya || isChecksOrKattam || isBandhani || isMediumRepeat;
    priorityNegatives.push(
      isDenseOrRepeating
        ? 'oversized buttis, giant motifs, distorted motifs, unreferenced motifs, unreferenced patterns, blank chest drape, plain unprinted lap, solid unprinted pleats, broken jaal grid, missing grid cells, uneven lattice, blank top edge'
        : 'oversized buttis, giant motifs, distorted motifs, unreferenced motifs, unreferenced patterns, blank chest drape, plain unprinted lap, solid unprinted pleats, crowded buttis, dense clusters, magnified buttis on chest, unequal motif sizing, blown up motifs, blank top edge, missing buttis along top border'
    );
  }

  const baseNegative =
    'film grain, heavy grain, sensor noise, speckles, compression artifacts, noisy background, bad anatomy, deformed fingers, fused fingers, too many fingers, missing fingers, broken wrist, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, out of focus, soft focus, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, floating jewelry, melting jewelry, unnatural fabric tension, watermark, signature, blurry text, cropped head, unnatural poses, bright flash, evening bulb light, garish colors, hanging beads, unwanted tassels, fringe, misplaced tassels, short pallu, cropped pallu, cropped saree, short skirt, cropped feet';

  const negativeList: string[] = [...priorityNegatives, baseNegative];
  const negativeExclusions = negativeList.join(', ');

  return {
    manifest,
    manifestText,
    fidelityRule,
    borderBlockText,
    absentSlotLines,
    finalPrompt,
    effectiveBorderMode,
    negativeExclusions,
  };
}

