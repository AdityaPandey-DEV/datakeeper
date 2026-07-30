import { S3Client, ListMultipartUploadsCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.R2_BUCKET_NAME || 'datakeeper';

async function main() {
  console.log('🔍 Scanning Cloudflare R2 for incomplete multipart uploads...');
  
  let keyMarker: string | undefined = undefined;
  let uploadIdMarker: string | undefined = undefined;
  let abortedCount = 0;

  do {
    const response = await s3.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      })
    );

    if (response.Uploads && response.Uploads.length > 0) {
      console.log(`🗑️ Found ${response.Uploads.length} incomplete uploads in this batch.`);
      for (const upload of response.Uploads) {
        if (!upload.Key || !upload.UploadId) continue;
        
        try {
          await s3.send(
            new AbortMultipartUploadCommand({
              Bucket: bucket,
              Key: upload.Key,
              UploadId: upload.UploadId,
            })
          );
          abortedCount++;
          console.log(`✅ Aborted: ${upload.Key}`);
        } catch (err: any) {
          console.error(`❌ Failed to abort ${upload.Key}: ${err.message}`);
        }
      }
    }

    keyMarker = response.NextKeyMarker;
    uploadIdMarker = response.NextUploadIdMarker;
  } while (keyMarker && uploadIdMarker);

  if (abortedCount === 0) {
    console.log('✨ Clean! No incomplete multipart uploads found.');
  } else {
    console.log(`🎉 Cleanup complete! Aborted ${abortedCount} incomplete uploads. Your storage space should now drop!`);
  }
}

main().catch(console.error);
