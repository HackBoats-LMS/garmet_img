import fs from 'fs';
import { buildSareePrompt } from '../app/utils/sareePromptBuilder.ts';

// Load poses from modelsAndPoses.ts
const content = fs.readFileSync('app/utils/modelsAndPoses.ts', 'utf8');
const sareeMatch = content.match(/saree:\s*\[([\s\S]*?)\]\s*,/);
const poseBlocks = sareeMatch[1].split(/\{\s*id:/).filter(Boolean);

const poses = poseBlocks.map(b => {
  const idMatch = b.match(/['"]([^'"]+)['"]/);
  const nameMatch = b.match(/name:\s*['"]([^'"]+)['"]/);
  const snippetMatch = b.match(/promptSnippet:\s*['"]([\s\S]*?)['"],/);
  return {
    id: idMatch ? idMatch[1] : null,
    name: nameMatch ? nameMatch[1] : null,
    promptSnippet: snippetMatch ? snippetMatch[1] : null,
  };
}).filter(p => p.id && p.promptSnippet);

const testPersonas = [
  {
    id: 'priyanka',
    name: 'Priyanka',
    avatarUrl: '/model_priyanka.jpg',
    promptAnchor: 'Consistent identity: Priyanka, a ~42-year-old premium Indian female model, warm medium-deep skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
  },
  {
    id: 'anjali',
    name: 'Anjali',
    avatarUrl: '/model_anjali.jpg',
    promptAnchor: 'Consistent identity: Anjali, a ~37-year-old everyday Indian female model, warm wheatish skin tone, composed gracious expression with a private half-smile, warm glance off-frame',
  },
  {
    id: 'divya',
    name: 'Divya',
    avatarUrl: '/model_divya.jpg',
    promptAnchor: 'Consistent identity: Divya, a 35-year-old Indian female fashion model, warm wheatish skin tone with natural texture, large brown eyes, long wavy brown hair, serene confident expression, modern elegance',
  }
];

console.log('=================================================================');
console.log(`FOUND ${poses.length} SAREE POSES TO VALIDATE:`);
poses.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.id})`));
console.log('=================================================================\n');

let grandTotalPass = 0;
let grandTotalTests = 0;

for (const persona of testPersonas) {
  console.log(`\n=================================================================`);
  console.log(`TESTING PERSONA: ${persona.name} (${persona.avatarUrl})`);
  console.log(`=================================================================`);

  for (const pose of poses) {
    const result = buildSareePrompt({
      sareeLayoutMode: 'delicate_buttis',
      borderSelection: 'lower_border_only',
      uploadedImages: {
        body: 'https://example.com/body_swatch.jpg',
        macro_motif: 'https://example.com/macro_crop.jpg',
        pallu: 'https://example.com/pallu_swatch.jpg',
      },
      modelFaceUrl: persona.avatarUrl,
      modelAnchor: persona.promptAnchor,
      poseSnippet: pose.promptSnippet,
      swatchAnalysis: {
        fabric_background: {
          base_color: 'cream / off-white silk',
          texture_notes: 'crisp lightweight handloom silk',
        },
        detected_buttis: [
          {
            motif_id: 1,
            shape_type: 'Pink Rosebud Flower',
            structure_details: 'delicate miniature pink embroidered rosebud with tiny green stem and two leaves',
            primary_colors: ['soft pink', 'rose'],
            secondary_colors: ['olive green'],
          },
          {
            motif_id: 2,
            shape_type: 'Triple Spiral Cluster',
            structure_details: 'horizontal row of 3 small circular spiral scrolls in subtle gold-tan metallic thread',
            primary_colors: ['light gold', 'tan metallic'],
          },
        ],
      },
    });

    const prompt = result.finalPrompt;
    const neg = result.negativeExclusions;

    const checks = [
      { name: 'Model Face in Manifest', pass: result.manifest.some(m => m.slotId === 'model_face' && m.role.includes('model face')) },
      { name: 'Persona Anchor in Header', pass: prompt.includes(persona.name) && prompt.includes('strict identity lock') },
      { name: 'Facial Fidelity Directive (Rule 6)', pass: prompt.includes('STRICT FACIAL IDENTITY FIDELITY') && prompt.includes('almond eye shape') },
      { name: 'Face Negatives in Exclusion List', pass: neg.includes('different face') && neg.includes('wrong face') },
      { name: 'Narrow Border Ribbon or Borderless Edge on Chest', pass: prompt.includes('narrow border ribbon') || prompt.includes('narrow finished border ribbon') || prompt.includes('narrow edge ribbon') || prompt.includes('thin narrow') || prompt.includes('borderless self-fabric') },
      { name: 'Broad Skirt & Pallu Drape Border', pass: prompt.includes('BROAD LOWER SKIRT & PALLU DRAPE BORDER') || prompt.includes('LOWER SKIRT HEMLINE') },
      { name: 'Zero Blank Space / Buttis Fill Space', pass: prompt.includes('ZERO EMPTY SPACE') || prompt.includes('zero blank margins') },
      { name: 'Strict 1:1 Miniature Butti Scale', pass: prompt.includes('STRICT UNIFORM MOTIF SCALE') && prompt.includes('1.2 cm - 1.5 cm') },
      { name: 'Horizontal 3-Spiral Orientation (꩜ ꩜ ꩜)', pass: prompt.includes('꩜ ꩜ ꩜') && prompt.includes('3-spiral') },
      { name: 'Alternating Staggered Grid (Swatch 3)', pass: prompt.includes('staggered diagonal') || prompt.includes('alternating') },
      { name: '10x to 15x Wide Negative Spacing (Swatch 3)', pass: prompt.includes('10x to 15x') || prompt.includes('15 cm to 20 cm') },
      { name: 'Zero Hallucinated Diamond/Rhombus', pass: !prompt.toLowerCase().includes('rhombus') && !prompt.toLowerCase().includes('diamond cluster') },
      { name: 'Wide Floral Border in Priority Negatives', pass: neg.includes('wide floral border on chest') || neg.includes('floral garland across bust') },
    ];

    const failed = checks.filter(c => !c.pass);
    grandTotalTests += checks.length;
    grandTotalPass += (checks.length - failed.length);

    console.log(`\n• Pose: ${pose.name} [${pose.id}]`);
    if (failed.length === 0) {
      console.log(`  ✅ ${checks.length}/${checks.length} Quality Checks Passed`);
    } else {
      console.log(`  ❌ Failed Checks: ${failed.map(f => f.name).join(', ')}`);
    }

    // Display sanitized pose preview line
    const poseLine = prompt.split('\n\n')[0].split('\n').find(l => l.startsWith('Pose:'));
    console.log(`  Preview: ${poseLine?.slice(0, 140)}...`);
  }
}

console.log('\n=================================================================');
console.log(`SUMMARY: ${grandTotalPass} / ${grandTotalTests} CHECKS PASSED (${((grandTotalPass / grandTotalTests) * 100).toFixed(1)}%)`);
console.log('=================================================================');
