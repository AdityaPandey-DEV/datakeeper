import fs from 'fs';

let blobContent = fs.readFileSync('src/lib/blob.ts', 'utf8');

if (!blobContent.includes('GetObjectCommand')) {
  blobContent = blobContent.replace(
    /import \{\s*S3Client,/,
    "import { S3Client, GetObjectCommand,"
  );
}

if (!blobContent.includes('getSignedUrl')) {
  blobContent = "import { getSignedUrl } from '@aws-sdk/s3-request-presigner';\n" + blobContent;
}

if (!blobContent.includes('export async function getPresignedDownloadUrl')) {
  blobContent += `
export async function getPresignedDownloadUrl(key: string): Promise<string> {
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 * 24 }); // 24 hours
}
`;
}

fs.writeFileSync('src/lib/blob.ts', blobContent);

let routeContent = fs.readFileSync('src/app/api/files/route.ts', 'utf8');
if (!routeContent.includes('getPresignedDownloadUrl')) {
  routeContent = routeContent.replace(
    "import { deleteR2Keys } from '@/lib/blob';",
    "import { deleteR2Keys, getPresignedDownloadUrl } from '@/lib/blob';"
  );
}

routeContent = routeContent.replace(
  /url: row\.r2_key \? `https:\/\/pub-8dff9b3e1e694fb48ad0d8a5de25e9a3\.r2\.dev\/\$\{row\.r2_key\}` : undefined,/g,
  'url: row.r2_key ? await getPresignedDownloadUrl(row.r2_key) : undefined,'
);

fs.writeFileSync('src/app/api/files/route.ts', routeContent);
console.log('Fixed presigned GET URLs!');
