const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

async function testR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  console.log('Testing R2 Config:');
  console.log('Account ID:', accountId);
  console.log('Bucket:', bucketName);
  
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('Error: Missing R2 credentials in .env.local');
    return;
  }

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    console.log('Uploading test file...');
    const cmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test-r2-upload.txt',
      Body: 'Hello from CoutureAI R2 Test!',
      ContentType: 'text/plain',
    });
    
    await s3Client.send(cmd);
    console.log('✅ Upload successful!');
    console.log(`✅ File should be available at: ${publicUrl}/test-r2-upload.txt`);
  } catch (e) {
    console.error('❌ Upload failed:', e.message);
  }
}
testR2();
