import { ModelPersona, PoseDefinition } from '@/app/types/stock';

/**
 * 4 Curated Consistent Model Personas based on ICPs
 */
export const CONSISTENT_MODELS: ModelPersona[] = [
  {
    id: 'priyanka',
    name: 'Priyanka',
    tagline: 'Home CEO (Premium)',
    avatarUrl: '/model_priyanka.jpg',
    skinTone: 'Medium to Deep #7D4F33',
    features: 'Composed, gracious private half-smile',
    promptAnchor: 'Consistent identity: Priyanka, a ~42-year-old premium Indian female model, warm medium-deep skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
  },
  {
    id: 'anjali',
    name: 'Anjali',
    tagline: 'Home CEO (Everyday)',
    avatarUrl: '/model_anjali.jpg',
    skinTone: 'Wheatish #C99A6B',
    features: 'Composed, gracious private half-smile',
    promptAnchor: 'Consistent identity: Anjali, a ~37-year-old everyday Indian female model, warm wheatish skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
  },
  {
    id: 'sana',
    name: 'Sana',
    tagline: 'Professional Connoisseur',
    avatarUrl: '/model_sana.jpg',
    skinTone: 'Medium #A97155',
    features: 'Direct, capable, confident half-smile',
    promptAnchor: 'Consistent identity: Sana, a ~33-year-old professional Indian female model, warm medium skin tone, direct capable expression with a confident half-smile, gaze toward where she is going',
  },
  {
    id: 'navya',
    name: 'Navya',
    tagline: 'Professional Connoisseur (Light)',
    avatarUrl: '/model_navya.jpg',
    skinTone: 'Deep #7D4F33',
    features: 'Direct, capable, confident half-smile',
    promptAnchor: 'Consistent identity: Navya, a ~35-year-old professional Indian female model, warm deep skin tone, direct capable expression with a confident half-smile, gaze toward where she is going',
  },
];

/**
 * The 6 Fixed Poses (Fixed Recipes)
 */
export const CATEGORY_POSES_MAP: Record<string, PoseDefinition[]> = {
  saree: [
    {
      id: 'saree_pose_1',
      number: 1,
      category: 'standing',
      name: '1. The Walk-In',
      description: '3/4 body, eye-level, gaze off toward light, hand at the pallu — mid-step',
      promptSnippet: '3/4 body portrait, mid-step walking in, gaze off toward light, hand gently holding the pallu at shoulder',
      defaultSample: '/poses/pose_1.jpg',
    },
    {
      id: 'saree_pose_2',
      number: 2,
      category: 'standing',
      name: '2. The Full Drape',
      description: 'Full-length, walking / mid-step, hand steadying the drape',
      promptSnippet: 'full-length shot, mid-step walking, hand steadying the saree drape, showing fabric fall and movement',
      defaultSample: '/poses/pose_2.jpg',
    },
    {
      id: 'saree_pose_3',
      number: 3,
      category: 'seated',
      name: '3. The Moment',
      description: 'Seated or leaning, chest-height, doing the rooms action',
      promptSnippet: 'medium shot chest-height, seated or gracefully leaning, engaging with the room',
      defaultSample: '/poses/pose_3.jpg',
    },
    {
      id: 'saree_pose_4',
      number: 4,
      category: 'detail',
      name: '4. The Glance',
      description: 'Chest-up, closer, soft gaze just past the camera',
      promptSnippet: 'close-up chest-up portrait, soft gaze looking just past the camera, creating a human connection',
      defaultSample: '/poses/pose_4.jpg',
    },
    {
      id: 'saree_pose_5',
      number: 5,
      category: 'detail',
      name: '5. The Pallu (Back)',
      description: 'Drape from behind, pallu + blouse',
      promptSnippet: 'shot from behind, highlighting the back blouse design and the heavy pallu drape over the shoulder',
      defaultSample: '/poses/pose_5.jpg',
    },
    {
      id: 'saree_pose_6',
      number: 6,
      category: 'detail',
      name: '6. The Cloth',
      description: 'Flatlay on floor, a hand lifting the fabric — REAL photo, never AI',
      promptSnippet: 'REAL PHOTO PLACEHOLDER',
      defaultSample: '/poses/pose_6.jpg',
    },
  ],
  kurti: [
    {
      id: 'kurti_pose_1',
      number: 1,
      category: 'standing',
      name: '1. The Walk-In',
      description: '3/4 body, eye-level, gaze off toward light, hand on tote bag — mid-step',
      promptSnippet: '3/4 body portrait, mid-step walking in, gaze off toward light, hand holding tote bag',
      defaultSample: '/poses/pose_1.jpg',
    },
    {
      id: 'kurti_pose_2',
      number: 2,
      category: 'standing',
      name: '2. The Full Drape',
      description: 'Full-length, walking / mid-step',
      promptSnippet: 'full-length shot, mid-step walking, showing kurti length and pant fall',
      defaultSample: '/poses/pose_2.jpg',
    },
    {
      id: 'kurti_pose_3',
      number: 3,
      category: 'seated',
      name: '3. The Moment',
      description: 'Seated or leaning, chest-height, doing the rooms action',
      promptSnippet: 'medium shot chest-height, seated or gracefully leaning, engaging with the room',
      defaultSample: '/poses/pose_3.jpg',
    },
    {
      id: 'kurti_pose_4',
      number: 4,
      category: 'detail',
      name: '4. The Glance',
      description: 'Chest-up, closer, soft gaze just past the camera',
      promptSnippet: 'close-up chest-up portrait, soft gaze looking just past the camera, creating a human connection',
      defaultSample: '/poses/pose_4.jpg',
    },
    {
      id: 'kurti_pose_5',
      number: 5,
      category: 'detail',
      name: '5. The Back Details',
      description: 'Drape from behind',
      promptSnippet: 'shot from behind, highlighting the back neckline design',
      defaultSample: '/poses/pose_5.jpg',
    },
    {
      id: 'kurti_pose_6',
      number: 6,
      category: 'detail',
      name: '6. The Cloth',
      description: 'Flatlay on floor, a hand lifting the fabric — REAL photo, never AI',
      promptSnippet: 'REAL PHOTO PLACEHOLDER',
      defaultSample: '/poses/pose_6.jpg',
    },
  ],
};

export function getPosesForCategory(category: string): PoseDefinition[] {
  return CATEGORY_POSES_MAP[category] || CATEGORY_POSES_MAP.saree;
}

export const CORE_4_POSES = CATEGORY_POSES_MAP.saree.slice(0, 4);
export const CORE_5_POSES = CATEGORY_POSES_MAP.saree.slice(0, 5);
export const CATALOG_15_POSES = CATEGORY_POSES_MAP.saree;
