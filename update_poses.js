const fs = require('fs');
const envData = fs.readFileSync('.env.local', 'utf8');
for(const line of envData.split('\n')) {
  if(line.startsWith('DATABASE_URL=')) {
    process.env.DATABASE_URL = line.substring(13).trim().replace(/['"]+/g, '');
  }
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORY_POSES_MAP = {
  saree: [
    {
      number: 1,
      category: 'standing',
      name: '1. The Walk-In',
      description: '3/4 body, eye-level, gaze off toward light, hand at the pallu — mid-step. (MAIN image)',
      promptSnippet: '3/4 body portrait, mid-step walking in, gaze off toward light, hand gently holding the pallu at shoulder',
      defaultSample: '/poses/saree_pose_1.jpg',
    },
    {
      number: 2,
      category: 'standing',
      name: '2. The Full Drape',
      description: 'Full-length, walking / mid-step, hand steadying the drape',
      promptSnippet: 'full-length shot, mid-step walking, hand steadying the saree drape, showing fabric fall and movement',
      defaultSample: '/poses/saree_pose_2.jpg',
    },
    {
      number: 3,
      category: 'seated',
      name: '3. The Moment',
      description: 'Seated or leaning, chest-height, doing the room\'s action (cup / bag / keys)',
      promptSnippet: 'medium shot chest-height, seated or gracefully leaning, engaging with the room like holding a teacup or keys, living in her real day',
      defaultSample: '/poses/saree_pose_3.jpg',
    },
    {
      number: 4,
      category: 'detail',
      name: '4. The Glance',
      description: 'Chest-up, closer, soft gaze just past the camera',
      promptSnippet: 'close-up chest-up portrait, soft gaze looking just past the camera, creating a human connection',
      defaultSample: '/poses/saree_pose_4.jpg',
    },
    {
      number: 5,
      category: 'detail',
      name: '5. The Pallu (Back)',
      description: 'Drape from behind, pallu + blouse',
      promptSnippet: 'shot from behind, highlighting the back blouse design and the heavy pallu drape over the shoulder',
      defaultSample: '/poses/saree_pose_5.jpg',
    },
    {
      number: 6,
      category: 'detail',
      name: '6. The Cloth',
      description: 'Flatlay on floor, a hand lifting the fabric — REAL photo, never AI',
      promptSnippet: 'REAL PHOTO PLACEHOLDER',
      defaultSample: '/poses/saree_pose_6.jpg',
    },
  ],
  kurti: [
    {
      number: 1,
      category: 'standing',
      name: '1. The Walk-In',
      description: '3/4 body, eye-level, gaze off toward light, hand on tote bag — mid-step. (MAIN image)',
      promptSnippet: '3/4 body portrait, mid-step walking in, gaze off toward light, holding a tote bag or laptop folder',
      defaultSample: '/poses/kurti_pose_1.jpg',
    },
    {
      number: 2,
      category: 'standing',
      name: '2. The Full Drape',
      description: 'Full-length, walking / mid-step, hand adjusting dupatta or side slit',
      promptSnippet: 'full-length shot, mid-step walking, hand subtly adjusting dupatta or resting at side, showing kurti length and pant fall',
      defaultSample: '/poses/kurti_pose_2.jpg',
    },
    {
      number: 3,
      category: 'seated',
      name: '3. The Moment',
      description: 'Seated or leaning, chest-height, doing the room\'s action (phone / folder)',
      promptSnippet: 'medium shot chest-height, seated or gracefully leaning, engaging with the room like checking phone or holding a folder',
      defaultSample: '/poses/kurti_pose_3.jpg',
    },
    {
      number: 4,
      category: 'detail',
      name: '4. The Glance',
      description: 'Chest-up, closer, soft gaze just past the camera',
      promptSnippet: 'close-up chest-up portrait, soft gaze looking just past the camera, creating a human connection',
      defaultSample: '/poses/kurti_pose_4.jpg',
    },
    {
      number: 5,
      category: 'detail',
      name: '5. The Back Details',
      description: 'Drape from behind, back neckline + dupatta',
      promptSnippet: 'shot from behind, highlighting the back neckline design and dupatta drape over the shoulder',
      defaultSample: '/poses/kurti_pose_5.jpg',
    },
    {
      number: 6,
      category: 'detail',
      name: '6. The Cloth',
      description: 'Flatlay on floor, a hand lifting the fabric — REAL photo, never AI',
      promptSnippet: 'REAL PHOTO PLACEHOLDER',
      defaultSample: '/poses/kurti_pose_6.jpg',
    },
  ]
};

async function main() {
  const templates = await prisma.garmentTemplate.findMany();

  for (const template of templates) {
    if (template.slug === 'saree' || template.slug === 'kurti') {
      console.log(`Updating ${template.slug}...`);
      
      await prisma.poseTemplate.deleteMany({
        where: { templateId: template.id }
      });

      const newPoses = CATEGORY_POSES_MAP[template.slug];
      
      for (const pose of newPoses) {
        await prisma.poseTemplate.create({
          data: {
            templateId: template.id,
            name: pose.name,
            description: pose.description,
            promptSnippet: pose.promptSnippet,
            previewImage: pose.defaultSample,
            category: pose.category,
            sortOrder: pose.number,
          }
        });
      }
      console.log(`Updated poses for ${template.slug}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
