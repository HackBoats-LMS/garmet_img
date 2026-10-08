const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // First, delete existing kurti template if it exists to recreate it
  await prisma.garmentTemplate.deleteMany({
    where: { slug: 'kurti' }
  });

  const kurti = await prisma.garmentTemplate.create({
    data: {
      name: 'Kurti & Ethnic Suit Sets',
      slug: 'kurti',
      tagline: 'Straight cuts, Anarkalis, and Sharara sets',
      coverImage: '/kurti_model_4k.jpg',
      description: 'High-definition AI photoshoot for Kurtis, Anarkalis, and Suit sets. Captures delicate threadwork, print flow, and bottom pairings.',
      systemPrompt: 'Commercial fashion photoshoot for luxury Indian garments brand. Masterpiece, ultra-sharp focus, photorealistic 8k resolution, editorial Vogue India and Harpers Bazaar style. The garment is worn with realistic physics-accurate draping, crisp fabric folds, micro-weave texture fidelity, and intricate embroidery.',
      negativePrompt: 'bad anatomy, deformed fingers, extra limbs, mutated hands, plastic skin, doll-like face, mannequin, oversaturated cartoon, 3d render, CGI, digital drawing, blur, low resolution, artifacts, poorly drawn face, asymmetric eyes, distorted fabric patterns, watermark, signature, blurry text, cropped head, unnatural poses',
      cameraSettings: 'Shot on Hasselblad H6D-100c medium format camera paired with HC 100mm f/2.2 portrait lens. Superb optical sharpness, smooth natural bokeh depth of field, 8K UHD commercial fashion catalogue photography, true color reproduction, zero digital artifacting.',
      isActive: true,
      sortOrder: 2,
      allowModelSelection: true,
      
      imageSlots: {
        create: [
          {
            id: 'kurti_body',
            name: 'Kurti Body',
            description: 'Main silhouette, flare/slit style, length, and overall fabric print',
            isRequired: true,
            sortOrder: 1
          },
          {
            id: 'kurti_pant',
            name: 'Pant / Bottom',
            description: 'Pants, palazzo, cigarette trousers, or sharara bottom details',
            isRequired: false,
            sortOrder: 2
          },
          {
            id: 'kurti_dupatta',
            name: 'Dupatta',
            description: 'Dupatta fabric, border, and print details',
            isRequired: false,
            sortOrder: 3
          }
        ]
      },

      customOptions: {
        create: [
          {
            label: 'Jewellery Styling',
            optionType: 'radio',
            choices: JSON.stringify(['Minimal / No Jewellery', 'Light Elegant Jewellery', 'Heavy Bridal / Antique Jewellery']),
            sortOrder: 1
          }
        ]
      },

      poses: {
        create: [
          {
            name: '1. Full Standing - Confident',
            description: 'Full body straight standing pose displaying the kurti length and bottom pairing',
            promptSnippet: 'full body front standing pose, confident elegant posture with one hand on hip, showing full length of kurti and bottom wear',
            category: 'kurti',
            sortOrder: 1,
            previewImage: '/kurti_front_stand.jpg'
          },
          {
            name: '2. Walking Motion',
            description: 'Dynamic walking pose to show flare and movement',
            promptSnippet: 'full body dynamic walking pose, fabric gracefully flowing and catching the light, showcasing the flare and cut of the kurti',
            category: 'kurti',
            sortOrder: 2,
            previewImage: '/kurti_walking.jpg'
          },
          {
            name: '3. Seated Elegance',
            description: 'Sitting elegantly showing the bottom and side slits',
            promptSnippet: 'medium wide shot, seated elegantly on a vintage wooden chair or stool, legs crossed gracefully, showing how the kurti slits and pants look when sitting',
            category: 'kurti',
            sortOrder: 3,
            previewImage: '/kurti_seated.jpg'
          },
          {
            name: '4. Upper Torso Details',
            description: 'Waist-up shot focusing on neckline and bodice',
            promptSnippet: 'waist up medium portrait shot, slight angle, clear focus on neckline, collar, and chest embroidery',
            category: 'kurti',
            sortOrder: 4,
            previewImage: '/kurti_torso.jpg'
          }
        ]
      }
    }
  });
  console.log('Successfully added/updated Kurti template:', kurti.id);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
