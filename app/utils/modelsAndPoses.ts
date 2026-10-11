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
      id: 'saree_pose_mirror',
      number: 1,
      category: 'seated',
      name: '1. The Mirror Moment',
      description: 'Over-the-shoulder dressing mirror check — 30-sec certainty reset before stepping out',
      promptSnippet: 'Over-the-shoulder medium shot angled 45 degrees behind the model, looking past her shoulder into a vintage warm teakwood dressing mirror. Strict optical reflection physics: the mirror reflection cleanly captures her serene, poised face looking directly into her own eyes in the glass with a quiet confident half-smile. Her hand is gracefully raised checking the pallu pin at her shoulder, and the reflection geometrically mirrors her hand, gold bangles, and the saree border with exact optical symmetry and matching warm morning ambient lighting. Zero reflection distortion, single coherent identity.',
      defaultSample: '/poses/saree_pose_mirror.jpg',
    },
    {
      id: 'saree_pose_front',
      number: 2,
      category: 'standing',
      name: '2. The Classic Front Stand',
      description: 'Full head-to-toe front standing catalog view — showing full silhouette and pleats fall',
      promptSnippet: 'Full-length front standing portrait at eye-level, subtle 15-degree body turn towards soft natural light. Left hand resting naturally by her side, right hand gently holding the woven pallu edge at waist height to clearly display the full width of the zari border, crisp vertical waist pleats, and clean floor-length fall of the saree. Poised, dignified expression of a modern Indian woman.',
      defaultSample: '/poses/saree_pose_front.jpg',
    },
    {
      id: 'saree_pose_walk',
      number: 3,
      category: 'standing',
      name: '3. The Confident Walk-In',
      description: 'Mid-step editorial stride — natural fabric flow and confident posture',
      promptSnippet: 'Full-length candid editorial stride, eye-level. The model is mid-step walking forward along a sunlit corridor or veranda, head held high with a grounded capable expression. Her hand gently steadies the pallu against her waist while her arm sways naturally with her walk. The saree pleats and pallu show realistic gravity, weight, and fluid fabric motion.',
      defaultSample: '/poses/saree_pose_2.jpg',
    },
    {
      id: 'saree_pose_seated',
      number: 4,
      category: 'seated',
      name: '4. The Verandah Hostess',
      description: 'Seated gracefully with teacup in sunlit living room — natural seated pleat fan',
      promptSnippet: 'Medium shot, seated gracefully on a classic teak armchair in a sunlit living room or verandah. The saree pleats are neatly and naturally fanned across her lap and legs, showing how the fabric drapes comfortably in real life. Holding a porcelain tea cup or resting hand on armrest, wearing delicate gold bangles, looking slightly off-camera with a warm, welcoming smile.',
      defaultSample: '/poses/saree_pose_3.jpg',
    },
    {
      id: 'saree_pose_glance',
      number: 5,
      category: 'detail',
      name: '5. The Glance',
      description: 'Waist-up portrait with soft glance — close-up on neckline and chest motifs',
      promptSnippet: 'Close-up chest-up portrait, soft gaze looking just past the camera, creating a warm human connection. One hand lightly raised near the collarbone or touching a delicate earring. Intimate focus on the rich saree texture across the chest, the pallu border, and subtle natural skin texture.',
      defaultSample: '/poses/saree_pose_4.jpg',
    },
    {
      id: 'saree_pose_pallu_back',
      number: 6,
      category: 'detail',
      name: '6. The Pallu Cascade',
      description: 'Three-quarter rear view — showing full pallu back design and blouse back cut',
      promptSnippet: 'Three-quarter rear portrait view. The model is standing poised, gently turning her head to look back over her left shoulder towards the camera. Prominently showcases the full majestic fall of the heavy zari pallu cascading down her back, along with the fitted blouse back neckline, dori tassels, and neat hair updo adorned with fresh jasmine (gajra).',
      defaultSample: '/poses/saree_pose_5.jpg',
    },
  ],
  kurti: [
    {
      id: 'kurti_pose_1',
      number: 1,
      category: 'standing',
      name: '1. Professional Stride',
      description: 'Everyday capable stride with leather tote bag — professional connoisseur workday',
      promptSnippet: 'Full-body dynamic walking pose along an upscale outdoor walkway. Model carrying a leather tote bag, kurti side slits fluttering naturally, showing kurti length and pant fall.',
      defaultSample: '/poses/kurti_pose_1.jpg',
    },
    {
      id: 'kurti_pose_2',
      number: 2,
      category: 'standing',
      name: '2. Courtyard Festive Walk',
      description: 'Full drape walking stride with dupatta draped gracefully across both shoulders',
      promptSnippet: 'Full-length walking pose in a sunlit heritage courtyard. The model walks forward with dupatta draped over arms and shoulders, showcasing bottom pant and kurti hemline.',
      defaultSample: '/poses/kurti_pose_2.jpg',
    },
    {
      id: 'kurti_pose_3',
      number: 3,
      category: 'seated',
      name: '3. Boardroom & Lounge Seated',
      description: 'Seated comfortably on armchair with document portfolio — relaxed capable composure',
      promptSnippet: 'Medium shot, seated gracefully in a modern lounge armchair holding a document sleeve, showing how the kurti slits fall and pant comfort when seated.',
      defaultSample: '/poses/kurti_pose_3.jpg',
    },
    {
      id: 'kurti_pose_4',
      number: 4,
      category: 'detail',
      name: '4. Neckline & Embroidery Detail',
      description: 'Close-up chest portrait showing collar, placket buttons, and chest embroidery',
      promptSnippet: 'Waist-up portrait shot, clear focus on kurti neckline embroidery, placket, and collar craft details with a warm, genuine smile.',
      defaultSample: '/poses/kurti_pose_4.jpg',
    },
  ],
};

export function getPosesForCategory(category: string): PoseDefinition[] {
  return CATEGORY_POSES_MAP[category] || CATEGORY_POSES_MAP.saree;
}

export const CORE_4_POSES = CATEGORY_POSES_MAP.saree.slice(0, 4);
export const CORE_5_POSES = CATEGORY_POSES_MAP.saree.slice(0, 5);
export const CATALOG_15_POSES = CATEGORY_POSES_MAP.saree;
