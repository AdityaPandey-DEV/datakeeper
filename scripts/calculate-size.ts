import { S3Client, ListObjectsV2Command, ListMultipartUploadsCommand } from '@aws-sdk/client-s3';

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
  console.log('🔍 Calculating real-time bucket size...');
  
  let continuationToken: string | undefined = undefined;
  let totalBytes = 0;
  let fileCount = 0;

  do {
    const response: any = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        totalBytes += (obj.Size || 0);
        fileCount++;
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  let multipartCount = 0;
  let keyMarker: string | undefined = undefined;
  let uploadIdMarker: string | undefined = undefined;

  do {
    const response: any = await s3.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      })
    );

    if (response.Uploads) {
      multipartCount += response.Uploads.length;
    }
    keyMarker = response.NextKeyMarker;
    uploadIdMarker = response.NextUploadIdMarker;
  } while (keyMarker && uploadIdMarker);

  console.log(`\n📊 Real-Time Storage Report:`);
  console.log(`- Files: ${fileCount}`);
  console.log(`- Total Size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${(totalBytes / (1024 * 1024 * 1024)).toFixed(4)} GB)`);
  console.log(`- Active Multipart Uploads: ${multipartCount}`);
}

main().catch(console.error);
