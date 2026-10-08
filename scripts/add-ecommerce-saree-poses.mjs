import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.garmentTemplate.findMany({
    include: { poses: true },
    where: { slug: 'saree' } // Assuming the slug is 'saree'
  });

  if (templates.length === 0) {
    console.log("Saree template not found.");
    return;
  }

  const template = templates[0];
  const maxSortOrder = template.poses.reduce((max, opt) => Math.max(max, opt.sortOrder), -1);

  const newPoses = [
    {
      name: 'E-commerce: Classic Front Stand',
      description: 'Standard full body front view for catalog',
      promptSnippet: 'Full body front standing pose, looking directly at the camera, straight elegant posture, one hand lightly resting by the side. Shows the full front drape and silhouette of the saree perfectly against a studio background.',
      purpose: 'Standard e-commerce catalog shot showing front drape',
      category: 'standing'
    },
    {
      name: 'E-commerce: 45-Degree Angle',
      description: 'Three-quarter angle showing side drape',
      promptSnippet: 'Full body standing pose turned slightly at a 45-degree angle, looking towards the camera. One hand gently resting on the hip. Highlights the side pleats, shoulder drape, and the fall of the saree.',
      purpose: 'E-commerce shot to show the dimension and side profile',
      category: 'standing'
    },
    {
      name: 'E-commerce: Pallu Showcase',
      description: 'Holding the pallu out to show border and design',
      promptSnippet: 'Full body standing pose. The model is elegantly holding out the end of the saree pallu with one hand to showcase its intricate design and border. Slight walking stance to give a sense of flow and fabric weight.',
      purpose: 'E-commerce shot focused on displaying the pallu design',
      category: 'standing'
    }
  ];

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
  
  console.log(`Added 3 new e-commerce standing poses to template: ${template.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
