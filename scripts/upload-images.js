const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_IMAGES_BUCKET || 'images'; 
const R2_PUBLIC_URL = (process.env.R2_IMAGES_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''); 

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadFile(filePath, key) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return null;
  }
  const buffer = fs.readFileSync(filePath);
  let ext = path.extname(filePath).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.svg') contentType = 'image/svg+xml';
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  console.log(`Uploaded ${filePath} to bucket ${R2_BUCKET_NAME} as ${key}`);
  return `${R2_PUBLIC_URL}/${key}`; // Return the constructed URL
}

async function main() {
  console.log('Starting upload of static template images to R2...');

  // 1. Upload Cover Images
  const sareeCoverUrl = await uploadFile('public/saree_model_4k.jpg', 'saree_model_4k.jpg');
  const kurtiCoverUrl = await uploadFile('public/kurti_model_4k.jpg', 'kurti_model_4k.jpg');

  // 2. Upload Pose Images
  const pose1Url = await uploadFile('public/pose_1_standing.jpg', 'poses/pose_1_standing.jpg');
  const pose2Url = await uploadFile('public/saree_pallu.jpg', 'poses/saree_pallu.jpg');
  const pose3Url = await uploadFile('public/saree_body.jpg', 'poses/saree_body.jpg');
  const pose4Url = await uploadFile('public/saree_blouse.jpg', 'poses/saree_blouse.jpg');

  console.log('\nUpdating database with R2 URLs...');

  if (sareeCoverUrl) {
    await prisma.garmentTemplate.updateMany({
      where: { slug: 'saree' },
      data: { coverImage: sareeCoverUrl },
    });
    console.log('Updated Saree GarmentTemplate coverImage');
  }

  if (kurtiCoverUrl) {
    await prisma.garmentTemplate.updateMany({
      where: { slug: 'kurti' },
      data: { coverImage: kurtiCoverUrl },
    });
    console.log('Updated Kurti GarmentTemplate coverImage');
  }

  // Update poses for Saree
  const sareeTemplate = await prisma.garmentTemplate.findUnique({ where: { slug: 'saree' }, include: { poses: true } });
  if (sareeTemplate && sareeTemplate.poses) {
    for (const pose of sareeTemplate.poses) {
      if (pose.previewImage && pose.previewImage.includes('pose_1_standing') && pose1Url) {
         await prisma.poseTemplate.update({ where: { id: pose.id }, data: { previewImage: pose1Url }});
      } else if (pose.previewImage && pose.previewImage.includes('saree_pallu') && pose2Url) {
         await prisma.poseTemplate.update({ where: { id: pose.id }, data: { previewImage: pose2Url }});
      } else if (pose.previewImage && pose.previewImage.includes('saree_body') && pose3Url) {
         await prisma.poseTemplate.update({ where: { id: pose.id }, data: { previewImage: pose3Url }});
      } else if (pose.previewImage && pose.previewImage.includes('saree_blouse') && pose4Url) {
         await prisma.poseTemplate.update({ where: { id: pose.id }, data: { previewImage: pose4Url }});
      }
    }
    console.log('Updated Saree Pose images');
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
