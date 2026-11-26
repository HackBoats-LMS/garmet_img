import prisma from '@/lib/prisma';
import { CATEGORY_POSES_MAP } from '@/app/utils/modelsAndPoses';

export interface HardcodedImageSlot {
  id: string;
  name: string;
  description: string;
  isRequired: boolean;
  sortOrder: number;
  sampleImageUrl?: string | null;
}

export interface HardcodedCustomOption {
  id: string;
  label: string;
  optionType: 'radio' | 'select' | 'checkbox';
  choices: string[];
  sortOrder: number;
}

export interface HardcodedPose {
  id: string;
  name: string;
  description: string;
  promptSnippet: string;
  category: string;
  purpose?: string | null;
  fabricFocus?: string | null;
  previewImage?: string | null;
  sortOrder: number;
}

export interface HardcodedTemplate {
  id: string;
  legacyIds?: string[];
  name: string;
  slug: string;
  tagline: string;
  description: string;
  garmentType: string;
  coverImage: string | null;
  isActive: boolean;
  sortOrder: number;
  allowModelSelection: boolean;
  defaultModelId: string | null;
  allowedModelIds: string[] | null;
  systemPrompt: string;
  cameraSettings: string;
  negativePrompt: string;
  imageSlots: HardcodedImageSlot[];
  customOptions: HardcodedCustomOption[];
  poses: HardcodedPose[];
}

const DEFAULT_SYSTEM_PROMPT =
  'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style. The garment is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, and intricate threadwork reflections.';

const DEFAULT_CAMERA_SETTINGS =
  'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, smooth natural bokeh depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting. Eye-level (peer POV), face always visible.';

const DEFAULT_NEGATIVE_PROMPT =
  'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses';

export const HARDCODED_TEMPLATES: HardcodedTemplate[] = [
  {
    id: 'cmuylgqoe0000eqk4chkv3hi9',
    legacyIds: ['saree'],
    name: 'Kanchipuram & Heritage Saree',
    slug: 'saree',
    tagline: 'Continuous 6-yard saree drape with Delicate Buttis, Dual Borders & Optical Mirror Physics',
    description:
      'Code-managed saree photoshoot pipeline supporting Symmetric, Different Borders, Single Border Bottom-Only, Borderless Chest Wrap, Delicate Buttis Vision Scan, Complex Dual-Tier Pleats, and Automated Pallu Tassel Detection.',
    garmentType: 'map fabric to the saree body, border, pallu, and blouse piece',
    coverImage: '/poses/saree_pose_front.jpg',
    isActive: true,
    sortOrder: 0,
    allowModelSelection: true,
    defaultModelId: null,
    allowedModelIds: null,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    cameraSettings: DEFAULT_CAMERA_SETTINGS,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    imageSlots: [
      {
        id: 'body',
        name: 'Saree Body (Overall Field)',
        description: 'Spread of fabric showing base color, weave texture, lower border, and repeating body motifs.',
        isRequired: true,
        sortOrder: 0,
        sampleImageUrl: null,
      },
      {
        id: 'pallu',
        name: 'Pallu (Anchal) & Border',
        description: 'End-piece pallu weave/artwork and edge finish (auto-scanned for tassels vs flat hem).',
        isRequired: true,
        sortOrder: 1,
        sampleImageUrl: null,
      },
      {
        id: 'blouse',
        name: 'Blouse Piece / Swatch',
        description: 'Attached blouse fabric or contrast swatch (locked across all poses with elbow-length sleeves).',
        isRequired: false,
        sortOrder: 2,
        sampleImageUrl: null,
      },
    ],
    customOptions: [
      {
        id: 'saree_blouse_design',
        label: 'Blouse Design',
        optionType: 'radio',
        choices: [
          'Matching Plain Silk',
          'Heavy Embroidered Maggam Work',
          'Contrast Velvet Contemporary',
          'Classic Elbow-Sleeve Round Neck',
        ],
        sortOrder: 0,
      },
      {
        id: 'saree_drape_style',
        label: 'Drape & Pallu Style',
        optionType: 'radio',
        choices: [
          'Traditional Nivi Drape (Pleated)',
          'Open Floating Grand Pallu',
          'Classic Shoulder Pleats',
        ],
        sortOrder: 1,
      },
      {
        id: 'saree_jewellery',
        label: 'Jewellery Styling',
        optionType: 'radio',
        choices: [
          'Minimal / No Jewellery',
          'Light Elegant Jewellery',
          'Heavy Bridal / Antique Jewellery',
        ],
        sortOrder: 2,
      },
    ],
    poses: CATEGORY_POSES_MAP.saree.map((p, idx) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      promptSnippet: p.promptSnippet,
      category: p.category || 'standing',
      purpose: null,
      fabricFocus: null,
      previewImage: p.defaultSample || null,
      sortOrder: idx,
    })),
  },
  {
    id: 'kurti',
    legacyIds: ['kurta'],
    name: 'Kurti / Kurta Set',
    slug: 'kurti',
    tagline: 'Tailored Indian kurta ensemble with bottom wear & dupatta styling',
    description:
      'Code-managed kurti and salwar-suit pipeline enforcing tailored collar/yoke embroidery, 3/4 sleeves, side slits, bottom wear, and dupatta flow with strict non-saree garment rules.',
    garmentType: 'map fabric to the kurta body, yoke panel, sleeves, bottom pant, and dupatta',
    coverImage: '/poses/kurti_pose_1.jpg',
    isActive: true,
    sortOrder: 1,
    allowModelSelection: true,
    defaultModelId: null,
    allowedModelIds: null,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    cameraSettings: DEFAULT_CAMERA_SETTINGS,
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    imageSlots: [
      {
        id: 'kurti_front',
        name: 'Kurti Front / Main Body',
        description: 'Lay flat or hung, showing the full front design, neckline yoke, and hem.',
        isRequired: true,
        sortOrder: 0,
        sampleImageUrl: null,
      },
      {
        id: 'bottom_pant',
        name: 'Pant / Bottoms Swatch',
        description: 'Fabric for the accompanying straight pants, palazzo, or churidar (if any).',
        isRequired: false,
        sortOrder: 1,
        sampleImageUrl: null,
      },
      {
        id: 'dupatta',
        name: 'Dupatta Swatch',
        description: 'Fabric and border for the accompanying dupatta (if any).',
        isRequired: false,
        sortOrder: 2,
        sampleImageUrl: null,
      },
    ],
    customOptions: [
      {
        id: 'kurti_bottom_wear',
        label: 'Bottom Wear Style',
        optionType: 'radio',
        choices: ['Straight Pants', 'Palazzos', 'Churidar', 'No Bottoms (Dress Style)'],
        sortOrder: 0,
      },
      {
        id: 'kurti_dupatta_draping',
        label: 'Dupatta Draping',
        optionType: 'radio',
        choices: ['One Shoulder Pinned', 'Both Shoulders Open', 'Neck Wrap', 'No Dupatta'],
        sortOrder: 1,
      },
      {
        id: 'kurti_jewellery',
        label: 'Jewellery Styling',
        optionType: 'radio',
        choices: ['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Festive Statement Earrings'],
        sortOrder: 2,
      },
    ],
    poses: CATEGORY_POSES_MAP.kurti.map((p, idx) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      promptSnippet: p.promptSnippet,
      category: p.category || 'standing',
      purpose: null,
      fabricFocus: null,
      previewImage: p.defaultSample || null,
      sortOrder: idx,
    })),
  },
];

export function getHardcodedTemplate(idOrSlug: string): HardcodedTemplate | null {
  if (!idOrSlug) return null;
  const key = idOrSlug.trim();
  const lk = key.toLowerCase();
  return (
    HARDCODED_TEMPLATES.find(
      (t) =>
        t.id === key ||
        t.slug.toLowerCase() === lk ||
        t.legacyIds?.some((alias) => alias.toLowerCase() === lk)
    ) || null
  );
}

export function listHardcodedTemplates(): HardcodedTemplate[] {
  return HARDCODED_TEMPLATES;
}

/**
 * Ensures each hardcoded template has a matching GarmentTemplate row in Postgres
 * so CustomerOrder foreign keys and toggle states (isActive / allowModelSelection) stay intact.
 * Preserves any existing DB row ID for the same slug.
 */
export async function listMergedHardcodedTemplates() {
  const dbTemplates = await prisma.garmentTemplate.findMany({
    include: {
      _count: { select: { orders: true } },
    },
  });

  const results = [];
  for (const hc of HARDCODED_TEMPLATES) {
    let dbMatch = dbTemplates.find(
      (d) =>
        d.id === hc.id ||
        d.slug.toLowerCase() === hc.slug.toLowerCase() ||
        hc.legacyIds?.some((alias) => alias.toLowerCase() === d.slug.toLowerCase() || alias === d.id)
    );

    if (!dbMatch) {
      try {
        const created = await prisma.garmentTemplate.create({
          data: {
            id: hc.id,
            name: hc.name,
            slug: hc.slug,
            tagline: hc.tagline,
            coverImage: hc.coverImage,
            description: hc.description,
            garmentType: hc.garmentType,
            systemPrompt: hc.systemPrompt,
            cameraSettings: hc.cameraSettings,
            negativePrompt: hc.negativePrompt,
            isActive: hc.isActive,
            sortOrder: hc.sortOrder,
            allowModelSelection: hc.allowModelSelection,
            defaultModelId: hc.defaultModelId,
          },
          include: { _count: { select: { orders: true } } },
        });
        dbMatch = created;
      } catch {
        // Ignore race condition or constraint if already seeded concurrently
      }
    }

    results.push({
      ...hc,
      id: dbMatch?.id || hc.id,
      isActive: dbMatch ? dbMatch.isActive : hc.isActive,
      allowModelSelection: dbMatch ? dbMatch.allowModelSelection : hc.allowModelSelection,
      defaultModelId: dbMatch?.defaultModelId ?? hc.defaultModelId,
      allowedModelIds: (dbMatch?.allowedModelIds as string[] | null) ?? hc.allowedModelIds,
      coverImage: dbMatch?.coverImage || hc.coverImage,
      createdAt: dbMatch?.createdAt?.toISOString() || new Date(0).toISOString(),
      _count: dbMatch?._count || { orders: 0 },
      isHardcoded: true,
    });
  }

  return results;
}

export async function getMergedHardcodedTemplate(idOrSlug: string) {
  // 1. Check direct hardcoded match first
  let hc = getHardcodedTemplate(idOrSlug);

  // 2. Check DB in case a legacy DB ID maps to a hardcoded slug (e.g. a different DB ID for 'saree')
  const dbRecord = await prisma.garmentTemplate.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      imageSlots: { orderBy: { sortOrder: 'asc' } },
      customOptions: { orderBy: { sortOrder: 'asc' } },
      poses: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!hc && dbRecord) {
    hc = getHardcodedTemplate(dbRecord.slug);
  }

  if (hc) {
    return {
      ...hc,
      id: dbRecord?.id || hc.id,
      isActive: dbRecord ? dbRecord.isActive : hc.isActive,
      allowModelSelection: dbRecord ? dbRecord.allowModelSelection : hc.allowModelSelection,
      defaultModelId: dbRecord?.defaultModelId ?? hc.defaultModelId,
      allowedModelIds: (dbRecord?.allowedModelIds as string[] | null) ?? hc.allowedModelIds,
      coverImage: dbRecord?.coverImage || hc.coverImage,
      isHardcoded: true,
    };
  }

  // Fallback for any custom legacy template already in DB
  if (dbRecord) {
    return {
      ...dbRecord,
      isHardcoded: false,
    };
  }

  return null;
}

/**
 * Resolves a templateId (id or slug) to a valid GarmentTemplate DB row ID for CustomerOrder FKs.
 */
export async function resolveOrEnsureTemplateDbId(idOrSlug: string): Promise<string> {
  const existing = await prisma.garmentTemplate.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  if (existing) return existing.id;

  const hc = getHardcodedTemplate(idOrSlug);
  if (hc) {
    const bySlug = await prisma.garmentTemplate.findUnique({
      where: { slug: hc.slug },
      select: { id: true },
    });
    if (bySlug) return bySlug.id;

    const created = await prisma.garmentTemplate.create({
      data: {
        id: hc.id,
        name: hc.name,
        slug: hc.slug,
        tagline: hc.tagline,
        coverImage: hc.coverImage,
        description: hc.description,
        garmentType: hc.garmentType,
        systemPrompt: hc.systemPrompt,
        cameraSettings: hc.cameraSettings,
        negativePrompt: hc.negativePrompt,
        isActive: hc.isActive,
        sortOrder: hc.sortOrder,
        allowModelSelection: hc.allowModelSelection,
        defaultModelId: hc.defaultModelId,
      },
      select: { id: true },
    });
    return created.id;
  }

  return idOrSlug;
}
