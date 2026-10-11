import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAREE_POSES = [
  {
    name: '1. The Mirror Moment',
    category: 'seated',
    description: 'Over-the-shoulder dressing mirror check — 30-sec certainty reset before stepping out',
    promptSnippet: 'Over-the-shoulder medium shot angled 45 degrees behind the model, looking past her shoulder into a vintage warm teakwood dressing mirror. Strict optical reflection physics: the mirror reflection cleanly captures her serene, poised face looking directly into her own eyes in the glass with a quiet confident half-smile. Her hand is gracefully raised checking the pallu pin at her shoulder, and the reflection geometrically mirrors her hand, gold bangles, and the saree border with exact optical symmetry and matching warm morning ambient lighting. Zero reflection distortion, single coherent identity.',
    purpose: 'Iconic 4-minute morning drape ritual — checking shoulder pleats with accurate ray-traced mirror physics',
    fabricFocus: 'Shoulder pallu pleating, pin placement, neckline, and blouse sleeve border',
    previewImage: '/poses/saree_pose_mirror.jpg',
  },
  {
    name: '2. The Classic Front Stand',
    category: 'standing',
    description: 'Full head-to-toe front standing catalog view — showing full silhouette and pleats fall',
    promptSnippet: 'Full-length front standing portrait at eye-level, subtle 15-degree body turn towards soft natural light. Left hand resting naturally by her side, right hand gently holding the woven pallu edge at waist height to clearly display the full width of the zari border, crisp vertical waist pleats, and clean floor-length fall of the saree. Poised, dignified expression of a modern Indian woman.',
    purpose: 'Clean e-commerce and WhatsApp catalogue reference showing full garment length and pleat alignment',
    fabricFocus: 'Waist pleats, border width from shoulder to hem, and main body motif repeat',
    previewImage: '/poses/saree_pose_front.jpg',
  },
  {
    name: '3. The Confident Walk-In',
    category: 'standing',
    description: 'Mid-step editorial stride — natural fabric flow and confident posture',
    promptSnippet: 'Full-length candid editorial stride, eye-level. The model is mid-step walking forward along a sunlit corridor or veranda, head held high with a grounded capable expression. Her hand gently steadies the pallu against her waist while her arm sways naturally with her walk. The saree pleats and pallu show realistic gravity, weight, and fluid fabric motion.',
    purpose: 'Dynamic movement showing authentic fabric weight and drape in motion',
    fabricFocus: 'Fluid drape movement, pleat flutter, and pallu flow',
    previewImage: '/poses/saree_pose_2.jpg',
  },
  {
    name: '4. The Verandah Hostess',
    category: 'seated',
    description: 'Seated gracefully with teacup in sunlit living room — natural seated pleat fan',
    promptSnippet: 'Medium shot, seated gracefully on a classic teak armchair in a sunlit living room or verandah. The saree pleats are neatly and naturally fanned across her lap and legs, showing how the fabric drapes comfortably in real life. Holding a porcelain tea cup or resting hand on armrest, wearing delicate gold bangles, looking slightly off-camera with a warm, welcoming smile.',
    purpose: 'Shows seated comfort, lap drape, and relaxed luxury for social hosting and daily wear',
    fabricFocus: 'Lap pleat drape, front pallu spread, and blouse fit when seated',
    previewImage: '/poses/saree_pose_3.jpg',
  },
  {
    name: '5. The Glance',
    category: 'detail',
    description: 'Waist-up portrait with soft glance — close-up on neckline and chest motifs',
    promptSnippet: 'Close-up chest-up portrait, soft gaze looking just past the camera, creating a warm human connection. One hand lightly raised near the collarbone or touching a delicate earring. Intimate focus on the rich saree texture across the chest, the pallu border, and subtle natural skin texture.',
    purpose: 'Close-up for social media hero shot and fine craft inspection',
    fabricFocus: 'Chest zari motifs, neckline border, and blouse sleeve detailing',
    previewImage: '/poses/saree_pose_4.jpg',
  },
  {
    name: '6. The Pallu Cascade',
    category: 'detail',
    description: 'Three-quarter rear view — showing full pallu back design and blouse back cut',
    promptSnippet: 'Three-quarter rear portrait view. The model is standing poised, gently turning her head to look back over her left shoulder towards the camera. Prominently showcases the full majestic fall of the heavy zari pallu cascading down her back, along with the fitted blouse back neckline, dori tassels, and neat hair updo adorned with fresh jasmine (gajra).',
    purpose: 'Back view showcasing blouse craftsmanship, back cut, and grand pallu end motifs',
    fabricFocus: 'Full back pallu motifs, border finish, and blouse back tailoring',
    previewImage: '/poses/saree_pose_5.jpg',
  },
];

const KURTI_POSES = [
  {
    name: '1. Professional Stride',
    category: 'standing',
    description: 'Everyday capable stride with leather tote bag — professional connoisseur workday',
    promptSnippet: 'Full-body dynamic walking pose along an upscale outdoor walkway. Model carrying a leather tote bag, kurti side slits fluttering naturally, showing kurti length and pant fall.',
    purpose: 'Professional Connoisseur everyday wearability in motion',
    fabricFocus: 'Kurti length, pant fall, and side slit movement',
    previewImage: '/poses/kurti_pose_1.jpg',
  },
  {
    name: '2. Courtyard Festive Walk',
    category: 'standing',
    description: 'Full drape walking stride with dupatta draped gracefully across both shoulders',
    promptSnippet: 'Full-length walking pose in a sunlit heritage courtyard. The model walks forward with dupatta draped over arms and shoulders, showcasing bottom pant and kurti hemline.',
    purpose: 'Festive and occasion kurti set presentation with dupatta',
    fabricFocus: 'Dupatta drape and border, hemline flare',
    previewImage: '/poses/kurti_pose_2.jpg',
  },
  {
    name: '3. Boardroom & Lounge Seated',
    category: 'seated',
    description: 'Seated comfortably on armchair with document portfolio — relaxed capable composure',
    promptSnippet: 'Medium shot, seated gracefully in a modern lounge armchair holding a document sleeve, showing how the kurti slits fall and pant comfort when seated.',
    purpose: 'Shows seated drape, wrinkle resistance, and workplace composure',
    fabricFocus: 'Lap drape, pant comfort, and sleeve fit',
    previewImage: '/poses/kurti_pose_3.jpg',
  },
  {
    name: '4. Neckline & Embroidery Detail',
    category: 'detail',
    description: 'Close-up chest portrait showing collar, placket buttons, and chest embroidery',
    promptSnippet: 'Waist-up portrait shot, clear focus on kurti neckline embroidery, placket, and collar craft details with a warm, genuine smile.',
    purpose: 'Close-up view of intricate placket and embroidery craft',
    fabricFocus: 'Collar, neckline placket, buttons, and yoke embroidery',
    previewImage: '/poses/kurti_pose_4.jpg',
  },
];

async function main() {
  const templates = await prisma.garmentTemplate.findMany();
  console.log(`Updating poses for ${templates.length} templates...`);

  for (const template of templates) {
    const isSaree = template.slug?.toLowerCase().includes('saree') || template.name?.toLowerCase().includes('saree');
    const isKurti = template.slug?.toLowerCase().includes('kurti') || template.name?.toLowerCase().includes('kurti');

    if (isSaree) {
      console.log(`\nUpdating Saree template: ${template.name} (${template.id})`);
      await prisma.poseTemplate.deleteMany({ where: { templateId: template.id } });
      const created = await prisma.poseTemplate.createMany({
        data: SAREE_POSES.map((p, idx) => ({
          templateId: template.id,
          name: p.name,
          category: p.category,
          description: p.description,
          promptSnippet: p.promptSnippet,
          purpose: p.purpose,
          fabricFocus: p.fabricFocus,
          previewImage: p.previewImage,
          sortOrder: idx + 1,
        })),
      });
      console.log(`✓ Inserted ${created.count} realistic poses for Saree`);
    } else if (isKurti) {
      console.log(`\nUpdating Kurti template: ${template.name} (${template.id})`);
      await prisma.poseTemplate.deleteMany({ where: { templateId: template.id } });
      const created = await prisma.poseTemplate.createMany({
        data: KURTI_POSES.map((p, idx) => ({
          templateId: template.id,
          name: p.name,
          category: p.category,
          description: p.description,
          promptSnippet: p.promptSnippet,
          purpose: p.purpose,
          fabricFocus: p.fabricFocus,
          previewImage: p.previewImage,
          sortOrder: idx + 1,
        })),
      });
      console.log(`✓ Inserted ${created.count} realistic poses for Kurti`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
