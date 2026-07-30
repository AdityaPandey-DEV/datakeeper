import { neon } from '@neondatabase/serverless';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const sql = neon(process.env.POSTGRES_URL!);
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
  console.log('🔍 Scanning Cloudflare R2 for orphaned files...');
  
  let continuationToken: string | undefined = undefined;
  const allR2Keys = new Set<string>();

  // 1. Fetch all files from R2
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) allR2Keys.add(obj.Key);
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`📊 Found ${allR2Keys.size} total files in Cloudflare R2.`);

  // 2. Fetch all valid files from Database
  console.log('🔍 Querying Database for valid files...');
  const dbNodes = await sql`SELECT r2_key FROM nodes WHERE r2_key IS NOT NULL`;
  const dbKeys = new Set(dbNodes.map(n => n.r2_key));

  console.log(`📊 Found ${dbKeys.size} valid file references in Database.`);

  // 3. Find Orphans (In R2 but NOT in Database, ignoring .keep markers)
  const orphans: string[] = [];
  for (const r2Key of allR2Keys) {
    if (!r2Key.endsWith('.keep') && !dbKeys.has(r2Key)) {
      orphans.push(r2Key);
    }
  }

  if (orphans.length === 0) {
    console.log('✨ Clean! No orphaned files found in Cloudflare R2.');
    return;
  }

  console.log(`🗑️ Found ${orphans.length} orphaned files to delete.`);
  
  // 4. Delete Orphans in chunks of 1000
  for (let i = 0; i < orphans.length; i += 1000) {
    const chunk = orphans.slice(i, i + 1000);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map(key => ({ Key: key })),
          Quiet: true,
        },
      })
    );
    console.log(`✅ Deleted ${chunk.length} orphaned files...`);
  }

  console.log('🎉 Cleanup complete!');
}

main().catch(console.error);
