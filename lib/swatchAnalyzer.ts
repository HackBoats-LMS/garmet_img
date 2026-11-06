import sharp from 'sharp';

function getSharpInstance(input: any) {
  const s = typeof sharp === 'function' ? sharp : ((sharp as any)?.default || require('sharp'));
  return s(input);
}

export interface DetectedMotif {
  id: number;
  category: 'floral' | 'geometric' | 'curvilinear' | 'foliage';
  name: string;
  paletteDescription: string;
  colors: string[];
  centroid: { x: number; y: number };
  boundingBox: { left: number; top: number; width: number; height: number };
  confidence: number;
  cropBase64?: string;
}

export interface DistinctMotifArchetype {
  id: number;
  category: 'floral' | 'geometric' | 'curvilinear' | 'foliage';
  name: string;
  paletteDescription: string;
  colors: string[];
  cropBase64: string;
  frequency: number;
}

export interface SwatchAnalysisResult {
  isMultiMotif: boolean;
  motifCount: number;
  layoutGrid: 'alternating_diamond_grid' | 'single_motif_repeat' | 'plain_or_uniform';
  motifs: DetectedMotif[];
  distinctMotifs: DistinctMotifArchetype[];
  hasGoldOrTan: boolean;
  baseColorRgb: { r: number; g: number; b: number };
  autoCroppedMacroBase64?: string;
  promptDirective: string;
}

/**
 * Analyzes a saree fabric swatch to detect and classify repeating buttis and motifs.
 * Uses high-speed local computer vision via Sharp (zero external API calls).
 */
export async function analyzeSwatchBuffer(imageBuffer: Buffer): Promise<SwatchAnalysisResult> {
  const img = getSharpInstance(imageBuffer);
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  // 1. Calculate Base Fabric Background Color from central smooth zones
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  for (let y = Math.floor(h * 0.25); y < Math.floor(h * 0.75); y += 4) {
    for (let x = Math.floor(w * 0.25); x < Math.floor(w * 0.75); x += 4) {
      const idx = (y * w + x) * 3;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
      bgCount++;
    }
  }
  const baseR = bgCount > 0 ? bgR / bgCount : 220;
  const baseG = bgCount > 0 ? bgG / bgCount : 215;
  const baseB = bgCount > 0 ? bgB / bgCount : 205;

  // 2. Scan image in small spatial cells (approx 20x20 px) for motif foreground pixels
  const cellSize = Math.max(16, Math.floor(Math.min(w, h) / 30));
  const gw = Math.floor(w / cellSize);
  const gh = Math.floor(h / cellSize);

  interface CellInfo {
    gx: number;
    gy: number;
    cx: number;
    cy: number;
    pinkCount: number;
    greenCount: number;
    tanGoldCount: number;
    darkLinearCount: number;
    deviationScore: number;
  }

  const activeCells: CellInfo[] = [];

  // Exclude outer 10% perimeter where tassels, fringe, and table edges sit
  const marginY = Math.max(1, Math.floor(gh * 0.10));
  const marginX = Math.max(1, Math.floor(gw * 0.08));

  for (let gy = marginY; gy < gh - marginY; gy++) {
    for (let gx = marginX; gx < gw - marginX; gx++) {
      let diffSum = 0;
      let pinkCount = 0;
      let greenCount = 0;
      let tanGoldCount = 0;
      let darkLinearCount = 0;
      let pixelTotal = 0;

      for (let y = gy * cellSize; y < (gy + 1) * cellSize; y++) {
        for (let x = gx * cellSize; x < (gx + 1) * cellSize; x++) {
          const idx = (y * w + x) * 3;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const dist = Math.sqrt((r - baseR) ** 2 + (g - baseG) ** 2 + (b - baseB) ** 2);
          diffSum += dist;

          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Pink/Coral Petals: R channel significantly exceeds G & B
          if (r > 120 && r > g + 16 && r > b + 16) {
            pinkCount++;
          }
          // Green Stem/Calyx: G higher than R and B
          else if (g > r + 4 && g > b && dist > 18) {
            greenCount++;
          }
          // Tan/Gold/Zari stipples or chevron lines: warm balanced darker tones
          else if (dist > 18 && gray < 195 && r < 205 && Math.abs(r - g) < 24 && r > b + 6) {
            tanGoldCount++;
          }
          // Fine linear dark embroidery (ignore solid dark tassel clumps)
          else if (gray < 175 && dist > 25 && dist < 120) {
            darkLinearCount++;
          }
          pixelTotal++;
        }
      }

      const avgDist = diffSum / pixelTotal;
      // Prioritize authentic floral and metallic zari embroidery over edge noise
      const isFloralOrZari = (pinkCount > 2 || tanGoldCount > 3);
      if (avgDist > 12 && (isFloralOrZari || (darkLinearCount > 3 && darkLinearCount < 20))) {
        activeCells.push({
          gx,
          gy,
          cx: gx * cellSize + cellSize / 2,
          cy: gy * cellSize + cellSize / 2,
          pinkCount,
          greenCount,
          tanGoldCount,
          darkLinearCount,
          deviationScore: avgDist,
        });
      }
    }
  }

  // 3. Cluster Connected Cells into Distinct Motif Blobs
  const clusters: Array<{
    cx: number;
    cy: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    pinkTotal: number;
    greenTotal: number;
    tanGoldTotal: number;
    linearTotal: number;
    cellCount: number;
  }> = [];

  const visited = new Set<number>();
  for (let i = 0; i < activeCells.length; i++) {
    if (visited.has(i)) continue;
    const root = activeCells[i];
    const group = [root];
    visited.add(i);

    for (let j = i + 1; j < activeCells.length; j++) {
      if (visited.has(j)) continue;
      const other = activeCells[j];
      if (Math.abs(root.gx - other.gx) <= 2 && Math.abs(root.gy - other.gy) <= 2) {
        group.push(other);
        visited.add(j);
      }
    }

    if (group.length >= 2) {
      let sumX = 0, sumY = 0;
      let minX = w, maxX = 0, minY = h, maxY = 0;
      let pTot = 0, gTot = 0, tTot = 0, lTot = 0;

      for (const cell of group) {
        sumX += cell.cx;
        sumY += cell.cy;
        const x0 = cell.gx * cellSize;
        const x1 = (cell.gx + 1) * cellSize;
        const y0 = cell.gy * cellSize;
        const y1 = (cell.gy + 1) * cellSize;
        if (x0 < minX) minX = x0;
        if (x1 > maxX) maxX = x1;
        if (y0 < minY) minY = y0;
        if (y1 > maxY) maxY = y1;
        pTot += cell.pinkCount;
        gTot += cell.greenCount;
        tTot += cell.tanGoldCount;
        lTot += cell.darkLinearCount;
      }

      clusters.push({
        cx: Math.round(sumX / group.length),
        cy: Math.round(sumY / group.length),
        minX,
        maxX,
        minY,
        maxY,
        pinkTotal: pTot,
        greenTotal: gTot,
        tanGoldTotal: tTot,
        linearTotal: lTot,
        cellCount: group.length,
      });
    }
  }

  // Deduplicate overlapping blobs
  const mergedBlobs: typeof clusters = [];
  for (const c of clusters) {
    const existing = mergedBlobs.find(m => Math.hypot(m.cx - c.cx, m.cy - c.cy) < cellSize * 2.5);
    if (!existing) {
      mergedBlobs.push(c);
    }
  }

  // 4. Classify each detected motif
  const detectedMotifs: DetectedMotif[] = [];
  let motifIndex = 1;

  for (const blob of mergedBlobs) {
    const bw = blob.maxX - blob.minX;
    const bh = blob.maxY - blob.minY;

    // Filter out full-width folds or edges
    if (bw > w * 0.6 || bh > h * 0.6) continue;

    let category: DetectedMotif['category'] = 'geometric';
    let name = '';
    let paletteDesc = '';
    const colors: string[] = [];

    if (blob.pinkTotal > 10) {
      category = 'floral';
      colors.push('coral_pink');
      if (blob.greenTotal > 5) {
        colors.push('leaf_green');
        name = 'Embroidered Flower Butti with Green Foliage';
        paletteDesc = 'Coral/Pink Petals with Olive-Green Calyx & Stem';
      } else {
        name = 'Embroidered Blossom Butti';
        paletteDesc = 'Crimson/Pink Silk Threadwork';
      }
    } else if (blob.greenTotal > blob.tanGoldTotal && blob.greenTotal > 12) {
      category = 'foliage';
      colors.push('leaf_green');
      name = 'Botanical Leaf Sprig / Foliage Motif';
      paletteDesc = 'Delicate Green Threadwork';
    } else {
      category = 'geometric';
      colors.push('warm_tan_zari');
      const aspectRatio = bw / (bh || 1);
      if (aspectRatio > 1.5) {
        name = 'Linear Chevron / Wave Scroll Motif';
        paletteDesc = 'Tan/Zari Embroidery with Horizontal Motion';
      } else if (aspectRatio < 0.7) {
        name = 'Vertical Threadwork Motif';
        paletteDesc = 'Vertical embroidered motif matching swatch';
      } else {
        name = 'Delicate Secondary Motif';
        paletteDesc = 'Delicate secondary threadwork motif matching swatch';
      }
    }

    // Add padding to bounding box
    const pad = 12;
    const boxLeft = Math.max(0, blob.minX - pad);
    const boxTop = Math.max(0, blob.minY - pad);
    const boxWidth = Math.min(w - boxLeft, bw + pad * 2);
    const boxHeight = Math.min(h - boxTop, bh + pad * 2);

    detectedMotifs.push({
      id: motifIndex++,
      category,
      name,
      paletteDescription: paletteDesc,
      colors,
      centroid: { x: blob.cx, y: blob.cy },
      boundingBox: { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight },
      confidence: Math.min(0.98, 0.75 + (blob.cellCount * 0.04)),
    });
  }

  // 5. Generate Individual Crops for Distinct Motif Archetypes
  const distinctMap = new Map<string, { motif: DetectedMotif; count: number }>();
  for (const m of detectedMotifs) {
    if (!distinctMap.has(m.name)) {
      distinctMap.set(m.name, { motif: m, count: 1 });
    } else {
      distinctMap.get(m.name)!.count++;
    }
  }

  const distinctMotifs: DistinctMotifArchetype[] = [];
  const cropBuffers: Buffer[] = [];

  for (const [name, entry] of Array.from(distinctMap.entries())) {
    const m = entry.motif;
    const cropSize = Math.max(m.boundingBox.width, m.boundingBox.height, 100);
    const left = Math.max(0, Math.min(w - cropSize, Math.round(m.centroid.x - cropSize / 2)));
    const top = Math.max(0, Math.min(h - cropSize, Math.round(m.centroid.y - cropSize / 2)));
    const width = Math.min(w - left, cropSize);
    const height = Math.min(h - top, cropSize);

    try {
      const cropped = await getSharpInstance(imageBuffer)
        .extract({ left, top, width, height })
        .resize(256, 256, {
          fit: 'contain',
          background: { r: Math.round(baseR), g: Math.round(baseG), b: Math.round(baseB), alpha: 1 },
        })
        .jpeg({ quality: 92 })
        .toBuffer();

      cropBuffers.push(cropped);
      m.cropBase64 = `data:image/jpeg;base64,${cropped.toString('base64')}`;

      distinctMotifs.push({
        id: distinctMotifs.length + 1,
        category: m.category,
        name: m.name,
        paletteDescription: m.paletteDescription,
        colors: m.colors,
        cropBase64: m.cropBase64,
        frequency: entry.count,
      });
    } catch (cropErr) {
      console.warn('[SwatchAnalyzer] Individual motif crop failed:', cropErr);
    }
  }

  // 6. Determine Pattern Architecture & Multi-Motif Status
  const isMultiMotif = distinctMotifs.length >= 2;
  const hasGoldOrTan = detectedMotifs.some(m => m.colors.includes('warm_tan_zari'));

  let layoutGrid: SwatchAnalysisResult['layoutGrid'] = 'single_motif_repeat';
  if (isMultiMotif) {
    layoutGrid = 'alternating_diamond_grid';
  } else if (detectedMotifs.length === 0) {
    layoutGrid = 'plain_or_uniform';
  }

  // 7. Generate Composite Dual-Motif Macro Swatch (512x512)
  let autoCroppedMacroBase64: string | undefined = undefined;
  try {
    if (cropBuffers.length >= 2) {
      // Create side-by-side composite containing BOTH Motif 1 and Motif 2
      const compositeBuffer = await getSharpInstance({
        create: {
          width: 512,
          height: 512,
          channels: 3,
          background: { r: Math.round(baseR), g: Math.round(baseG), b: Math.round(baseB) },
        },
      })
        .composite([
          { input: cropBuffers[0], top: 128, left: 0 },
          { input: cropBuffers[1], top: 128, left: 256 },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();

      autoCroppedMacroBase64 = `data:image/jpeg;base64,${compositeBuffer.toString('base64')}`;
    } else if (cropBuffers.length === 1) {
      const singleBuffer = await getSharpInstance(cropBuffers[0])
        .resize(512, 512, {
          fit: 'contain',
          background: { r: Math.round(baseR), g: Math.round(baseG), b: Math.round(baseB) },
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      autoCroppedMacroBase64 = `data:image/jpeg;base64,${singleBuffer.toString('base64')}`;
    }
  } catch (compErr) {
    console.warn('[SwatchAnalyzer] Macro composite crop failed:', compErr);
  }

  // 8. Formulate Tailored Prompt Directives
  let promptDirective = '';
  if (isMultiMotif) {
    const floral = distinctMotifs.find(m => m.category === 'floral');
    const geometric = distinctMotifs.find(m => m.category === 'geometric' || m.category === 'foliage' || m.colors.includes('warm_tan_zari'));
    const motif1 = (floral || distinctMotifs[0]).name;
    const motif2 = (geometric && geometric !== floral ? geometric : (distinctMotifs[1] || distinctMotifs[0])).name;
    promptDirective =
      `DUAL ALTERNATING MOTIF SPECIFICATION (AUTHENTIC SWATCH REPLICATION): ` +
      `The macro close-up swatch has been analyzed and confirmed to possess MULTIPLE ALTERNATING BUTTIS: ` +
      `(1) ${motif1}, and (2) ${motif2}. ` +
      `MANDATORY COMPOSITION RULE: The AI must strictly replicate BOTH distinct motif styles across the saree body in an alternating staggered grid layout. ` +
      `NEVER drop the ${motif2}, and NEVER render only flowers. Both ${motif1} and ${motif2} must be crisp, visible, and uniformly repeated across the skirt pleats, waist, and chest wrap.`;
  } else if (distinctMotifs.length > 0) {
    const singleName = distinctMotifs[0].name;
    promptDirective =
      `AUTHENTIC SINGLE-MOTIF SPECIFICATION: ` +
      `The macro close-up displays delicate repeating ${singleName}. ` +
      `MANDATORY: Replicate this exact motif shape, thread texture, and spacing continuously across the saree body with uniform scale. Absolutely NO oversized bouquets, NO branch embroidery, and NO uninvited motifs.`;
  } else {
    promptDirective = 'Maintain uniform base fabric texture matching the reference image.';
  }

  return {
    isMultiMotif,
    motifCount: detectedMotifs.length,
    layoutGrid,
    motifs: detectedMotifs,
    distinctMotifs,
    hasGoldOrTan,
    baseColorRgb: { r: Math.round(baseR), g: Math.round(baseG), b: Math.round(baseB) },
    autoCroppedMacroBase64,
    promptDirective,
  };
}
