import { buildSareePrompt } from '../app/utils/sareePromptBuilder.ts';

const poses = [
  { id: 'front', name: 'Front Stand', snippet: 'Full-length front standing portrait at eye-level, subtle 15-degree body turn towards soft natural light. Left hand resting naturally by her side, right hand gently holding the woven pallu edge at waist height to clearly display the full width of the authentic saree border, crisp vertical waist pleats, and clean floor-length fall of the saree. Poised, dignified expression of a modern Indian woman.' },
  { id: 'walk', name: 'Confident Walk-In', snippet: 'Full-length candid editorial stride, eye-level. The model is mid-step walking forward along a sunlit corridor or veranda, head held high with a grounded capable expression. Her hand gently steadies the pallu against her waist while her arm sways naturally with her walk. The saree pleats and pallu show realistic gravity, weight, and fluid fabric motion.' },
  { id: 'pallu', name: 'Pallu Cascade', snippet: 'Three-quarter rear portrait view. The model is standing poised, gently turning her head to look back towards the camera over her shoulder. Prominently showcases the full, elegant fall of the pallu cascading down her back, displaying the complete decorative artwork from the Pallu reference swatch framed by a continuous, unbroken lengthwise border along the outer drape, along with the fitted blouse back neckline, dori tassels, and neat hair updo adorned with fresh jasmine (gajra).' }
];

for (const p of poses) {
  const res = buildSareePrompt({
    sareeLayoutMode: 'delicate_buttis',
    borderSelection: 'lower_border_only',
    uploadedImages: {
      body: 'https://example.com/body.jpg',
      macro_motif: 'https://example.com/macro.jpg',
      pallu: 'https://example.com/pallu.jpg',
    },
    poseSnippet: p.snippet,
  });
  console.log('\n======================================================');
  console.log(`POSE: ${p.name}`);
  console.log('======================================================');
  console.log(res.finalPrompt);
}

