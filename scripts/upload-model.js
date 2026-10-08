const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

const R2_ACCOUNT_ID = '5121be04e91525bb3278414becc5d48a';
const R2_ACCESS_KEY_ID = 'fa7179cc28728cc0f5c77bd28bc5d8db';
const R2_SECRET_ACCESS_KEY = '7c0261cf9524378259cfa1da5c573163245d57c8d785511a79b05d3a82ce3182';
const R2_BUCKET_NAME = 'models'; // the bucket name user provided
const R2_PUBLIC_URL = 'https://pub-865f883eab884bad83e2c0b7e83952dc.r2.dev'; // Assuming same public URL or we just use local fallback if it fails.

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const buffer = fs.readFileSync('public/model_divya.jpg');
  await s3Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: 'model_divya.jpg',
      Body: buffer,
      ContentType: 'image/jpeg',
    })
  );
  console.log('Uploaded to models bucket');
}
main().catch(console.error);
