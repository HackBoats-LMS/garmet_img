const { v2: cloudinary } = require('cloudinary');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'fe5qt9si',
  api_key: '184317583519463',
  api_secret: 'y5s3gB_8E54Q8oVpMksbY9_4u6M',
  secure: true,
});

const prisma = new PrismaClient();

async function uploadLocalFile(localRelPath, folder, publicId) {
  const absPath = path.join(__dirname, '..', 'public', localRelPath.replace(/^\//, ''));
  if (!fs.existsSync(absPath)) {
    console.error(`File does not exist: ${absPath}`);
    return null;
  }

  console.log(`Uploading ${localRelPath} to Cloudinary folder: ${folder}...`);
  const result = await cloudinary.uploader.upload(absPath, {
    folder,
    public_id: publicId,
    resource_type: 'image',
    overwrite: true,
    invalidate: true,
  });

  console.log(`  -> Uploaded: ${result.secure_url}`);
  return result.secure_url;
}

async function main() {
  console.log('=== Starting Cloudinary Full Asset Migration ===\n');

  // 1. Upload Template Cover Images
  const sareeCoverUrl = await uploadLocalFile(
    '/saree_model_4k.jpg',
    'coutureai/admin/templates/saree',
    'saree_cover_4k'
  );

  // 2. Upload Model Persona Face Portraits
  const ananyaUrl = await uploadLocalFile(
    '/model_ananya.jpg',
    'coutureai/admin/models',
    'model_ananya'
  );
  const meeraUrl = await uploadLocalFile(
    '/model_meera.png',
    'coutureai/admin/models',
    'model_meera'
  );
  const priyaUrl = await uploadLocalFile(
    '/model_priya.png',
    'coutureai/admin/models',
    'model_priya'
  );

  // 3. Upload Pose Reference Sample Angles
  const pose1Url = await uploadLocalFile(
    '/pose_1_standing.jpg',
    'coutureai/admin/templates/saree/poses',
    'pose_1_standing'
  );
  const pose2Url = await uploadLocalFile(
    '/saree_pallu.jpg',
    'coutureai/admin/templates/saree/poses',
    'pose_2_pallu'
  );
  const pose3Url = await uploadLocalFile(
    '/saree_body.jpg',
    'coutureai/admin/templates/saree/poses',
    'pose_3_seated_haveli'
  );
  const pose4Url = await uploadLocalFile(
    '/saree_blouse.jpg',
    'coutureai/admin/templates/saree/poses',
    'pose_4_blouse_back'
  );

  console.log('\n=== Updating Database with Cloudinary URLs ===\n');

  // Update Template Cover
  if (sareeCoverUrl) {
    await prisma.garmentTemplate.updateMany({
      where: { slug: 'saree' },
      data: { coverImage: sareeCoverUrl },
    });
    console.log('✓ Updated Saree GarmentTemplate coverImage');
  }

  // Update AI Model Personas
  if (ananyaUrl) {
    await prisma.aIModel.updateMany({
      where: { name: { contains: 'Ananya' } },
      data: { imageUrl: ananyaUrl },
    });
    console.log('✓ Updated Ananya AIModel portrait URL');
  }
  if (meeraUrl) {
    await prisma.aIModel.updateMany({
      where: { name: { contains: 'Meera' } },
      data: { imageUrl: meeraUrl },
    });
    console.log('✓ Updated Meera AIModel portrait URL');
  }
  if (priyaUrl) {
    await prisma.aIModel.updateMany({
      where: { name: { contains: 'Priya' } },
      data: { imageUrl: priyaUrl },
    });
    console.log('✓ Updated Priya AIModel portrait URL');
  }

  // Update Saree Pose Previews
  const saree = await prisma.garmentTemplate.findUnique({
    where: { slug: 'saree' },
    include: { poses: true },
  });

  if (saree) {
    const poseMap = {
      '1. Full Standing Front': pose1Url,
      '2. Grand Pallu Spread': pose2Url,
      '3. Royal Seated Haveli': pose3Url,
      '4. Blouse Back & Maggam Work': pose4Url,
    };

    for (const pose of saree.poses) {
      const cUrl = poseMap[pose.name] || pose1Url;
      if (cUrl) {
        await prisma.poseTemplate.update({
          where: { id: pose.id },
          data: { previewImage: cUrl },
        });
        console.log(`✓ Updated pose "${pose.name}" -> ${cUrl}`);
      }
    }
  }

  console.log('\n=== Migration Completed Successfully! ===');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
