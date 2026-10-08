import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.garmentTemplate.findMany({
    include: { poses: true }
  });

  const newPoses = [
    {
      name: 'Getting Ready - Putting on Earring',
      description: 'Elegant shot in front of a mirror putting on earrings',
      promptSnippet: 'Mid-shot of the model in front of a warm-lit vintage mirror, getting ready. She is delicately putting on a traditional jhumka earring, looking gracefully at her reflection, highlighting the rich saree blouse and border draped over her shoulder.',
      purpose: 'Festive premium look, highlights earrings and blouse neckline',
      category: 'seated'
    },
    {
      name: 'Getting Ready - Adjusting Necklace',
      description: 'Close up of hands clasping necklace behind neck',
      promptSnippet: 'Close-up portrait of the model getting ready for a festive occasion. Both her hands are gently clasping the back of her traditional antique necklace to secure it. Her gaze is softly lowered. The intricate zari work of the saree is beautifully visible across her chest.',
      purpose: 'Intimate getting ready shot, highlights neckline and front drape',
      category: 'detail'
    },
    {
      name: 'Festive Mirror Pose',
      description: 'Adjusting hair/gajra near a mirror',
      promptSnippet: 'Medium shot of the model standing near a beautiful wooden mirror frame, adjusting a flower gajra in her hair. The elegant full drape of her premium silk garment flows naturally downwards. Warm festive lighting.',
      purpose: 'Shows full drape with a natural, candid festive activity',
      category: 'standing'
    },
    {
      name: 'Adding Bangles - Candid',
      description: 'Joyful candid shot putting on bangles',
      promptSnippet: 'Candid medium shot. The model is playfully sliding glass and gold bangles onto her wrist, looking down with a slight, joyful smile. Her garment falls naturally, emphasizing the festive, intimate getting ready moment.',
      purpose: 'Highlights sleeves and overall joyous vibe',
      category: 'seated'
    }
  ];

  for (const template of templates) {
    if (template.slug.includes('saree') || template.slug.includes('kurti')) {
      const maxSortOrder = template.poses.reduce((max, opt) => Math.max(max, opt.sortOrder), -1);
      
      const posesToCreate = newPoses.map((p, i) => ({
        templateId: template.id,
        name: p.name,
        description: p.description,
        promptSnippet: p.promptSnippet,
        purpose: p.purpose,
        category: p.category,
        sortOrder: maxSortOrder + 1 + i
      }));

      await prisma.poseTemplate.createMany({
        data: posesToCreate
      });
      console.log(`Added ${posesToCreate.length} new getting-ready poses to template: ${template.name}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
