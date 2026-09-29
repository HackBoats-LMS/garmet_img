const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const kurti = await prisma.garmentTemplate.create({
    data: {
      name: 'Kurti & Ethnic Suit Sets',
      slug: 'kurti',
      tagline: 'Straight cuts, Anarkalis, and Sharara sets',
      coverImage: '/kurti_model_4k.jpg',
      description: 'High-definition AI photoshoot for Kurtis, Anarkalis, and Suit sets. Captures delicate threadwork, yoke embroidery, print flow, and bottom pairings.',
      systemPrompt: 'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style. The garment is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, and intricate embroidery.',
      negativePrompt: 'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses',
      cameraSettings: 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, smooth natural bokeh depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting.',
      isActive: true,
      sortOrder: 2,
      allowModelSelection: true,
      
      imageSlots: {
        create: [
          {
            id: 'main_body',
            name: 'Kurti Body & Flare Print',
            description: 'Main silhouette, flare/slit style, length, and overall fabric print',
            isRequired: true,
            sortOrder: 1
          },
          {
            id: 'yoke_neckline',
            name: 'Front Yoke & Neckline Embroidery',
            description: 'Detailed front chest yoke, collar, gota patti or threadwork design',
            isRequired: true,
            sortOrder: 2
          },
          {
            id: 'bottom_pant',
            name: 'Bottom / Pant / Palazzo Style',
            description: 'Pants, palazzo, cigarette trousers, or sharara bottom details',
            isRequired: false,
            sortOrder: 3
          }
        ]
      },

      poses: {
        create: [
          {
            name: '1. Front Standing (Full Set)',
            description: 'Full body straight standing pose displaying the kurti length and bottom pairing',
            promptSnippet: 'full body front standing pose, straight elegant posture, showing full length of kurti and bottom wear',
            category: 'kurti',
            sortOrder: 1,
            previewImage: '/kurti_body.jpg'
          },
          {
            name: '2. Yoke & Neckline Close-up',
            description: 'Upper torso portrait focusing on chest yoke embroidery and neckline',
            promptSnippet: 'waist up medium portrait shot, looking at camera, clear focus on neckline, collar, and chest yoke embroidery',
            category: 'kurti',
            sortOrder: 2,
            previewImage: '/kurti_yoke.jpg'
          }
        ]
      }
    }
  });
  console.log('Successfully added Kurti template:', kurti.id);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
