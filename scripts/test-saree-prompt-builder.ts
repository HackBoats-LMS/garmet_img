import { buildSareePrompt, BuildSareePromptInput } from '../app/utils/sareePromptBuilder';

function runTests() {
  console.log('====================================================');
  console.log('RUNNING SAREE PROMPT BUILDER VERIFICATION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, msg: string) => {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      passedTests++;
    }
  };

  // Test Matrix: Layout modes x Border modes x optional slots
  const layoutModes = ['', 'delicate_buttis', 'dual_tier_pleats'];
  const borderModes = ['symmetric', 'different_borders', 'lower_border_only'];

  for (const layout of layoutModes) {
    for (const border of borderModes) {
      // Variations of slots: minimal vs all filled
      const slotVariations = [
        {
          name: 'minimal slots (body + pallu only)',
          slots: {
            body: 'http://img/body.jpg',
            pallu: 'http://img/pallu.jpg',
          },
        },
        {
          name: 'all slots filled',
          slots: {
            body: 'http://img/body.jpg',
            pallu: 'http://img/pallu.jpg',
            upper_border: 'http://img/upper_border.jpg',
            macro_motif: 'http://img/macro.jpg',
            pleat_art: 'http://img/pleat.jpg',
            border_ribbon: 'http://img/ribbon.jpg',
            blouse: 'http://img/blouse.jpg',
          },
        },
        {
          name: 'only body + pallu + macro_motif (no blouse, no chest border)',
          slots: {
            body: 'http://img/body.jpg',
            pallu: 'http://img/pallu.jpg',
            macro_motif: 'http://img/macro.jpg',
          },
        },
        {
          name: 'complex saree with lower skirt art and ribbon (no macro motif)',
          slots: {
            body: 'http://img/body.jpg',
            pallu: 'http://img/pallu.jpg',
            pleat_art: 'http://img/pleat.jpg',
            border_ribbon: 'http://img/ribbon.jpg',
          },
        },
      ];

      for (const variation of slotVariations) {
        const input: BuildSareePromptInput = {
          sareeLayoutMode: layout,
          borderSelection: border,
          uploadedImages: variation.slots,
          modelFaceUrl: 'http://img/face.jpg',
          posePreviewUrl: null,
          modelAnchor: 'an elegant Indian model',
          poseSnippet: 'Standing confident studio pose.',
          backgroundSetting: 'Classic wooden courtyard.',
          lightingCameraSetting: 'Hasselblad 8k photography.',
        };

        const result = buildSareePrompt(input);

        // 1. Check numbering has NO gaps
        for (let i = 0; i < result.manifest.length; i++) {
          assert(
            result.manifest[i].imageNumber === i + 1,
            `Gaps in numbering: expected ${i + 1}, got ${result.manifest[i].imageNumber} in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
        }

        // 2. Check only ONE border block appears
        const borderBlocksCount = [
          result.finalPrompt.includes('[BORDER ARCHITECTURE: SYMMETRIC BORDERS]:'),
          result.finalPrompt.includes('[BORDER ARCHITECTURE: DUAL CONTRASTING BORDERS]:'),
          result.finalPrompt.includes('[BORDER ARCHITECTURE: LOWER BORDER ONLY'),
        ].filter(Boolean).length;

        assert(
          borderBlocksCount === 1,
          `Expected exactly 1 border block, found ${borderBlocksCount} in [${layout || 'default'} x ${border} x ${variation.name}]`
        );

        // 3. Check no text for an empty slot leaks into the prompt
        if (!variation.slots.macro_motif) {
          assert(
            !result.finalPrompt.includes('micro-motif close-up'),
            `Leaked macro_motif manifest when not uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
          assert(
            result.finalPrompt.includes('Motifs: Reproduce only the repeating buttis visible in Image 1.'),
            `Missing absent-slot rule for macro_motif in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
        } else {
          assert(
            result.finalPrompt.includes('micro-motif close-up'),
            `Missing macro_motif manifest when uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
          assert(
            !result.finalPrompt.includes('Motifs: Reproduce only the repeating buttis visible in Image 1.'),
            `Leaked absent-slot rule when macro_motif IS uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
        }

        if (!variation.slots.blouse) {
          assert(
            !result.finalPrompt.includes('blouse fabric. Tailored fitted blouse matching this fabric.'),
            `Leaked blouse manifest when not uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
          assert(
            result.finalPrompt.includes('Blouse: Elegantly tailored fitted blouse'),
            `Missing default blouse behavior when blouse not uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
        } else {
          assert(
            result.finalPrompt.includes('blouse fabric. Tailored fitted blouse matching this fabric.'),
            `Missing blouse manifest when blouse uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
          assert(
            !result.finalPrompt.includes('Blouse: Elegantly tailored fitted blouse'),
            `Leaked default blouse behavior when blouse IS uploaded in [${layout || 'default'} x ${border} x ${variation.name}]`
          );
        }

        // 4. Check no hallucination/marketing words leak
        assert(!result.finalPrompt.toLowerCase().includes('kurti'), 'Prompt must never contain "kurti"');
        assert(!result.finalPrompt.includes('₹'), 'Prompt must never contain price symbols');
        assert(!result.finalPrompt.toLowerCase().includes('the morning drape'), 'Prompt must never contain marketing copy');
      }
    }
  }

  console.log(`✅ All ${totalTests} matrix assertions passed successfully!\n`);

  console.log('======================================================================');
  console.log('SAMPLE FINAL PROMPT 1: Complex Saree + Different Borders (All Slots Filled)');
  console.log('======================================================================');
  const sample1 = buildSareePrompt({
    sareeLayoutMode: 'dual_tier_pleats',
    borderSelection: 'different_borders',
    uploadedImages: {
      body: 'https://r2.storage.com/upper_body.jpg',
      pallu: 'https://r2.storage.com/pallu.jpg',
      upper_border: 'https://r2.storage.com/upper_border.jpg',
      macro_motif: 'https://r2.storage.com/macro_zoom.jpg',
      pleat_art: 'https://r2.storage.com/peacock_lower_skirt.jpg',
      border_ribbon: 'https://r2.storage.com/edge_ribbon.jpg',
      blouse: 'https://r2.storage.com/blouse.jpg',
    },
    modelFaceUrl: 'https://r2.storage.com/model_face.jpg',
    modelAnchor: 'a radiant Indian female fashion model with natural skin texture, serene facial expression, and elegant posture',
    poseSnippet: 'Full-length front standing portrait at eye-level, poised and dignified posture.',
    backgroundSetting: 'Living room verandah with clean natural architecture, soft natural daylight.',
    lightingCameraSetting: 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, razor-sharp focus, crisp details, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting.',
  });
  console.log(sample1.finalPrompt);
  console.log('\nOrdered image count:', sample1.manifest.length);

  console.log('\n======================================================================');
  console.log('SAMPLE FINAL PROMPT 2: Complex Saree + Lower Border Only (No Micro-Motif)');
  console.log('======================================================================');
  const sample2 = buildSareePrompt({
    sareeLayoutMode: 'dual_tier_pleats',
    borderSelection: 'lower_border_only',
    uploadedImages: {
      body: 'https://r2.storage.com/upper_body.jpg',
      pallu: 'https://r2.storage.com/pallu.jpg',
      pleat_art: 'https://r2.storage.com/peacock_lower_skirt.jpg',
      border_ribbon: 'https://r2.storage.com/edge_ribbon.jpg',
    },
    modelFaceUrl: 'https://r2.storage.com/model_face.jpg',
    modelAnchor: 'a radiant Indian female fashion model with natural skin texture, serene facial expression, and elegant posture',
    poseSnippet: 'Full-length front standing portrait at eye-level, poised and dignified posture.',
    backgroundSetting: 'Courtyard with traditional heritage pillars, warm festive morning daylight.',
    lightingCameraSetting: 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, razor-sharp focus, crisp details, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting.',
  });
  console.log(sample2.finalPrompt);
  console.log('\nOrdered image count:', sample2.manifest.length);
}

runTests();
