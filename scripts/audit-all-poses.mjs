import { buildSareePrompt } from '../app/utils/sareePromptBuilder.ts';

const POSES = [
  {
    id: 'saree_pose_mirror',
    name: '1. The Mirror Moment',
    promptSnippet: 'Over-the-shoulder medium shot angled 45 degrees behind the model, looking past her shoulder into a vintage warm teakwood dressing mirror. Strict optical reflection physics: the mirror reflection cleanly captures her serene, poised face looking directly into her own eyes in the glass with a quiet confident half-smile. Her hand is gracefully raised checking the pallu pin at her shoulder, and the reflection geometrically mirrors her hand, gold bangles, and the saree border with exact optical symmetry and matching warm morning ambient lighting. Zero reflection distortion, single coherent identity.',
  },
  {
    id: 'saree_pose_front',
    name: '2. The Classic Front Stand',
    promptSnippet: 'Full-length front standing portrait at eye-level, subtle 15-degree body turn towards soft natural light. Left hand resting naturally by her side, right hand gently holding the woven pallu edge at waist height to clearly display the full width of the authentic saree border, crisp vertical waist pleats, and clean floor-length fall of the saree. Poised, dignified expression of a modern Indian woman.',
  },
  {
    id: 'saree_pose_walk',
    name: '3. The Confident Walk-In',
    promptSnippet: 'Full-length candid editorial stride, eye-level. The model is mid-step walking forward along a sunlit corridor or veranda, head held high with a grounded capable expression. Her hand gently steadies the pallu against her waist while her arm sways naturally with her walk. The saree pleats and pallu show realistic gravity, weight, and fluid fabric motion.',
  },
  {
    id: 'saree_pose_seated',
    name: '4. The Verandah Hostess',
    promptSnippet: 'Medium shot, seated gracefully on a classic teak armchair in a sunlit living room or verandah. The saree pleats are neatly and naturally fanned across her lap and legs, with the all-over body fabric motifs and printed pattern clearly and continuously visible across the entire lap, thighs, and every pleat from waist to hem (absolutely no plain, solid, blank, or unprinted dark fabric patches on the lap). Holding a porcelain tea cup or resting hand on armrest, wearing delicate gold bangles, looking slightly off-camera with a warm, welcoming smile.',
  },
  {
    id: 'saree_pose_glance',
    name: '5. The Glance',
    promptSnippet: 'Close-up chest-up portrait, soft gaze looking just past the camera, creating a warm human connection. One hand lightly raised near the collarbone or touching a delicate earring. Intimate focus on the authentic saree texture across the chest, the authentic reference border, and subtle natural skin texture.',
  },
  {
    id: 'saree_pose_pallu_back',
    name: '6. The Pallu Cascade',
    promptSnippet: 'Three-quarter rear portrait view. The model is standing poised, gently turning her head to look back towards the camera over her shoulder. Prominently showcases the full, elegant fall of the pallu cascading down her back, displaying the complete decorative artwork from the Pallu reference swatch framed by a continuous, unbroken lengthwise border along the outer drape, along with the fitted blouse back neckline, dori tassels, and neat hair updo adorned with fresh jasmine (gajra).',
  },
];

console.log('AUDITING ALL 6 SAREE POSES FOR DELICATE BUTTIS & LOWER BORDER ONLY\n');

for (const pose of POSES) {
  console.log(`========================================================================`);
  console.log(`POSE: ${pose.name} (${pose.id})`);
  console.log(`========================================================================`);
  const res = buildSareePrompt({
    sareeLayoutMode: 'delicate_buttis',
    borderSelection: 'lower_border_only',
    uploadedImages: {
      body: 'https://example.com/body.jpg',
      macro_motif: 'https://example.com/macro.jpg',
      pallu: 'https://example.com/pallu.jpg',
    },
    poseSnippet: pose.promptSnippet,
  });

  const prompt = res.finalPrompt;
  const poseSection = prompt.split('\n\n')[0];
  console.log('--- POSE BLOCK ---');
  console.log(poseSection);
  console.log('\n--- BORDER BLOCK ---');
  console.log(res.borderBlockText);
  console.log('\n');
}

