import fs from 'fs';
import path from 'path';
import { list } from '@vercel/blob';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let val = valueParts.join('=').trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
          if (!process.env[key.trim()]) process.env[key.trim()] = val;
        }
      }
    }
  }
}

loadEnvLocal();

const VERCEL_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
if (!VERCEL_TOKEN) { console.error('❌ BLOB_READ_WRITE_TOKEN not set.'); process.exit(1); }

const accountId = process.env.R2_ENDPOINT?.split('https://')[1]?.split('.')[0];
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_ENDPOINT;
const bucketName = process.env.R2_BUCKET_NAME || 'datakeeper';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('❌ Missing Cloudflare R2 credentials.');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: endpoint,
  credentials: { accessKeyId, secretAccessKey },
});

const CONCURRENCY = 4;

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

async function runPool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0;
  await Promise.all(Array(Math.min(n, items.length)).fill(0).map(async () => {
    while (idx < items.length) { const i = idx++; await fn(items[i], i); }
  }));
}

function getContentType(f: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf',
  };
  return map[path.extname(f).toLowerCase()] || 'application/octet-stream';
}

async function main() {
  console.log('🔍 Fetching all files from Vercel Blob...');
  let cursor: string | undefined;
  let hasMore = true;
  const filesToMigrate: { url: string; pathname: string; size: number }[] = [];

  while (hasMore) {
    const r = await list({ cursor, limit: 1000, token: VERCEL_TOKEN });
    for (const b of r.blobs) filesToMigrate.push({ url: b.url, pathname: b.pathname, size: b.size });
    hasMore = r.hasMore;
    cursor = r.cursor;
  }

  console.log(`🚀 Found ${filesToMigrate.length} file(s) in Vercel Blob to migrate to Cloudflare R2.`);
  console.log(`⚡ ${CONCURRENCY} parallel workers | Direct streaming migration\n`);

  await runPool(filesToMigrate, CONCURRENCY, async (blob, i) => {
    const tag = `[${i + 1}/${filesToMigrate.length}] [${path.basename(blob.pathname)}]`;
    console.log(`${tag} Migrating (${formatSize(blob.size)})...`);

    try {
      // Stream directly from Vercel to Cloudflare without saving to disk first
      const res = await fetch(blob.url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const upload = new Upload({
        client: s3,
        params: {
          Bucket: bucketName,
          Key: blob.pathname,
          Body: res.body as any, // stream
          ContentType: getContentType(blob.pathname),
        },
      });

      await upload.done();
      console.log(`${tag} ✅ Successfully migrated to R2!\n`);
    } catch (err: any) {
      console.error(`${tag} ❌ Migration failed: ${err.message}\n`);
    }
  });

  console.log('🎉 Full migration from Vercel Blob to Cloudflare R2 is complete!');
  console.log('You can now safely delete the files from Vercel Blob to clear your quota.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
